import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { checkOrgLimit, type PlanId } from '@/lib/plan-limits';
import {
  parseCsvText,
  autoMapHeaders,
  validateAndMapRows,
  type ColumnMapping,
  type MappedCandidateRow,
  type RowValidationError,
} from '@/lib/csv-import';
import { notifyNewApplication } from '@/lib/push';
import { requireOrgId, isOrgError } from '@/lib/require-org';

const MAX_ROWS = 2000;
const MAX_FILE_CHARS = 5_000_000; // ~5MB text

type Mode = 'preview' | 'import';

interface ImportBody {
  mode?: Mode;
  csvText?: string;
  mapping?: ColumnMapping;
  jobId?: string | null;
  skipDuplicates?: boolean;
}

export const POST = withPermission('CREATE_CANDIDATE', async (request: NextRequest, _ctx, session) => {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = (await request.json()) as ImportBody;
    const mode: Mode = body.mode === 'import' ? 'import' : 'preview';
    const csvText = typeof body.csvText === 'string' ? body.csvText : '';
    const skipDuplicates = body.skipDuplicates !== false;

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }
    if (csvText.length > MAX_FILE_CHARS) {
      return NextResponse.json({ error: 'File too large. Maximum ~5MB CSV.' }, { status: 400 });
    }

    const { headers, rows } = parseCsvText(csvText);
    if (headers.length === 0) {
      return NextResponse.json({ error: 'CSV has no headers' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows (${rows.length}). Maximum is ${MAX_ROWS} per import.` },
        { status: 400 },
      );
    }

    const mapping: ColumnMapping =
      body.mapping && Object.keys(body.mapping).length > 0
        ? body.mapping
        : autoMapHeaders(headers);

    const { valid, errors } = validateAndMapRows(rows, mapping);

    const orgIdOrErr = requireOrgId(session);
    if (isOrgError(orgIdOrErr)) return orgIdOrErr;
    const orgId = orgIdOrErr;
    const orgFilter = { organizationId: orgId };

    // Dedup against existing candidates in this org
    const emails = valid.map((r) => r.email);
    const existing = emails.length
      ? await prisma.candidate.findMany({
          where: { ...orgFilter, email: { in: emails } },
          select: { id: true, email: true, name: true },
        })
      : [];
    const existingByEmail = new Map(existing.map((c) => [c.email.toLowerCase(), c]));

    const duplicates: Array<{ rowNumber: number; email: string; existingId: string; existingName: string }> = [];
    const toCreate: MappedCandidateRow[] = [];

    for (const row of valid) {
      const hit = existingByEmail.get(row.email);
      if (hit) {
        duplicates.push({
          rowNumber: row.rowNumber,
          email: row.email,
          existingId: hit.id,
          existingName: hit.name,
        });
        if (!skipDuplicates) {
          // Will treat as error on import
        }
      } else {
        toCreate.push(row);
      }
    }

    // Resolve optional job for applications
    let job: { id: string; title: string } | null = null;
    if (body.jobId) {
      const found = await prisma.job.findFirst({
        where: {
          id: body.jobId,
          companyId: orgId,
        },
        select: { id: true, title: true },
      });
      if (!found) {
        return NextResponse.json({ error: 'Selected job not found' }, { status: 400 });
      }
      job = found;
    }

    // Jobs by title for per-row jobTitle mapping
    const jobTitles = [...new Set(toCreate.map((r) => r.jobTitle).filter(Boolean) as string[])];
    const jobsByTitle = new Map<string, string>();
    if (jobTitles.length > 0 && orgId) {
      const jobs = await prisma.job.findMany({
        where: {
          companyId: orgId,
          status: { not: 'Closed' },
          title: { in: jobTitles, mode: 'insensitive' },
        },
        select: { id: true, title: true },
      });
      for (const j of jobs) {
        jobsByTitle.set(j.title.toLowerCase(), j.id);
      }
    }

    if (mode === 'preview') {
      return NextResponse.json({
        mode: 'preview',
        headers,
        suggestedMapping: autoMapHeaders(headers),
        mapping,
        totalRows: rows.length,
        validCount: valid.length,
        errorCount: errors.length,
        duplicateCount: duplicates.length,
        createCount: toCreate.length,
        errors: errors.slice(0, 100),
        duplicates: duplicates.slice(0, 100),
        sample: toCreate.slice(0, 5),
        job: job ? { id: job.id, title: job.title } : null,
      });
    }

    // --- Import mode ---
    const importErrors: RowValidationError[] = [...errors];

    if (!skipDuplicates) {
      for (const d of duplicates) {
        importErrors.push({
          rowNumber: d.rowNumber,
          email: d.email,
          field: 'email',
          message: `Candidate already exists (${d.existingName})`,
        });
      }
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        mode: 'import',
        created: 0,
        skippedDuplicates: duplicates.length,
        failed: importErrors.length,
        errors: importErrors.slice(0, 200),
        createdIds: [],
      });
    }

    // Enforce plan candidate limit for the batch
    if (orgId) {
      const limitCheck = await checkOrgLimit(orgId, 'candidates');
      if (limitCheck.limit !== -1) {
        const remaining = Math.max(0, limitCheck.limit - limitCheck.current);
        if (remaining <= 0) {
          return NextResponse.json(
            {
              error: `Candidate limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan to import more.`,
              code: 'PLAN_LIMIT_REACHED',
            },
            { status: 403 },
          );
        }
        if (toCreate.length > remaining) {
          return NextResponse.json(
            {
              error: `Import would exceed plan limit. You can add ${remaining} more candidate(s) (limit ${limitCheck.limit}). Reduce the file or upgrade.`,
              code: 'PLAN_LIMIT_REACHED',
              remaining,
              limit: limitCheck.limit,
              current: limitCheck.current,
              plan: limitCheck.plan as PlanId,
            },
            { status: 403 },
          );
        }
      }
    }

    const createdIds: string[] = [];
    const BATCH = 50;

    for (let i = 0; i < toCreate.length; i += BATCH) {
      const chunk = toCreate.slice(i, i + BATCH);
      await prisma.$transaction(async (tx) => {
        for (const row of chunk) {
          try {
            let applyJobId = job?.id ?? null;
            if (!applyJobId && row.jobTitle) {
              applyJobId = jobsByTitle.get(row.jobTitle.toLowerCase()) ?? null;
            }

            const candidate = await tx.candidate.create({
              data: {
                name: row.name,
                email: row.email,
                phone: row.phone ?? null,
                source: row.source ?? 'csv_import',
                currentTitle: row.currentTitle ?? null,
                currentCompany: row.currentCompany ?? null,
                location: row.location ?? null,
                city: row.city ?? null,
                country: row.country ?? null,
                experience: row.experience ?? null,
                skills: row.skills ?? [],
                tags: row.tags ?? [],
                linkedInUrl: row.linkedInUrl ?? null,
                githubUrl: row.githubUrl ?? null,
                portfolioUrl: row.portfolioUrl ?? null,
                organizationId: orgId,
                ...(applyJobId
                  ? { applications: { create: { jobId: applyJobId, stage: 'APPLIED' } } }
                  : {}),
              },
              select: { id: true },
            });
            createdIds.push(candidate.id);
          } catch (err: unknown) {
            const message =
              err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002'
                ? 'Duplicate email (unique constraint)'
                : 'Failed to create candidate';
            importErrors.push({
              rowNumber: row.rowNumber,
              email: row.email,
              message,
            });
          }
        }
      });
    }

    await prisma.userActivityLog
      .create({
        data: {
          userId: session.id,
          action: 'candidates_bulk_import',
          entityType: 'candidate',
          entityId: createdIds[0] ?? null,
          metadata: {
            created: createdIds.length,
            skippedDuplicates: duplicates.length,
            failed: importErrors.length,
            jobId: job?.id ?? null,
          },
        },
      })
      .catch(() => {});

    // Push notify once for bulk import when applications were attached
    if (orgId && job && createdIds.length > 0) {
      await notifyNewApplication({
        organizationId: orgId,
        candidateName: `${createdIds.length} candidate(s)`,
        jobTitle: job.title,
        candidateId: createdIds[0],
      }).catch(() => {});
    }

    return NextResponse.json({
      mode: 'import',
      created: createdIds.length,
      skippedDuplicates: skipDuplicates ? duplicates.length : 0,
      failed: importErrors.length,
      errors: importErrors.slice(0, 200),
      createdIds,
    });
  } catch (e) {
    console.error('POST /api/candidates/bulk-import', e);
    return NextResponse.json({ error: 'Failed to process CSV import' }, { status: 500 });
  }
});

/** GET — download a sample CSV template */
export const GET = withPermission('CREATE_CANDIDATE', async () => {
  const sample = [
    'name,email,phone,source,currentTitle,currentCompany,location,experience,skills,tags,linkedInUrl',
    'Jane Doe,jane.doe@example.com,+1-555-0100,referral,Senior Engineer,Acme Inc,"Austin, TX",5,"TypeScript,React,Node",silver-medalist,https://linkedin.com/in/janedoe',
    'John Smith,john.smith@example.com,+1-555-0101,linkedin,Product Designer,Beta Co,Remote,3,"Figma,UX Research",keep-warm,',
  ].join('\n');

  return new NextResponse(sample, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="candidate-import-template.csv"',
      'Cache-Control': 'no-store',
    },
  });
});
