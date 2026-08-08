import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const POST = withPermission('USE_RESUME_PARSER', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await prisma.candidate.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const data = await req.json();

    // Parse resume text and extract structured data
    const parsedData = {
      skills: extractSkills(data.rawText),
      experience: extractExperience(data.rawText),
      education: extractEducation(data.rawText),
      name: extractName(data.rawText),
      email: extractEmail(data.rawText),
      phone: extractPhone(data.rawText),
    };

    const resume = await prisma.resume.create({
      data: {
        candidateId: id,
        fileName: data.fileName,
        fileUrl: data.fileUrl || '/uploads/resumes/' + data.fileName,
        rawText: data.rawText,
        parsedData,
      },
    });

    // Update candidate with extracted data (org-scoped)
    await prisma.candidate.update({
      where: { id },
      data: {
        skills: parsedData.skills.length > 0 ? parsedData.skills : undefined,
        resumeText: data.rawText,
        ...(parsedData.name && { name: parsedData.name }),
        ...(parsedData.email && { email: parsedData.email }),
        ...(parsedData.phone && { phone: parsedData.phone }),
      },
    });

    return NextResponse.json({ resume, parsedData }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 });
  }
});

// Simple extraction functions (in production, use AI/ML)
function extractSkills(text: string): string[] {
  const skillKeywords = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'GraphQL', 'Next.js', 'Prisma', 'PostgreSQL', 'MongoDB', 'Redis', 'HTML', 'CSS', 'Tailwind', 'Figma', 'Sketch', 'Adobe XD', 'Python', 'Django', 'Flask', 'Ruby', 'Rails', 'PHP', 'Laravel', 'Go', 'Rust', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'Angular', 'Vue.js'];
  return skillKeywords.filter((skill) => text.toLowerCase().includes(skill.toLowerCase()));
}

function extractExperience(text: string): number {
  const match = text.match(/(\d+)\+?\s*years?\s*(of\s*)?experience/i);
  return match ? parseInt(match[1]) : 0;
}

function extractEducation(text: string): string[] {
  const degrees = ['Bachelor', 'Master', 'PhD', 'MBA', 'BS', 'MS', 'BA', 'MA'];
  return degrees.filter((deg) => text.toLowerCase().includes(deg.toLowerCase()));
}

function extractName(text: string): string | null {
  const lines = text.split('\n').filter((l) => l.trim());
  return lines[0]?.trim() || null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  return match?.[0] || null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4}/);
  return match?.[0] || null;
}
