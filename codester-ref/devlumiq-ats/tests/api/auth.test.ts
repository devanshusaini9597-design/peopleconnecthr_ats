import { describe, it, expect } from 'vitest';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';

function makeRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('Authentication API', () => {
  describe('POST /api/auth/login', () => {
    it('returns 400 when email is missing', async () => {
      const response = await loginHandler(makeRequest('http://localhost/api/auth/login', { email: '', password: 'Demo@1234' }));
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('returns 400 when password is missing', async () => {
      const response = await loginHandler(makeRequest('http://localhost/api/auth/login', { email: 'admin@devlumiq.com', password: '' }));
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('returns 401 for invalid credentials', async () => {
      const response = await loginHandler(makeRequest('http://localhost/api/auth/login', { email: 'nobody@example.com', password: 'wrongpassword' }));
      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/auth/register', () => {
    it('returns 400 for invalid email format', async () => {
      const response = await registerHandler(makeRequest('http://localhost/api/auth/register', {
        email: 'not-an-email',
        password: 'Password1!',
        name: 'Test User',
      }));
      expect(response.status).toBe(400);
    });

    it('returns 400 when password is too short (< 8 chars)', async () => {
      const response = await registerHandler(makeRequest('http://localhost/api/auth/register', {
        email: 'test@example.com',
        password: 'abc',
        name: 'Test User',
      }));
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/8/);
    });

    it('returns 400 when name is missing', async () => {
      const response = await registerHandler(makeRequest('http://localhost/api/auth/register', {
        email: 'test@example.com',
        password: 'Password1!',
        name: '',
      }));
      expect(response.status).toBe(400);
    });
  });
});
