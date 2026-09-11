/** Detect resume preview kind from path, Content-Type, and optional file header bytes. */

export function detectResumeFileKind(resumePath, contentType = '') {
  const ext = String(resumePath || '')
    .split('?')[0]
    .split('.')
    .pop()
    ?.toLowerCase() || '';
  const mime = String(contentType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || mime.startsWith('image/')) return 'image';
  if (ext === 'docx' || mime.includes('wordprocessingml')) return 'docx';
  if (ext === 'doc' || mime.includes('msword')) return 'doc';
  return 'unknown';
}

export function sniffResumeKindFromBytes(bytes, resumePath, contentType = '') {
  const head = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const ascii = String.fromCharCode(...head.slice(0, 32)).toLowerCase();
  if (ascii.trimStart().startsWith('<!doctype') || ascii.trimStart().startsWith('<html')) {
    return 'html_error';
  }

  let kind = detectResumeFileKind(resumePath, contentType);
  const isZip = head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
  const isOle = head.length >= 2 && head[0] === 0xd0 && head[1] === 0xcf;
  const isPdf = String.fromCharCode(...head.slice(0, 5)).startsWith('%PDF');
  const isJpeg = head.length >= 2 && head[0] === 0xff && head[1] === 0xd8;
  const isPng = head.length >= 4 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;

  if (kind === 'doc' && isZip) return 'docx';
  if (kind !== 'unknown') return kind;
  if (isPdf) return 'pdf';
  if (isZip) return 'docx';
  if (isOle) return 'doc';
  if (isJpeg || isPng) return 'image';
  return 'unknown';
}

export function mimeForResumeKind(kind, contentType = '') {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'image') {
    const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (mime.startsWith('image/')) return mime;
    return 'image/jpeg';
  }
  if (kind === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (kind === 'doc') return 'application/msword';
  return String(contentType || '').split(';')[0].trim() || 'application/octet-stream';
}

export function canInlinePreview(kind) {
  return kind === 'pdf' || kind === 'image' || kind === 'docx';
}
