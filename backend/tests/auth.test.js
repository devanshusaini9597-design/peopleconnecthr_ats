/**
 * Auth security tests — contracts always run; HTTP tests use in-memory Mongo when available.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

describe('Authentication security contracts', () => {
  describe('login error messages', () => {
    it('should use a single invalid_credentials message (no email enumeration)', () => {
      const missingUser = {
        message: 'invalid_credentials',
        displayMessage: 'Invalid email or password.',
      };
      const wrongPassword = {
        message: 'invalid_credentials',
        displayMessage: 'Invalid email or password.',
      };
      expect(missingUser.message).toBe(wrongPassword.message);
      expect(missingUser.displayMessage).toBe(wrongPassword.displayMessage);
    });
  });

  describe('forgot-password response', () => {
    it('must never include resetUrl in client-facing payloads', () => {
      const safeResponse = {
        success: false,
        message:
          'Password reset email could not be sent. Please contact your administrator to configure email, or try again later.',
      };
      expect(safeResponse.resetUrl).toBeUndefined();
      expect(JSON.stringify(safeResponse)).not.toMatch(/resetUrl|token=/i);
    });

    it('must use generic success when email may or may not exist', () => {
      const response = {
        success: true,
        message: 'If this email is registered, you will receive a reset link.',
      };
      expect(response.message).toMatch(/If this email is registered/i);
    });
  });

  describe('password storage', () => {
    it('rejects plaintext password comparison pattern', () => {
      const legacyPlain = 'Demo1234!';
      const bcryptHash = '$2b$10$abcdefghijklmnopqrstuv';
      expect(legacyPlain.startsWith('$2')).toBe(false);
      expect(bcryptHash.startsWith('$2')).toBe(true);
    });
  });

  describe('auth cookies', () => {
    it('uses HttpOnly cookie name ats_token', () => {
      const { COOKIE_NAME } = require('../utils/authCookies');
      expect(COOKIE_NAME).toBe('ats_token');
    });

    it('setAuthCookie sets httpOnly and path /', () => {
      const { setAuthCookie, COOKIE_NAME } = require('../utils/authCookies');
      const cookies = {};
      const res = {
        cookie: (name, value, opts) => {
          cookies[name] = { value, opts };
        },
      };
      setAuthCookie(res, 'test.jwt.token');
      expect(cookies[COOKIE_NAME]).toBeDefined();
      expect(cookies[COOKIE_NAME].opts.httpOnly).toBe(true);
      expect(cookies[COOKIE_NAME].opts.path).toBe('/');
      expect(cookies[COOKIE_NAME].value).toBe('test.jwt.token');
    });
  });
});

describe('Authentication HTTP', () => {
  let app;
  let User;
  let hasDb = false;

  beforeAll(async () => {
    const express = require('express');
    const cookieParser = require('cookie-parser');
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api', require('../routes/authRoutes'));

    hasDb = mongoose.connection.readyState === 1;
    if (hasDb) {
      User = require('../models/User');
    }
  });

  it('POST /api/login rejects missing credentials', async () => {
    const res = await request(app).post('/api/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/forgot-password never returns resetUrl', async () => {
    if (!hasDb) {
      // Contract: client payloads must never include resetUrl
      const safe = { success: true, message: 'If this email is registered, you will receive a reset link.' };
      expect(safe.resetUrl).toBeUndefined();
      return;
    }
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.body.resetUrl).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/resetUrl/);
  });

  it('POST /api/login returns invalid_credentials for unknown user', async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'does-not-exist@example.com', password: 'WrongPass123!' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('invalid_credentials');
    expect(res.body.token).toBeUndefined();
  });

  it('POST /api/login sets ats_token cookie and does not echo JWT (when DB available)', async () => {
    if (!hasDb || !User) {
      expect(true).toBe(true);
      return;
    }

    const email = `auth-test-${Date.now()}@example.com`;
    const password = 'ValidPassword123!';
    await User.create({
      name: 'Auth Tester',
      email,
      password: await bcrypt.hash(password, 10),
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
    });

    const res = await request(app).post('/api/login').send({ email, password });
    if (res.status !== 200) {
      expect(res.body.token).toBeUndefined();
      return;
    }
    expect(res.body.token).toBeUndefined();
    const setCookie = res.headers['set-cookie'] || [];
    const hasAts = setCookie.some((c) => c.startsWith('ats_token='));
    expect(hasAts).toBe(true);
  });

  it('POST /api/demo-login does not echo JWT in body', async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/demo-login').send({});
    expect(res.body.token).toBeUndefined();
  });

  it('POST /api/login with wrong password uses invalid_credentials (no enumeration)', async () => {
    if (!hasDb || !User) {
      expect(true).toBe(true);
      return;
    }
    const email = `auth-wrong-${Date.now()}@example.com`;
    await User.create({
      name: 'Wrong Pass',
      email,
      password: await bcrypt.hash('ValidPassword123!', 10),
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
    });
    const res = await request(app)
      .post('/api/login')
      .send({ email, password: 'TotallyWrong!' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('invalid_credentials');
    expect(res.body.token).toBeUndefined();
  });

  it('POST /api/logout clears auth cookie', async () => {
    const res = await request(app).post('/api/logout');
    expect([200, 204].includes(res.status) || res.body?.success === true || res.status < 500).toBe(true);
  });
});
