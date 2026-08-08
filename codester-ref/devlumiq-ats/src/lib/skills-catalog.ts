/**
 * Bundled O*NET-style skills catalog + import helpers.
 * Reads data/onet-skills.json; falls back to SYSTEM_SKILLS_SEED.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { slugifySkill, SYSTEM_SKILLS_SEED } from '@/lib/skills';

export interface CatalogSkill {
  name: string;
  category: string;
  onetCode?: string;
}

const CATALOG_RELATIVE = join('data', 'onet-skills.json');

/** Load bundled catalog from data/onet-skills.json (cwd-relative). */
export function loadBundledSkillsCatalog(): CatalogSkill[] {
  const path = join(process.cwd(), CATALOG_RELATIVE);
  if (!existsSync(path)) {
    return SYSTEM_SKILLS_SEED.map((s) => ({ name: s.name, category: s.category }));
  }
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn('[skills-catalog] onet-skills.json is not an array; using SYSTEM_SKILLS_SEED');
      return SYSTEM_SKILLS_SEED.map((s) => ({ name: s.name, category: s.category }));
    }
    const out: CatalogSkill[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name || name.length > 120) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const category =
        typeof row.category === 'string' && row.category.trim()
          ? row.category.trim()
          : 'Other';
      const onetCode =
        typeof row.onetCode === 'string' && row.onetCode.trim()
          ? row.onetCode.trim()
          : undefined;
      out.push(onetCode ? { name, category, onetCode } : { name, category });
    }
    if (out.length === 0) {
      return SYSTEM_SKILLS_SEED.map((s) => ({ name: s.name, category: s.category }));
    }
    return out;
  } catch (e) {
    console.warn('[skills-catalog] Failed to read catalog; using SYSTEM_SKILLS_SEED', e);
    return SYSTEM_SKILLS_SEED.map((s) => ({ name: s.name, category: s.category }));
  }
}

/**
 * Upsert system skills by slug (same pattern as seed).
 * Skips existing slugs; does not update category on existing rows.
 */
export async function importSystemSkillsFromCatalog(
  catalog: Array<{ name: string; category: string; onetCode?: string }>,
): Promise<{ created: number; skipped: number; total: number }> {
  let created = 0;
  let skipped = 0;

  for (const item of catalog) {
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) {
      skipped++;
      continue;
    }
    const category =
      typeof item.category === 'string' && item.category.trim()
        ? item.category.trim()
        : 'Other';
    const slug = slugifySkill(name);
    if (!slug) {
      skipped++;
      continue;
    }

    const exists = await prisma.skill.findUnique({ where: { slug } });
    if (exists) {
      skipped++;
      continue;
    }

    const description =
      item.onetCode && String(item.onetCode).trim()
        ? `O*NET ${String(item.onetCode).trim()}`
        : null;

    await prisma.skill.create({
      data: {
        name,
        slug,
        category,
        description,
        isSystem: true,
      },
    });
    created++;
  }

  const total = await prisma.skill.count({ where: { isSystem: true } });
  return { created, skipped, total };
}

/** Resolve O*NET Web Services credentials from env (optional BYOK). */
export function getOnetCredentials():
  | { mode: 'api-key'; apiKey: string }
  | { mode: 'basic'; username: string; password: string }
  | null {
  const apiKey = (process.env.ONET_API_KEY || '').trim();
  const username = (process.env.ONET_USERNAME || '').trim();
  const password = (process.env.ONET_PASSWORD || '').trim();

  if (apiKey.includes(':')) {
    const idx = apiKey.indexOf(':');
    const u = apiKey.slice(0, idx).trim();
    const p = apiKey.slice(idx + 1);
    if (u && p) return { mode: 'basic', username: u, password: p };
  }

  if (apiKey) return { mode: 'api-key', apiKey };
  if (username && password) return { mode: 'basic', username, password };
  return null;
}

function onetAuthHeaders(
  creds: NonNullable<ReturnType<typeof getOnetCredentials>>,
): Record<string, string> {
  if (creds.mode === 'api-key') {
    return { Accept: 'application/json', 'X-API-Key': creds.apiKey };
  }
  const token = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
  return { Accept: 'application/json', Authorization: `Basic ${token}` };
}

async function fetchOnetJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        message: text.slice(0, 200) || res.statusText || 'Request failed',
      };
    }
    const data = await res.json().catch(() => null);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : 'Network error',
    };
  }
}

function mapOnetCategory(elementId: string | undefined, fallback: string): string {
  if (!elementId) return fallback;
  if (elementId.startsWith('2.A.') || elementId.startsWith('2.B.1') || elementId.startsWith('2.B.2') || elementId.startsWith('2.B.4') || elementId.startsWith('2.B.5')) {
    return 'Soft Skills';
  }
  if (elementId.startsWith('2.B.3')) return 'Engineering';
  if (elementId.startsWith('1.A.')) return 'Soft Skills';
  if (elementId.startsWith('2.C.1') || elementId.startsWith('2.C.2')) return 'Operations';
  if (elementId.startsWith('2.C.3') || elementId.startsWith('2.C.4')) return 'Engineering';
  if (elementId.startsWith('2.C.7') || elementId.startsWith('2.C.8')) return 'Healthcare';
  if (elementId.startsWith('2.C.9') || elementId.startsWith('2.C.10')) return 'Education';
  return fallback;
}

/**
 * Fetch Skills + Technology Skills from O*NET Web Services.
 * Supports X-API-Key (api-v2) and Basic auth (legacy ws + api-v2).
 */
export async function fetchOnetSkillsCatalog(): Promise<
  | { ok: true; skills: CatalogSkill[] }
  | { ok: false; status: number; code?: string; error: string }
> {
  const creds = getOnetCredentials();
  if (!creds) {
    return {
      ok: false,
      status: 503,
      code: 'ONET_NOT_CONFIGURED',
      error:
        'O*NET Web Services are not configured. Set ONET_API_KEY or ONET_USERNAME+ONET_PASSWORD, or use source: "bundled".',
    };
  }

  const headers = onetAuthHeaders(creds);
  const collected: CatalogSkill[] = [];
  const seen = new Set<string>();

  const push = (name: string, category: string, onetCode?: string) => {
    const n = name.trim();
    if (!n || n.length > 120) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    collected.push(onetCode ? { name: n, category, onetCode } : { name: n, category });
  };

  // Prefer API v2 database rows (content model + technology skills)
  const bases =
    creds.mode === 'api-key'
      ? ['https://api-v2.onetcenter.org']
      : ['https://api-v2.onetcenter.org', 'https://services.onetcenter.org/ws'];

  let authFailed = false;
  let lastError = '';

  for (const base of bases) {
    // Auth probe
    const probeUrl =
      base.includes('api-v2')
        ? `${base}/database/`
        : `${base}/online/occupations/`;
    const probe = await fetchOnetJson(probeUrl, headers);
    if (!probe.ok) {
      if (probe.status === 401 || probe.status === 403) {
        authFailed = true;
        lastError = probe.message;
        continue;
      }
      lastError = probe.message;
      continue;
    }

    if (base.includes('api-v2')) {
      // Content model reference — skills / abilities / knowledge element names
      for (let start = 1; start <= 5000; start += 100) {
        const end = start + 99;
        const url = `${base}/database/rows/content_model_reference?start=${start}&end=${end}`;
        const page = await fetchOnetJson(url, headers);
        if (!page.ok) {
          if (page.status === 401 || page.status === 403) authFailed = true;
          lastError = page.message;
          break;
        }
        const rows = extractRows(page.data);
        if (rows.length === 0) break;
        for (const row of rows) {
          const elementId = str(row.element_id ?? row.elementId);
          const elementName = str(row.element_name ?? row.elementName ?? row.name);
          if (!elementId || !elementName) continue;
          // Skills (2.A/2.B), Abilities (1.A), Knowledge (2.C)
          if (
            elementId.startsWith('2.A.') ||
            elementId.startsWith('2.B.') ||
            elementId.startsWith('1.A.') ||
            elementId.startsWith('2.C.')
          ) {
            push(elementName, mapOnetCategory(elementId, 'Other'), elementId);
          }
        }
        if (rows.length < 100) break;
      }

      // Technology skills examples
      for (let start = 1; start <= 20000; start += 100) {
        const end = start + 99;
        const url = `${base}/database/rows/technology_skills?start=${start}&end=${end}`;
        const page = await fetchOnetJson(url, headers);
        if (!page.ok) {
          if (page.status === 401 || page.status === 403) authFailed = true;
          // Table may not exist / different ID — try alternate once then stop
          if (start === 1) {
            const alt = await fetchOnetJson(
              `${base}/database/rows/tools_used?start=1&end=100`,
              headers,
            );
            if (alt.ok) {
              for (const row of extractRows(alt.data)) {
                const example = str(row.example ?? row.tool_name ?? row.name);
                if (example) push(example, 'Engineering');
              }
            }
          }
          break;
        }
        const rows = extractRows(page.data);
        if (rows.length === 0) break;
        for (const row of rows) {
          const example = str(row.example ?? row.commodity_title ?? row.name);
          if (example) push(example, 'Engineering');
        }
        if (rows.length < 100) break;
        // Cap unique tech skills from live API to keep import bounded
        if (collected.length >= 5000) break;
      }
    } else {
      // Legacy WS: pull a few representative occupation skill/tech summaries
      const occCodes = ['15-1252.00', '15-2051.00', '11-2021.00', '29-1141.00', '13-2011.00'];
      for (const code of occCodes) {
        for (const kind of ['skills', 'technology', 'knowledge', 'abilities'] as const) {
          const url = `${base}/online/occupations/${code}/summary/${kind}`;
          const page = await fetchOnetJson(url, headers);
          if (!page.ok) {
            if (page.status === 401 || page.status === 403) authFailed = true;
            continue;
          }
          const items = extractLegacyElements(page.data);
          for (const it of items) {
            const cat =
              kind === 'technology'
                ? 'Engineering'
                : kind === 'knowledge'
                  ? 'Other'
                  : 'Soft Skills';
            push(it.name, mapOnetCategory(it.id, cat), it.id);
          }
        }
      }
    }

    if (collected.length > 0) break;
  }

  if (collected.length === 0) {
    if (authFailed) {
      return {
        ok: false,
        status: 401,
        code: 'ONET_AUTH_FAILED',
        error:
          'O*NET authentication failed. Check ONET_API_KEY or ONET_USERNAME/ONET_PASSWORD. ' +
          (lastError || ''),
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'ONET_FETCH_FAILED',
      error:
        lastError ||
        'Could not fetch skills from O*NET Web Services. Use source: "bundled" instead.',
    };
  }

  return { ok: true, skills: collected };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

function extractRows(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const row = obj.row ?? obj.rows ?? obj.data;
  if (Array.isArray(row)) {
    return row.filter((r) => r && typeof r === 'object') as Array<Record<string, unknown>>;
  }
  if (row && typeof row === 'object') return [row as Record<string, unknown>];
  return [];
}

function extractLegacyElements(
  data: unknown,
): Array<{ name: string; id?: string }> {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const candidates = [obj.element, obj.skill, obj.category, obj.technology];
  const out: Array<{ name: string; id?: string }> = [];
  for (const c of candidates) {
    const list = Array.isArray(c) ? c : c ? [c] : [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const name = str(r.name ?? r.title ?? r.example);
      const id = str(r.id ?? r.element_id) || undefined;
      if (name) out.push({ name, id });
      // Nested examples under technology categories
      const examples = r.example;
      if (Array.isArray(examples)) {
        for (const ex of examples) {
          if (typeof ex === 'string') out.push({ name: ex });
          else if (ex && typeof ex === 'object') {
            const n = str((ex as Record<string, unknown>).name ?? (ex as Record<string, unknown>).title);
            if (n) out.push({ name: n });
          }
        }
      }
    }
  }
  return out;
}
