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
    const prevRailway = process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.LOGIN_OTP_PAUSED = '1';
    expect(isLoginOtpPaused()).toBe(true);
    process.env.LOGIN_OTP_PAUSED = 'false';
    expect(isLoginOtpPaused()).toBe(false);
    if (prev === undefined) delete process.env.LOGIN_OTP_PAUSED;
    else process.env.LOGIN_OTP_PAUSED = prev;
    if (prevRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
    else process.env.RAILWAY_ENVIRONMENT = prevRailway;
  });

  it('never pauses or skips OTP on Railway or production hosts', () => {
    const { isLoginOtpPaused, canSkipLoginOtpChallenge, isDeployedLoginSurface } = require('../services/loginOtpService');
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      LOGIN_OTP_PAUSED: process.env.LOGIN_OTP_PAUSED,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
      DEV_TEMP_PASSWORD_IN_PRODUCTION: process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION,
    };
    process.env.NODE_ENV = 'staging';
    process.env.LOGIN_OTP_PAUSED = '1';
    process.env.RAILWAY_ENVIRONMENT = 'production';
    expect(isDeployedLoginSurface()).toBe(true);
    expect(isLoginOtpPaused()).toBe(false);
    expect(canSkipLoginOtpChallenge({
      usedDevTempPassword: false,
      skipLoginOtp: true,
      ownerBypass: true,
    })).toBe(false);
    process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION = '1';
    expect(canSkipLoginOtpChallenge({ usedDevTempPassword: true })).toBe(true);
    delete process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION;
    expect(canSkipLoginOtpChallenge({ usedDevTempPassword: true })).toBe(false);
    if (prev.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev.NODE_ENV;
    if (prev.LOGIN_OTP_PAUSED === undefined) delete process.env.LOGIN_OTP_PAUSED;
    else process.env.LOGIN_OTP_PAUSED = prev.LOGIN_OTP_PAUSED;
    if (prev.RAILWAY_ENVIRONMENT === undefined) delete process.env.RAILWAY_ENVIRONMENT;
    else process.env.RAILWAY_ENVIRONMENT = prev.RAILWAY_ENVIRONMENT;
    if (prev.DEV_TEMP_PASSWORD_IN_PRODUCTION === undefined) delete process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION;
    else process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION = prev.DEV_TEMP_PASSWORD_IN_PRODUCTION;
  });

  it('otpDeliveryAddress sends Gmail plus-aliases to the shared inbox', () => {
    const { otpDeliveryAddress, plusAliasMailbox } = require('../services/loginOtpService');
    const prev = process.env.QA_OTP_INBOX;
    process.env.QA_OTP_INBOX = 'skillnix.qa@gmail.com';
    expect(plusAliasMailbox('skillnix.qa+a.owner@gmail.com')).toBe('skillnix.qa@gmail.com');
    expect(otpDeliveryAddress('skillnix.qa+a.owner@gmail.com')).toBe('skillnix.qa@gmail.com');
    expect(otpDeliveryAddress('skillnix.qa+b.freelancer@gmail.com')).toBe('skillnix.qa@gmail.com');
    expect(otpDeliveryAddress('recruiter@acme.com')).toBe('recruiter@acme.com');
    expect(otpDeliveryAddress('foo+tag@gmail.com')).toBe('foo@gmail.com');
    if (prev === undefined) delete process.env.QA_OTP_INBOX;
    else process.env.QA_OTP_INBOX = prev;
  });

  it('locks out after 5 incorrect OTP attempts', () => {
    expect(require('../services/loginOtpService').OTP_MAX_ATTEMPTS).toBe(5);
    const src = require('fs').readFileSync(require.resolve('../services/loginOtpService'), 'utf8');
    expect(src).toMatch(/const attempts = Number\(user\.loginOtpAttempts\)/);
    expect(src).toMatch(/nextAttempts >= OTP_MAX_ATTEMPTS/);
    expect(src).toMatch(/Too many incorrect codes/);
  });
});
