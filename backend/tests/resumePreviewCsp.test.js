const fs = require('fs');
const path = require('path');

describe('resume preview CSP', () => {
  it('allows blob PDF/object preview on the production frontend', () => {
    const vercel = fs.readFileSync(
      path.join(__dirname, '../../frontend/vercel.json'),
      'utf8'
    );
    expect(vercel).toMatch(/frame-src[^"]*blob:/);
    expect(vercel).toMatch(/object-src 'self' blob:/);
    expect(vercel).not.toMatch(/object-src 'none'/);
  });
});
