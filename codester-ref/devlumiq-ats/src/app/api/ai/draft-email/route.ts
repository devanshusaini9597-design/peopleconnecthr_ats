import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/with-permission';
import { isAIEnabled, draftEmailWithAI } from '@/lib/ai';
import { hasFeature } from '@/lib/plan-limits';
import { getPlanContext } from '@/lib/with-plan';

// POST /api/ai/draft-email — Draft a professional email using AI
// Falls back to pre-built templates if AI is not configured
export const POST = withPermission('USE_EMAIL_TEMPLATES', async (request: NextRequest, _ctx, session) => {
  try {
    // Plan feature gate: AI email drafting requires AI-enabled plan
    if (session?.organizationId) {
      const { plan } = await getPlanContext(session.organizationId);
      if (!hasFeature(plan, 'ai')) {
        return NextResponse.json({ error: 'AI features require a STARTER or higher plan.', code: 'PLAN_UPGRADE_REQUIRED' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { type, candidateName, jobTitle, companyName, senderName, customInstructions, interviewDate, interviewTime, salary } = body;

    if (!type || !candidateName) {
      return NextResponse.json({ error: 'type and candidateName are required' }, { status: 400 });
    }

    // ── AI Drafting ───────────────────────────────────────────────────────
    if (isAIEnabled()) {
      const aiResult = await draftEmailWithAI({
        type, candidateName, jobTitle, companyName, senderName,
        customInstructions, interviewDate, interviewTime, salary,
      });
      if (aiResult) {
        return NextResponse.json({ ...aiResult, method: 'ai' });
      }
    }

    // ── Fallback: Pre-built templates ─────────────────────────────────────
    const company = companyName || 'Our Company';
    const sender = senderName || 'Recruitment Team';
    const job = jobTitle || 'the position';

    const templates: Record<string, { subject: string; body: string }> = {
      outreach: {
        subject: `Exciting Opportunity: ${job} at ${company}`,
        body: `Dear ${candidateName},\n\nI came across your profile and was impressed by your experience. We have an exciting opportunity for a ${job} at ${company} that I think would be a great fit for your skills.\n\nWould you be open to a brief conversation to learn more about this role?\n\nBest regards,\n${sender}`,
      },
      rejection: {
        subject: `Update on Your Application — ${company}`,
        body: `Dear ${candidateName},\n\nThank you for your interest in the ${job} position at ${company} and for taking the time to go through our interview process.\n\nAfter careful consideration, we have decided to move forward with another candidate whose experience more closely aligns with our current needs. This was a difficult decision, as we were impressed by your qualifications.\n\nWe encourage you to apply for future openings that match your profile. We wish you the very best in your career.\n\nWarm regards,\n${sender}`,
      },
      interview_invite: {
        subject: `Interview Invitation: ${job} at ${company}`,
        body: `Dear ${candidateName},\n\nWe are pleased to invite you to an interview for the ${job} position at ${company}.\n\n${interviewDate ? `Date: ${interviewDate}` : 'We would like to schedule this at your earliest convenience.'}${interviewTime ? `\nTime: ${interviewTime}` : ''}\n\nPlease confirm your availability or suggest alternative times that work for you.\n\nLooking forward to speaking with you.\n\nBest regards,\n${sender}`,
      },
      offer: {
        subject: `Job Offer: ${job} at ${company}`,
        body: `Dear ${candidateName},\n\nWe are delighted to extend an offer for the ${job} position at ${company}. After our thorough evaluation process, we are confident that you will be a valuable addition to our team.\n\n${salary ? `Compensation: ${salary}\n\n` : ''}Please review the attached offer letter for complete details regarding compensation, benefits, and start date. We kindly ask you to respond within 5 business days.\n\nWe are excited about the possibility of you joining our team!\n\nBest regards,\n${sender}`,
      },
      follow_up: {
        subject: `Following Up — ${job} at ${company}`,
        body: `Dear ${candidateName},\n\nI wanted to follow up regarding the ${job} position at ${company}. We enjoyed our conversation and would love to keep the process moving forward.\n\nPlease let us know if you have any questions or need additional information.\n\nBest regards,\n${sender}`,
      },
      custom: {
        subject: `Message from ${company}`,
        body: `Dear ${candidateName},\n\n${customInstructions || 'We wanted to reach out regarding your application.'}\n\nBest regards,\n${sender}`,
      },
    };

    const template = templates[type] || templates.custom;

    return NextResponse.json({
      subject: template.subject,
      body: template.body,
      tone: 'professional',
      method: 'template',
    });
  } catch (error) {
    console.error('[AI Draft Email] Error:', error);
    return NextResponse.json({ error: 'Failed to draft email' }, { status: 500 });
  }
});
