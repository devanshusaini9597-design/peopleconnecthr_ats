import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => new Map()),
}));

// Mock Next.js request
vi.mock('next/server', () => ({
  NextRequest: class NextRequest {
    constructor(input: string | URL, init?: RequestInit) {
      return new Request(input, init) as any;
    }
  },
  NextResponse: {
    json: (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    }),
    redirect: (url: string | URL, init?: ResponseInit) => new Response(null, {
      status: 302,
      headers: { Location: url.toString(), ...init?.headers },
    }),
  },
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    candidate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    job: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    jobBoardIntegration: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    messageThread: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      updateMany: vi.fn(),
    },
    interviewEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    interviewScore: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    resume: {
      create: vi.fn(),
    },
    backgroundCheck: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    eSignatureRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    integration: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    integrationAuth: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    webhookEvent: {
      create: vi.fn(),
    },
    webhook: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    jobApplicationForm: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    referral: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    referralProgram: {
      findFirst: vi.fn(),
    },
    emailSequence: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    emailSequenceEnrollment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    offerLetter: {
      findFirst: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
    },
    scheduledEmail: {
      create: vi.fn(),
    },
  },
}));

// Environment variables for testing
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.CHECKR_API_KEY = '';
process.env.DOCUSIGN_CLIENT_ID = '';
process.env.DOCUSIGN_CLIENT_SECRET = '';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ZAPIER_WEBHOOK_URL = '';

// Global test utilities
global.fetch = vi.fn();

// Suppress console errors in tests unless explicitly testing them
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning:')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};
