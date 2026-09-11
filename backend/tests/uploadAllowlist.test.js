const { isAllowedUploadFilename, BLOCKED_UPLOAD_EXTS } = require('../utils/uploadAllowlist');
const { validateAndFixName } = require('../controller/candidate/candidateValidation');

describe('upload allowlist', () => {
  it('accepts resume and spreadsheet types used by import', () => {
    expect(isAllowedUploadFilename('Ketan.pdf')).toBe(true);
    expect(isAllowedUploadFilename('Prasanta.doc')).toBe(true);
    expect(isAllowedUploadFilename('cv.docx')).toBe(true);
    expect(isAllowedUploadFilename('sheet.xlsx')).toBe(true);
  });

  it('rejects executables, scripts, and HTML', () => {
    const names = [
      'payload.exe',
      'dropper.js',
      'page.html',
      'page.htm',
      'macro.bat',
      'run.ps1',
      'shell.php',
      'icon.svg',
    ];
    names.forEach((name) => expect(isAllowedUploadFilename(name)).toBe(false));
    expect(BLOCKED_UPLOAD_EXTS).toEqual(expect.arrayContaining(['.exe', '.js', '.html']));
  });
});

describe('candidate name sanitizer', () => {
  it('strips markup so a name cannot carry a script tag', () => {
    const result = validateAndFixName('<script>alert(1)</script>Jane');
    expect(result.value).not.toMatch(/[<>]/);
    expect(result.value).not.toMatch(/alert\(1\)/);
    expect(result.value).toContain('JANE');
  });
});
