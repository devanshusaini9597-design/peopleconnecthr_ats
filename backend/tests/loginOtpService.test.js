const crypto = require('crypto');

describe('loginOtpService', () => {
  it('exports OTP helpers', () => {
    const svc = require('../services/loginOtpService');
    expect(typeof svc.generateOtp).toBe('function');
    expect(typeof svc.hashOtp).toBe('function');
    expect(typeof svc.otpMatches).toBe('function');
    expect(typeof svc.issueLoginOtpChallenge).toBe('function');
    expect(typeof svc.isLoginOtpPaused).toBe('function');
    expect(typeof svc.verifyLoginOtp).toBe('function');
    expect(typeof svc.resendLoginOtp).toBe('function');
  });

  it('generateOtp is a 6-digit string', () => {
    const { generateOtp } = require('../services/loginOtpService');
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('otpMatches accepts the original code and rejects others', () => {
    const { hashOtp, otpMatches } = require('../services/loginOtpService');
    const userId = '507f1f77bcf86cd799439011';
    const hash = hashOtp(userId, '482193');
    expect(otpMatches(userId, '482193', hash)).toBe(true);
    expect(otpMatches(userId, '000000', hash)).toBe(false);
    expect(otpMatches(userId, '482193', crypto.randomBytes(32).toString('hex'))).toBe(false);
  });

  it('isLoginOtpPaused follows LOGIN_OTP_PAUSED without removing OTP code', () => {
    const { isLoginOtpPaused } = require('../services/loginOtpService');
    const prev = process.env.LOGIN_OTP_PAUSED;
    process.env.LOGIN_OTP_PAUSED = '1';
    expect(isLoginOtpPaused()).toBe(true);
    process.env.LOGIN_OTP_PAUSED = 'false';
    expect(isLoginOtpPaused()).toBe(false);
    if (prev === undefined) delete process.env.LOGIN_OTP_PAUSED;
    else process.env.LOGIN_OTP_PAUSED = prev;
  });
});
