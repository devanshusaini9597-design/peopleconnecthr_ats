import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callAI, isAIEnabled } from '@/lib/ai';
import { rateLimitAsync } from '@/lib/rate-limit';
import { careersCorsOptions, jsonWithCors } from '@/lib/careers-cors';

type FaqItem = { q: string; a: string; keywords: string[] };

const DEFAULT_FAQ: FaqItem[] = [
  {
    q: 'How do I apply?',
    a: 'I can walk you through applying here in chat — say “help me apply” — or open any role and submit your resume on the job page.',
    keywords: ['apply', 'application', 'submit', 'how to apply'],
  },
  {
    q: 'What is the hiring process?',
    a: 'Typical steps: application review → recruiter screen → interviews → offer. Timing varies by role; I can help you find a matching open position to get started.',
    keywords: ['process', 'hiring', 'interview', 'timeline', 'steps'],
  },
  {
    q: 'Do you offer remote roles?',
    a: 'Some roles are remote or hybrid. Check the location field on each job listing, or tell me you want remote and I will list matching openings.',
    keywords: ['remote', 'hybrid', 'work from home', 'wfh'],
  },
  {
    q: 'Can I update my application?',
    a: 'Reply to your confirmation email or use the contact link on this page with your name and the role you applied for. A recruiter will help update your materials.',
    keywords: ['update', 'change', 'edit application', 'resume'],
  },
];

function parseCompanyFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const q = typeof o.q === 'string' ? o.q : typeof o.question === 'string' ? o.question : '';
      const a = typeof o.a === 'string' ? o.a : typeof o.answer === 'string' ? o.answer : '';
      const keywords = Array.isArray(o.keywords)
        ? o.keywords.filter((k): k is string => typeof k === 'string')
        : [];
      if (!q || !a) return null;
      return { q, a, keywords };
    })
    .filter((x): x is FaqItem => x != null);
}

function matchFaq(message: string, faq: FaqItem[]): string | null {
  const lower = message.toLowerCase();
  for (const item of faq) {
    if (item.keywords.some((k) => lower.includes(k.toLowerCase()))) return item.a;
    if (item.q && lower.includes(item.q.toLowerCase().slice(0, 24))) return item.a;
  }
  return null;
}

function suggestJobs(
  jobs: Array<{ id: string; title: string; department: string; location: string; type: string; description: string | null; requirements: string | null }>,
  message: string,
  limit = 5,
) {
  const tokens = message
    .toLowerCase()
    .split(/[^a-z0-9+#.]/i)
    .filter((t) => t.length > 2);
  const scored = jobs.map((j) => {
    const hay = `${j.title} ${j.department} ${j.location} ${j.type} ${j.description || ''} ${j.requirements || ''}`.toLowerCase();
    const score = tokens.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
    return { job: j, score };
  });
  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.job);
  if (matched.length) return matched;
  return jobs.slice(0, limit);
}

export async function OPTIONS(req: NextRequest) {
  return careersCorsOptions(req);
}

/**
 * POST /api/careers/chatbot — public career-site assistant
 * Body: { message, companySlug?, history?, email? }
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'anon';
    const rl = await rateLimitAsync(`careers-chatbot:${ip}`, 30, 15 * 60 * 1000);
    if (!rl.success) {
      return jsonWithCors(req, { error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const companySlug = typeof body.companySlug === 'string' ? body.companySlug : null;
    const handoffEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

    if (!message || message.length > 1000) {
      return jsonWithCors(req, { error: 'message is required (max 1000 chars)' }, { status: 400 });
    }

    let companyId: string | undefined;
    let companyName = 'our company';
    let faqList = DEFAULT_FAQ;
    if (companySlug) {
      const company = await prisma.company.findUnique({
        where: { slug: companySlug },
        select: { id: true, name: true, careersFaq: true },
      });
      if (company) {
        companyId = company.id;
        companyName = company.name;
        const custom = parseCompanyFaq(company.careersFaq);
        // Company FAQ first, then default fallback for unmatched keywords
        faqList = custom.length ? [...custom, ...DEFAULT_FAQ] : DEFAULT_FAQ;
      }
    }

    // Handoff / lead capture
    if (handoffEmail || /human|recruiter|talk to someone|email me|contact/i.test(message)) {
      if (handoffEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handoffEmail)) {
        await prisma.activityLog
          .create({
            data: {
              type: 'careers_chatbot_handoff',
              payload: {
                email: handoffEmail,
                message,
                companySlug,
                companyId: companyId ?? null,
              },
            },
          })
          .catch(() => {});
        return jsonWithCors(req, {
          reply:
            `Thanks — we've noted ${handoffEmail}. A recruiter from ${companyName} will follow up when possible. Meanwhile you can keep browsing open roles above.`,
          handoff: true,
          suggestedJobs: [],
          faq: false,
          startApply: false,
        });
      }
      if (/human|recruiter|talk to someone/i.test(message) && !handoffEmail) {
        return jsonWithCors(req, {
          reply:
            'I can connect you with a human. Share your email (and optionally the role you’re interested in), and a recruiter will follow up.',
          handoff: true,
          needsEmail: true,
          suggestedJobs: [],
          startApply: false,
        });
      }
    }

    const jobs = await prisma.job.findMany({
      where: {
        status: 'Active',
        ...(companyId ? { companyId } : {}),
      },
      take: 40,
      orderBy: { postedAt: 'desc' },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        description: true,
        requirements: true,
      },
    });

    const wantsApply =
      /help me apply|start apply|apply now|i want to apply|guided apply|submit application|apply for/i.test(
        message,
      );
    const wantsRoles =
      wantsApply ||
      /job|role|position|opening|hiring|engineer|designer|manager|remote|match|fit|looking for/i.test(
        message,
      );
    const suggested = wantsRoles ? suggestJobs(jobs, message) : [];

    if (wantsApply) {
      return jsonWithCors(req, {
        reply:
          suggested.length > 0
            ? 'I can walk you through applying step by step. Choose a role (or tell me which one), then I’ll collect your details and resume.'
            : 'There aren’t matching open roles right now. Tell me your skills/location, or share your email for a recruiter follow-up.',
        suggestedJobs: suggested.map((j) => ({
          id: j.id,
          title: j.title,
          department: j.department,
          location: j.location,
          type: j.type,
        })),
        startApply: suggested.length > 0,
        faq: false,
        handoff: false,
      });
    }

    const faqAnswer = matchFaq(message, faqList);

    const jobDigest = jobs
      .slice(0, 15)
      .map((j) => `- ${j.title} (${j.department}, ${j.location}, ${j.type})`)
      .join('\n');

    let reply = faqAnswer;

    if (!reply && isAIEnabled()) {
      const historyText = history
        .map((h: { role?: string; content?: string }) => `${h.role || 'user'}: ${h.content || ''}`)
        .join('\n');
      const ai = await callAI({
        systemPrompt: `You are a helpful careers-site assistant for ${companyName}.
Answer briefly (2–4 sentences) about open roles, applying, and company FAQs.
Only recommend jobs from the provided list. If unsure, ask a clarifying question.
Never invent benefits, salary, or policies not in the context.
If the user wants to apply, tell them to say "help me apply" or click Apply with assistant.
If the user needs a human, ask for their email.`,
        userPrompt: `Open roles:\n${jobDigest || '(none listed)'}\n\nFAQ hints:\n${faqList.map((f) => `${f.q}: ${f.a}`).join('\n')}\n\nRecent chat:\n${historyText}\n\nUser: ${message}`,
        temperature: 0.3,
        maxTokens: 400,
      });
      if (ai?.content) reply = ai.content.trim();
    }

    if (!reply) {
      if (suggested.length) {
        reply = `Based on what you shared, here are roles that may fit. Open any to apply, tap “Apply with assistant”, or say “help me apply”.`;
      } else if (jobs.length) {
        reply = `We have ${jobs.length} open role(s) right now. Tell me your skills, preferred location, or department (e.g. Engineering, Design) and I’ll suggest matches. You can also say “help me apply”.`;
      } else {
        reply = `There aren’t any open roles listed at the moment. Share your email if you’d like a recruiter to contact you about future openings.`;
      }
    }

    return jsonWithCors(req, {
      reply,
      suggestedJobs: suggested.map((j) => ({
        id: j.id,
        title: j.title,
        department: j.department,
        location: j.location,
        type: j.type,
      })),
      faq: Boolean(faqAnswer),
      ai: isAIEnabled() && !faqAnswer,
      handoff: false,
      startApply: false,
    });
  } catch (e) {
    console.error('POST /api/careers/chatbot', e);
    return jsonWithCors(req, { error: 'Chatbot unavailable' }, { status: 500 });
  }
}
