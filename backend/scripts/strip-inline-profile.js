const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.js');
let s = fs.readFileSync(file, 'utf8');

const a = s.indexOf('/* ================= PROFILE ROUTES ================= */');
const b = s.indexOf('/* ================= PASSWORD RESET ROUTES ================= */');
if (a < 0 || b < 0) {
  console.error('profile markers not found', a, b);
  process.exit(1);
}

s =
  s.slice(0, a) +
  "app.use('/api/profile', require('./routes/profileRoutes'));\n\n" +
  s.slice(b);

const statsMarker = "app.get('/api/profile/stats'";
const statsStart = s.indexOf(statsMarker);
if (statsStart >= 0) {
  let depth = 0;
  let started = false;
  for (let i = statsStart; i < s.length; i++) {
    if (s[i] === '{') {
      depth++;
      started = true;
    } else if (s[i] === '}') {
      depth--;
      if (started && depth === 0) {
        let end = i + 1;
        if (s.slice(end, end + 2) === ');') end += 2;
        while (end < s.length && (s[end] === '\n' || s[end] === '\r')) end++;
        // also drop preceding comment line if present
        let start = statsStart;
        const prevComment = s.lastIndexOf('// GET account stats', statsStart);
        if (prevComment >= 0 && statsStart - prevComment < 80) start = prevComment;
        s = s.slice(0, start) + s.slice(end);
        console.log('Removed inline /api/profile/stats');
        break;
      }
    }
  }
}

// Drop orphaned multer profile block if still present before password reset
s = s.replace(
  /\nconst multerProfile = require\('multer'\);[\s\S]*?const profilePicUpload = multerProfile\([\s\S]*?\);\n+/g,
  '\n'
);

fs.writeFileSync(file, s);
console.log('Done: profile routes mounted via profileRoutes.js');
