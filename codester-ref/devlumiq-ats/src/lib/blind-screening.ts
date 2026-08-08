/**
 * Blind screening helpers — mask PII / identity fields when org setting is on.
 * Does not delete data; only shapes API/UI payloads.
 */

import { prisma } from '@/lib/prisma';

export interface BlindableCandidate {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  websiteUrl?: string | null;
  currentCompany?: string | null;
  resumeUrl?: string | null;
  resumeParsed?: unknown;
  resumeText?: string | null;
  [key: string]: unknown;
}

const SCHOOL_KEYS = [
  'school', 'university', 'college', 'institution', 'education',
  'degree', 'almaMater', 'gradSchool',
];

function scrubEducation(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (Array.isArray(parsed)) {
    return parsed.map((item) => {
      if (item && typeof item === 'object') {
        const copy = { ...(item as Record<string, unknown>) };
        for (const k of Object.keys(copy)) {
          if (SCHOOL_KEYS.some((s) => k.toLowerCase().includes(s))) {
            copy[k] = '[hidden]';
          }
        }
        return copy;
      }
      return item;
    });
  }
  const obj = { ...(parsed as Record<string, unknown>) };
  for (const k of Object.keys(obj)) {
    const lower = k.toLowerCase();
    if (SCHOOL_KEYS.some((s) => lower.includes(s))) {
      if (Array.isArray(obj[k])) {
        obj[k] = scrubEducation(obj[k]);
      } else if (typeof obj[k] === 'string') {
        obj[k] = '[hidden]';
      } else if (obj[k] && typeof obj[k] === 'object') {
        obj[k] = scrubEducation(obj[k]);
      }
    }
    if (lower === 'education' || lower === 'educations') {
      obj[k] = scrubEducation(obj[k]);
    }
  }
  return obj;
}

function scrubGenderCoded(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  // Light redaction of common pronouns / gendered honorifics in free text
  return text
    .replace(/\b(he|him|his|she|her|hers|mr\.?|mrs\.?|ms\.?|miss)\b/gi, '[…]')
    .replace(/\b(male|female|man|woman|boy|girl)\b/gi, '[…]');
}

export function applyBlindScreening<T extends BlindableCandidate>(
  candidate: T,
  enabled: boolean,
  opts?: { revealForRoles?: boolean },
): T {
  if (!enabled || opts?.revealForRoles) return candidate;

  const masked = { ...candidate };
  masked.name = 'Candidate';
  masked.email = 'hidden@blind.local';
  masked.phone = null;
  masked.avatarUrl = null;
  masked.linkedInUrl = null;
  masked.githubUrl = null;
  masked.portfolioUrl = null;
  masked.websiteUrl = null;
  masked.currentCompany = null;
  masked.resumeUrl = null;
  if (masked.resumeParsed) {
    masked.resumeParsed = scrubEducation(masked.resumeParsed);
  }
  if (typeof masked.resumeText === 'string') {
    masked.resumeText = scrubGenderCoded(masked.resumeText);
  }
  return masked;
}

export function blindLabel(index: number): string {
  return `Candidate ${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) || ''}`;
}

/** ADMIN always sees PII; other roles respect org DEI toggle. */
export function shouldBlindScreen(role: string | undefined | null, enabled: boolean): boolean {
  return Boolean(enabled && role && role !== 'ADMIN');
}

export async function isOrgBlindScreeningEnabled(
  organizationId: string | null | undefined,
): Promise<boolean> {
  if (!organizationId) return false;
  const dei = await prisma.orgDeiSettings.findUnique({
    where: { organizationId },
    select: { blindScreeningEnabled: true },
  });
  return Boolean(dei?.blindScreeningEnabled);
}

/** Mask a candidate-shaped payload for list/search responses. */
export function maskCandidateForList<T extends BlindableCandidate>(
  candidate: T,
  index: number,
  enabled: boolean,
): T & { blindScreening: boolean } {
  if (!enabled) return { ...candidate, blindScreening: false };
  const masked = applyBlindScreening(candidate, true);
  return {
    ...masked,
    name: blindLabel(index),
    blindScreening: true,
  };
}
