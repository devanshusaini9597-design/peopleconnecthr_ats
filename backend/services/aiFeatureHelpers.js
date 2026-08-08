/**
 * Pure helpers for AI feature routes — kept out of the Express router.
 */
const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom ? dot / denom : 0;
};

const parseJsonLoose = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    const m = typeof raw === 'string' && raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
    return typeof fallback === 'function' ? fallback(raw) : fallback;
  }
};

const candidateProfileText = (c) =>
  [
    c.name && `Name: ${c.name}`,
    c.position && `Position: ${c.position}`,
    c.experience && `Experience: ${c.experience}`,
    c.skills && `Skills: ${c.skills}`,
    c.companyName && `Company: ${c.companyName}`,
    c.resumeText && `Resume:\n${c.resumeText}`,
  ]
    .filter(Boolean)
    .join('\n');

module.exports = {
  cosineSimilarity,
  parseJsonLoose,
  candidateProfileText,
};
