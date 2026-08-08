const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(path.join(__dirname, '..', 'src'));
let fixed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes("t('") && !src.includes('t("')) continue;
  if (!src.includes('useTranslation')) continue;
  if (src.includes('const { t } = useTranslation()')) continue;
  // missing hook
  const patterns = [
    /(export default function \w+\([^)]*\) \{\n)/,
    /(function \w+\([^)]*\) \{\n)/,
    /(const \w+ = \(\) => \{\n)/,
  ];
  let ok = false;
  for (const re of patterns) {
    if (re.test(src)) {
      src = src.replace(re, `$1  const { t } = useTranslation();\n`);
      ok = true;
      break;
    }
  }
  if (!ok) {
    // insert after first useToast/useNavigate/useAuth line
    src = src.replace(
      /(const \w+ = \(\) => \{\n)(\s*const [^\n]+\n)/,
      `$1  const { t } = useTranslation();\n$2`
    );
    ok = src.includes('const { t } = useTranslation()');
  }
  if (ok) {
    fs.writeFileSync(file, src);
    fixed++;
    console.log('fixed', path.relative(path.join(__dirname, '..'), file));
  } else {
    console.warn('NEED MANUAL', path.relative(path.join(__dirname, '..'), file));
  }
}
console.log('fixed count', fixed);
