/** Plain-language copy for import failures. Keeps database jargon off the screen. */
export function humanizeUploadError(message, fallback = 'The import could not be completed. Check the file and try again.') {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
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
    return 'Some values are not in the expected format, so this file could not be saved. Check the columns and try again.';
  }

  const stripped = text.replace(/^(import error|error|import failed)\s*:\s*/i, '').trim();
  if (!stripped || /mongoose|bson|at path /i.test(stripped)) return fallback;
  return stripped;
}
