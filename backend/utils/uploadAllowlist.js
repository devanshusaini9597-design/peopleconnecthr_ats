const path = require('path');

const ALLOWED_UPLOAD_EXTS = [
  '.pdf', '.doc', '.docx', '.xlsx', '.xls', '.csv', '.txt',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
];

const BLOCKED_UPLOAD_EXTS = [
  '.exe', '.js', '.mjs', '.cjs', '.html', '.htm', '.svg', '.xhtml',
  '.bat', '.cmd', '.ps1', '.sh', '.php', '.jar', '.dll', '.com',
  '.scr', '.vbs', '.wsf', '.msi', '.apk',
];

function isAllowedUploadFilename(originalname) {
  const ext = path.extname(String(originalname || '')).toLowerCase();
  if (!ext || BLOCKED_UPLOAD_EXTS.includes(ext)) return false;
  return ALLOWED_UPLOAD_EXTS.includes(ext);
}

function multerFileFilter(req, file, cb) {
  if (isAllowedUploadFilename(file?.originalname)) {
    cb(null, true);
    return;
  }
  const ext = path.extname(String(file?.originalname || '')).toLowerCase() || 'unknown';
  cb(new Error(`File type ${ext} not allowed`));
}

module.exports = {
  ALLOWED_UPLOAD_EXTS,
  BLOCKED_UPLOAD_EXTS,
  isAllowedUploadFilename,
  multerFileFilter,
};
