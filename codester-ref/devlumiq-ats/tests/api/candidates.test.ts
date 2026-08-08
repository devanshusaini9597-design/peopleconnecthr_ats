import { describe, it, expect } from 'vitest';
import { GET as getCandidatesHandler, POST as createCandidateHandler } from '@/app/api/candidates/route';

describe('Candidates API — RBAC enforcement', () => {
  describe('GET /api/candidates', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = new Request('http://localhost/api/candidates') as any;
      const response = await getCandidatesHandler(req, {});
      expect(response.status).toBe(401);
    });

    it('returns 401 with invalid session cookie', async () => {
      const req = new Request('http://localhost/api/candidates', {
        headers: { Cookie: 'ats_session=bad-token' },
      }) as any;
      const response = await getCandidatesHandler(req, {});
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/candidates', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = new Request('http://localhost/api/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
      }) as any;
      req.nextUrl = new URL('http://localhost/api/candidates');
      const response = await createCandidateHandler(req, {});
      expect(response.status).toBe(401);
    });
  });
});
