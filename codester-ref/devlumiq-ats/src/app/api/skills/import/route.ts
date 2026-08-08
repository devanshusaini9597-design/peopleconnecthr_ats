import { NextRequest, NextResponse } from 'next/server';
import { withAnyPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import {
  loadBundledSkillsCatalog,
  importSystemSkillsFromCatalog,
  fetchOnetSkillsCatalog,
  type CatalogSkill,
} from '@/lib/skills-catalog';

const MAX_JSON_SKILLS = 5000;

/**
 * POST /api/skills/import
 * Body:
 *   { source: "bundled" }
 *   { source: "json", skills: [{ name, category }] }
 *   { source: "onet" } — requires ONET_API_KEY or ONET_USERNAME+ONET_PASSWORD
 */
export const POST = withAnyPermission(
  ['MANAGE_SETTINGS', 'MANAGE_COMPANY'],
  async (req: NextRequest) => {
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    try {
      const body = await req.json().catch(() => ({}));
      const source = typeof body.source === 'string' ? body.source.trim().toLowerCase() : '';

      if (source === 'bundled') {
        const catalog = loadBundledSkillsCatalog();
        const result = await importSystemSkillsFromCatalog(catalog);
        return NextResponse.json({
          created: result.created,
          skipped: result.skipped,
          total: result.total,
          source: 'bundled',
        });
      }

      if (source === 'json') {
        const raw = body.skills;
        if (!Array.isArray(raw)) {
          return NextResponse.json(
            { error: 'skills must be an array of { name, category }' },
            { status: 400 },
          );
        }
        if (raw.length > MAX_JSON_SKILLS) {
          return NextResponse.json(
            { error: `Maximum ${MAX_JSON_SKILLS} skills per upload` },
            { status: 400 },
          );
        }

        const catalog: CatalogSkill[] = [];
        const seen = new Set<string>();
        for (const item of raw) {
          if (!item || typeof item !== 'object') continue;
          const name = typeof item.name === 'string' ? item.name.trim() : '';
          if (!name || name.length > 120) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const category =
            typeof item.category === 'string' && item.category.trim()
              ? item.category.trim()
              : 'Other';
          const onetCode =
            typeof item.onetCode === 'string' && item.onetCode.trim()
              ? item.onetCode.trim()
              : undefined;
          catalog.push(onetCode ? { name, category, onetCode } : { name, category });
        }

        if (catalog.length === 0) {
          return NextResponse.json({ error: 'No valid skills in upload' }, { status: 400 });
        }

        const result = await importSystemSkillsFromCatalog(catalog);
        return NextResponse.json({
          created: result.created,
          skipped: result.skipped,
          total: result.total,
          source: 'json',
        });
      }

      if (source === 'onet') {
        const fetched = await fetchOnetSkillsCatalog();
        if (!fetched.ok) {
          return NextResponse.json(
            {
              error: fetched.error,
              code: fetched.code,
            },
            { status: fetched.status || 503 },
          );
        }
        const result = await importSystemSkillsFromCatalog(fetched.skills);
        return NextResponse.json({
          created: result.created,
          skipped: result.skipped,
          total: result.total,
          source: 'onet',
          fetched: fetched.skills.length,
        });
      }

      return NextResponse.json(
        {
          error: 'Invalid source. Use "bundled", "json", or "onet".',
        },
        { status: 400 },
      );
    } catch (e) {
      console.error('POST /api/skills/import', e);
      return NextResponse.json({ error: 'Failed to import skills' }, { status: 500 });
    }
  },
);
