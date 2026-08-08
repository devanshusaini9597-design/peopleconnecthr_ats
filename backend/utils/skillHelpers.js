function slugifySkill(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s+#.-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function orgSkillSlug(organizationId, name) {
  const prefix = String(organizationId || '').slice(0, 8);
  return `org-${prefix}-${slugifySkill(name)}`;
}

function computeSkillMatch(jobSkills, candidateSkills) {
  const candMap = new Map(
    (candidateSkills || []).map((c) => [String(c.skillId), c.proficiency])
  );

  const details = (jobSkills || []).map((js) => {
    const skillId = String(js.skillId?._id || js.skillId);
    const proficiency = candMap.has(skillId) ? candMap.get(skillId) : null;
    const candidateHas = proficiency !== null;
    const minProf = js.minProficiency ?? 1;
    const matched = candidateHas && proficiency >= minProf;
    return {
      skillId,
      name: js.skillId?.name || js.name || '',
      required: !!js.required,
      weight: js.weight ?? 1,
      minProficiency: minProf,
      candidateHas,
      candidateProficiency: proficiency,
      matched
    };
  });

  const required = details.filter((d) => d.required);
  const requiredMatched = required.filter((d) => d.matched);
  const totalWeighted = details.reduce((s, d) => s + d.weight, 0);
  const matchedWeighted = details.filter((d) => d.matched).reduce((s, d) => s + d.weight, 0);

  return {
    matchPercent: totalWeighted === 0 ? 100 : Math.round((matchedWeighted / totalWeighted) * 100),
    requiredMatchPercent: required.length === 0 ? 100 : Math.round((requiredMatched.length / required.length) * 100),
    matchedCount: details.filter((d) => d.matched).length,
    requiredCount: required.length,
    details
  };
}

module.exports = { slugifySkill, orgSkillSlug, computeSkillMatch };
