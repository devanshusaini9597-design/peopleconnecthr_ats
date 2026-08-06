const { getMaskedSettings, MASK } = require('../services/emailSettingsService');

describe('emailSettingsService', () => {
  it('masks credentials and exposes flags', () => {
    const masked = getMaskedSettings({
      emailSettings: {
        smtpEmail: 'a@b.com',
        smtpAppPassword: 'secret',
        smtpProvider: 'gmail',
        emailProvider: 'smtp',
        isConfigured: true,
        zohoZeptomailApiKey: 'zk',
      },
    });
    expect(masked.smtpAppPassword).toBe(MASK);
    expect(masked.hasPassword).toBe(true);
    expect(masked.hasZohoApiKey).toBe(true);
    expect(masked.smtpEmail).toBe('a@b.com');
    expect(masked.isConfigured).toBe(true);
  });

  it('reports unconfigured when empty', () => {
    const masked = getMaskedSettings({});
    expect(masked.isConfigured).toBe(false);
    expect(masked.hasPassword).toBe(false);
    expect(masked.configSource).toBe('none');
  });
});
