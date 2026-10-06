/**
 * Turn database/driver failures into copy a recruiter can act on.
 * Raw CastError / BSON text must not reach the UI.
 */
function clientSafeError(error, fallback = 'Something went wrong. Please try again.') {
  const raw = typeof error === 'string' ? error : (error?.message || '');
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;

  if (/cast to objectid/i.test(text) || /bsonerror/i.test(text)) {
    if (/miscontactid/i.test(text)) {
      return 'A contact link on this row is blank, so it was not saved. Remove empty ID columns from the spreadsheet and upload again.';
    }
    return 'A value in this file is blank or not a valid ID, so it could not be saved. Check the spreadsheet and try again.';
  }

  if (/cast to date/i.test(text)) {
    return 'A date in this file is blank or not a real date. Correct the date column and try again.';
  }

  if (/validation failed/i.test(text) && /cast to/i.test(text)) {
    return 'Some values are not in the expected format, so this could not be saved. Check the file or form and try again.';
  }

  if (/^candidate validation failed/i.test(text)) {
    return 'This profile could not be saved because a field is in the wrong format. Review the details and try again.';
  }

  if (text.length > 280 || /at path |mongoose|bson|stack/i.test(text)) {
    return fallback;
  }

  return text;
}

module.exports = { clientSafeError };
