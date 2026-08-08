import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';
import { getLocalUploadRoot } from '@/lib/file-storage';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Authenticated file serve for local storage uploads.
 * Files live under storage/uploads (not public/), so they are not world-readable.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path: segments } = await context.params;
  if (!segments?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Reject path traversal and absolute segments
  if (segments.some((s) => !s || s === '.' || s === '..' || s.includes('\0'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const root = path.resolve(getLocalUploadRoot());
  const filePath = path.resolve(root, ...segments);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
