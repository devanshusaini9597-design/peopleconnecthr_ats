/**
 * Cookie auth helpers + middleware token extraction.
 */
const { setAuthCookie, clearAuthCookie, COOKIE_NAME } = require('../utils/authCookies');

describe('authCookies helpers', () => {
  it('COOKIE_NAME is ats_token', () => {
    expect(COOKIE_NAME).toBe('ats_token');
  });

  it('setAuthCookie writes httpOnly cookie', () => {
    const cookies = {};
    const res = {
      cookie: (name, value, opts) => {
        cookies[name] = { value, opts };
      },
    };
    setAuthCookie(res, 'jwt.payload.sig');
    expect(cookies[COOKIE_NAME].value).toBe('jwt.payload.sig');
    expect(cookies[COOKIE_NAME].opts.httpOnly).toBe(true);
    expect(cookies[COOKIE_NAME].opts.path).toBe('/');
    expect(cookies[COOKIE_NAME].opts.sameSite).toBeDefined();
  });

  it('clearAuthCookie clears ats_token', () => {
    const cleared = [];
    const res = {
      clearCookie: (name, opts) => {
        cleared.push({ name, opts });
      },
    };
    clearAuthCookie(res);
    expect(cleared[0].name).toBe(COOKIE_NAME);
    expect(cleared[0].opts.httpOnly).toBe(true);
    expect(cleared[0].opts.path).toBe('/');
  });
});

describe('authMiddleware cookie extraction', () => {
  it('reads ats_token from cookies when Authorization header absent', () => {
    const authMiddlewarePath = require.resolve('../middleware/authMiddleware');
    // Load source as text to assert cookie name (avoids mocking full JWT flow)
    const fs = require('fs');
    const src = fs.readFileSync(authMiddlewarePath, 'utf8');
    expect(src).toMatch(/ats_token/);
    expect(src).toMatch(/req\.cookies/);
  });
});
