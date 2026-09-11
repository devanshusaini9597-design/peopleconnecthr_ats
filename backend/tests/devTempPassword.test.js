describe('devTempPassword', () => {
  const prev = { ...process.env };

  afterEach(() => {
    for (const key of [
      'NODE_ENV',
      'DEV_TEMP_PASSWORD',
      'DEV_TEMP_PASSWORD_DOMAIN',
      'DEV_TEMP_PASSWORD_IN_PRODUCTION',
      'DEV_TEMP_PASSWORD_ORGANIZATION_ID',
    ]) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it('accepts configured domain password without touching stored hashes', () => {
    const { isDevTempPasswordLogin } = require('../utils/devTempPassword');
    process.env.NODE_ENV = 'test';
    process.env.DEV_TEMP_PASSWORD = 'SkillnixCheck2026!';
    process.env.DEV_TEMP_PASSWORD_DOMAIN = 'skillnixrecruitment.com';
    delete process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION;
    delete process.env.DEV_TEMP_PASSWORD_ORGANIZATION_ID;
    expect(isDevTempPasswordLogin('adarsh@skillnixrecruitment.com', 'SkillnixCheck2026!')).toBe(true);
    expect(isDevTempPasswordLogin('adarsh@skillnixrecruitment.com', 'wrong')).toBe(false);
    expect(isDevTempPasswordLogin('user@peopleconnecthr.com', 'SkillnixCheck2026!')).toBe(false);
  });

  it('stays off in production unless the testing-phase flag is set', () => {
    const { isDevTempPasswordLogin } = require('../utils/devTempPassword');
    process.env.NODE_ENV = 'production';
    process.env.DEV_TEMP_PASSWORD = 'SkillnixCheck2026!';
    process.env.DEV_TEMP_PASSWORD_DOMAIN = 'skillnixrecruitment.com';
    delete process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION;
    expect(isDevTempPasswordLogin('adarsh@skillnixrecruitment.com', 'SkillnixCheck2026!')).toBe(false);
  });

  it('in production with flag, any user in the pinned org can use the overlay password', () => {
    const { isDevTempPasswordLogin } = require('../utils/devTempPassword');
    process.env.NODE_ENV = 'production';
    process.env.DEV_TEMP_PASSWORD = 'SkillnixCheck2026!';
    process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION = '1';
    process.env.DEV_TEMP_PASSWORD_ORGANIZATION_ID = '507f1f77bcf86cd799439011';
    expect(isDevTempPasswordLogin('anyone@customer.com', 'SkillnixCheck2026!', '507f1f77bcf86cd799439011')).toBe(true);
    expect(isDevTempPasswordLogin('anyone@customer.com', 'SkillnixCheck2026!', '507f1f77bcf86cd799439099')).toBe(false);
  });
});
