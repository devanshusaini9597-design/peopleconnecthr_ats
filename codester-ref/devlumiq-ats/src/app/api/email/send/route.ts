import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { withPermission } from '@/lib/with-permission';

export const POST = withPermission('USE_EMAIL_TEMPLATES', async (req: NextRequest, _ctx, session) => {
  try {
    const data = await req.json();
    const { candidate, job, template, subject: preSubject, body: preBody } = data;

    const jobTitle = job?.title ?? candidate?.position ?? 'Position';

    // Resolve org name dynamically — never hardcode
    let companyName = 'Recruitment Team';
    if (session.organizationId) {
      const org = await prisma.company.findUnique({
        where: { id: session.organizationId },
        select: { name: true },
      });
      if (org?.name) companyName = org.name;
    }

    let finalSubject: string;
    let finalBody: string;

    // Case 1: frontend already pre-rendered subject + body (premium email page)
    if (typeof preSubject === 'string' && typeof preBody === 'string') {
      finalSubject = preSubject;
      finalBody = preBody;
    }
    // Case 2: template object with raw subject/body containing {{variables}} (candidates page)
    else if (template && typeof template === 'object' && typeof template.subject === 'string') {
      const interpolate = (s: string) =>
        s
          .replace(/\{\{candidateName\}\}/g, candidate?.name ?? '')
          .replace(/\{\{name\}\}/g, candidate?.name ?? '')
          .replace(/\{\{position\}\}/g, jobTitle)
          .replace(/\{\{companyName\}\}/g, companyName)
          .replace(/\{\{interviewDate\}\}/g, data.interviewDate || '[Date]')
          .replace(/\{\{interviewTime\}\}/g, data.interviewTime || '[Time]')
          .replace(/\{\{interviewerName\}\}/g, data.interviewerName || '[Interviewer]')
          .replace(/\{\{salary\}\}/g, data.salary || '[Salary]')
          .replace(/\{\{startDate\}\}/g, data.startDate || '[Start Date]');
      finalSubject = interpolate(template.subject);
      finalBody = interpolate(template.body ?? '');
    }
    // Fallback: generic message
    else {
      finalSubject = `Message for ${candidate?.name ?? 'candidate'}`;
      finalBody = 'Please see the details attached.';
    }

    const recipientEmail = candidate?.email ?? '';
    const sentAt = new Date().toISOString();

    // Attempt real send if SMTP is configured; degrade gracefully in dev
    let emailSent = false;
    if (recipientEmail && process.env.SMTP_HOST && process.env.SMTP_USER) {
      emailSent = await sendEmail({
        to: recipientEmail,
        subject: finalSubject,
        html: `<div style="font-family:sans-serif;line-height:1.6">${finalBody.replace(/\n/g, '<br>')}</div>`,
        text: finalBody,
      });
    }

    return NextResponse.json({
      success: true,
      delivered: emailSent,
      email: {
        to: recipientEmail,
        subject: finalSubject,
        body: finalBody,
        sentAt,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
});
