import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/file-storage';
import { sendEmail, generateApplicationConfirmationEmail, generateNewApplicationNotificationEmail } from '@/lib/email';
import { notifyNewApplication } from '@/lib/push';
import { careersCorsHeaders, careersCorsOptions, jsonWithCors } from '@/lib/careers-cors';

export async function OPTIONS(req: NextRequest) {
  return careersCorsOptions(req);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const jobId = formData.get('jobId') as string;
    const coverLetter = formData.get('coverLetter') as string;
    const linkedin = formData.get('linkedin') as string;
    const portfolio = formData.get('portfolio') as string;
    const resume = formData.get('resume') as File | null;

    // Validation
    if (!name || !email || !jobId) {
      return jsonWithCors(request, { error: 'Name, email, and job selection are required' }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonWithCors(request, { error: 'Invalid email address' }, { status: 400 });
    }

    // Check if job exists and is active
    const job = await prisma.job.findFirst({
      where: { id: jobId, status: 'Active' },
    });

    if (!job) {
      return jsonWithCors(request, { error: 'Job not found or no longer accepting applications' }, { status: 404 });
    }

    // Handle resume upload
    let resumeUrl = null;
    let resumeText = null;

    if (resume && resume.size > 0) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(resume.type)) {
        return jsonWithCors(request, { error: 'Invalid file type. Please upload PDF or Word document.' }, { status: 400 });
      }

      // Validate file size (max 5MB)
      if (resume.size > 5 * 1024 * 1024) {
        return jsonWithCors(request, { error: 'File size too large. Maximum 5MB allowed.' }, { status: 400 });
      }

      // Save via shared storage (S3/R2, or private local storage/uploads — not public/)
      const bytes = await resume.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const safeName = resume.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `resumes/${Date.now()}-${safeName}`;
      const uploaded = await uploadFile(buffer, key, resume.type || 'application/octet-stream');
      resumeUrl = uploaded.url;
      resumeText = resume.name;
    }

    // Check if candidate already exists within this org (email uniqueness is now per-org)
    const candidateWhere: any = { email };
    if (job.companyId) candidateWhere.organizationId = job.companyId;
    let candidate = await prisma.candidate.findFirst({
      where: candidateWhere,
    });

    if (candidate) {
      // Update existing candidate
      candidate = await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          name,
          phone: phone || candidate.phone,
          resumeUrl: resumeUrl || candidate.resumeUrl,
          resumeText: resumeText || candidate.resumeText,
          source: 'Career Portal',
        },
      });
    } else {
      // Create new candidate tied to the job's company
      const candidateData: any = {
        name,
        email,
        phone,
        resumeUrl,
        resumeText,
        source: 'Career Portal',
      };
      if (job.companyId) candidateData.organizationId = job.companyId;
      candidate = await prisma.candidate.create({ data: candidateData });
    }

    // Check if already applied to this job
    const existingApplication = await prisma.application.findFirst({
      where: {
        candidateId: candidate.id,
        jobId: jobId,
      },
    });

    if (existingApplication) {
      return jsonWithCors(request, { error: 'You have already applied for this position' }, { status: 409 });
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: jobId,
        stage: 'Applied',
      },
    });

    // Non-fatal analytics — never break apply for existing buyers
    try {
      const { recordSourceEvent, recordPipelineStageChange } = await import('@/lib/analytics-metrics');
      if (job.companyId) {
        await recordSourceEvent({
          organizationId: job.companyId,
          source: candidate.source || 'careers',
          event: 'applicant',
        });
        await recordPipelineStageChange({
          jobId,
          stageName: 'APPLIED',
          organizationId: job.companyId,
        });
      }
    } catch {
      /* non-fatal */
    }

    // Voluntary EEO self-ID (optional, stored separately from hiring data)
    const organizationId = job.companyId;
    if (organizationId) {
      const declined = formData.get('declinedToSelfId') === 'true';
      const gender = (formData.get('gender') as string) || '';
      const ethnicity = (formData.get('ethnicity') as string) || '';
      const veteranStatus = (formData.get('veteranStatus') as string) || '';
      const disability = (formData.get('disability') as string) || '';
      if (declined || gender || ethnicity || veteranStatus || disability) {
        const deiSettings = await prisma.orgDeiSettings.findUnique({ where: { organizationId } });
        if (!deiSettings || deiSettings.selfIdFormEnabled !== false) {
          await prisma.candidateSelfId.create({
            data: {
              organizationId,
              candidateId: candidate.id,
              applicationId: application.id,
              gender: gender || null,
              ethnicity: ethnicity || null,
              veteranStatus: veteranStatus || null,
              disability: disability || null,
              declinedToSelfId: declined,
            },
          }).catch(() => {});
        }
      }
    }

    // Update job applicant count
    await prisma.job.update({
      where: { id: jobId },
      data: { applicants: { increment: 1 } },
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        type: 'candidate_added',
        payload: JSON.stringify({
          candidateId: candidate.id,
          candidateName: candidate.name,
          jobId: jobId,
          jobTitle: job.title,
          source: 'Career Portal',
        }),
      },
    });

    // Send confirmation email to candidate
    const confirmationEmail = generateApplicationConfirmationEmail(name, job.title);
    await sendEmail({
      to: email,
      subject: confirmationEmail.subject,
      html: confirmationEmail.html,
      text: confirmationEmail.text,
    });

    // Send notification email to hiring team
    const notificationEmail = generateNewApplicationNotificationEmail(
      name,
      email,
      job.title,
      candidate.id
    );
    await sendEmail({
      to: process.env.HIRING_TEAM_EMAIL || process.env.SMTP_USER || 'hiring@company.com',
      subject: notificationEmail.subject,
      html: notificationEmail.html,
      text: notificationEmail.text,
    });

    // Web push to org recruiters (no-op if VAPID not configured)
    await notifyNewApplication({
      organizationId: organizationId ?? null,
      candidateName: name,
      jobTitle: job.title,
      candidateId: candidate.id,
    }).catch(() => {});

    return jsonWithCors(request, {
      success: true,
      message: 'Application submitted successfully',
      applicationId: application.id,
    });

  } catch (error) {
    console.error('Error submitting application:', error);
    return NextResponse.json(
      { error: 'Failed to submit application. Please try again.' },
      { status: 500, headers: careersCorsHeaders(request) },
    );
  }
}
