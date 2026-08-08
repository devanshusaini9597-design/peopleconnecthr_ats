import { NextRequest, NextResponse } from 'next/server';

/** Public careers APIs may be called from third-party site embeds. */
export function careersCorsHeaders(req?: NextRequest): HeadersInit {
  const origin = req?.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function careersCorsOptions(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: careersCorsHeaders(req) });
}

export function jsonWithCors(req: NextRequest, body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: careersCorsHeaders(req),
  });
}
