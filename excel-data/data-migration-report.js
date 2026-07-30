const xlsx = require('xlsx');
const { execSync } = require('child_process');

// Run validation
const output = execSync('node server.js candidates-2026-02-04.xlsx 2>&1', { encoding: 'utf8' });
const result = JSON.parse(output);
const results = result.results;
const stats = result.stats;

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                    DATA MIGRATION REPORT - ENTERPRISE ATS                      ║');
console.log('║                        candidates-2026-02-04.xlsx                              ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. OVERALL MIGRATION STATUS
// ═══════════════════════════════════════════════════════════════════════════════════════

console.log('📊 1. OVERALL MIGRATION STATUS\n');
console.log(`   Total Records: ${stats.total}`);
console.log(`   ✅ Ready for Database: ${stats.ready} (${((stats.ready/stats.total)*100).toFixed(1)}%)`);
console.log(`   ⚠️  Needs Review: ${stats.review} (${((stats.review/stats.total)*100).toFixed(1)}%)`);
console.log(`   ❌ Blocked: ${stats.blocked} (${((stats.blocked/stats.total)*100).toFixed(1)}%)\n`);

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2. FIELD-BY-FIELD ACCURACY
// ═══════════════════════════════════════════════════════════════════════════════════════

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📈 2. FIELD-BY-FIELD ACCURACY\n');

const fields = ['name', 'phone', 'email', 'position', 'company', 'client', 
                'ctc', 'expectedSalary', 'noticePeriod', 'experience', 'location', 'status', 'spoc', 'sourceOfCV'];

const fieldStats = {};
fields.forEach(field => {
  const filled = results.filter(r => r.fixed[field] && r.fixed[field] !== null && r.fixed[field] !== '').length;
  const accuracy = (filled / results.length) * 100;
  fieldStats[field] = { filled, accuracy: accuracy.toFixed(1) };
});

// Sort by accuracy descending
const sorted = Object.entries(fieldStats).sort((a, b) => parseFloat(b[1].accuracy) - parseFloat(a[1].accuracy));

console.log('┌─────────────────────┬────────┬──────────┬────────────────────────┐');
console.log('│ Field               │ Filled │ Accuracy │ Status                 │');
console.log('├─────────────────────┼────────┼──────────┼────────────────────────┤');

sorted.forEach(([field, data]) => {
  const acc = parseFloat(data.accuracy);
  let status = '';
  if (acc === 100) status = '✅ PERFECT';
  else if (acc >= 80) status = '🟢 EXCELLENT';
  else if (acc >= 60) status = '🟡 GOOD';
  else if (acc >= 40) status = '🟠 FAIR';
  else status = '🔴 POOR';
  
  const bars = Math.round(acc / 5);
  const bar = '█'.repeat(bars) + '░'.repeat(20 - bars);
  const fieldName = field.length > 19 ? field.slice(0, 16) + '...' : field;
  console.log(`│ ${fieldName.padEnd(19)} │ ${data.filled}/12   │ ${data.accuracy.padStart(3)}%    │ ${bar} ${status} │`);
});

console.log('└─────────────────────┴────────┴──────────┴────────────────────────┘\n');

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. RECORD-BY-RECORD MIGRATION STATUS
// ═══════════════════════════════════════════════════════════════════════════════════════

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📋 3. RECORD-BY-RECORD STATUS\n');

console.log('✅ READY FOR DATABASE (can migrate directly):\n');
const readyRecords = results.filter(r => r.validation && r.validation.category === 'ready');
if (readyRecords.length > 0) {
  readyRecords.forEach(r => {
    const name = r.fixed.name || r.fixed.phone || '(No name)';
    console.log(`   Row ${r.rowIndex}: ${name} - ${r.fixed.position || 'Position'}`);
  });
} else {
  console.log('   None');
}

console.log('\n⚠️  NEEDS REVIEW (missing some fields):\n');
const reviewRecords = results.filter(r => r.validation && r.validation.category === 'review');
if (reviewRecords.length > 0) {
  reviewRecords.forEach(r => {
    const missing = [];
    const critical = ['name', 'phone', 'email', 'position'];
    critical.forEach(f => {
      if (!r.fixed[f]) missing.push(f);
    });
    const name = r.fixed.name || r.fixed.phone || '(No name)';
    console.log(`   Row ${r.rowIndex}: ${name} - Missing: ${missing.join(', ') || 'OK'}`);
  });
} else {
  console.log('   None');
}

console.log('\n❌ BLOCKED (cannot use):\n');
const blockedRecords = results.filter(r => r.validation && r.validation.category === 'blocked');
if (blockedRecords.length > 0) {
  blockedRecords.forEach(r => {
    const errors = (r.validation.errors || []).map(e => e.message).join(', ');
    console.log(`   Row ${r.rowIndex}: ${errors || 'Invalid'}`);
  });
} else {
  console.log('   None');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4. AUTO-CORRECTION STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════════════

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🔧 4. AUTO-CORRECTION STATISTICS\n');

let totalChanges = 0;
let recordsWithChanges = 0;
const changesByField = {};

results.forEach(r => {
  if (r.autoFixChanges && r.autoFixChanges.length > 0) {
    recordsWithChanges++;
    r.autoFixChanges.forEach(change => {
      const field = change.split(':')[0].trim();
      changesByField[field] = (changesByField[field] || 0) + 1;
      totalChanges++;
    });
  }
});

console.log(`   Records Auto-Fixed: ${recordsWithChanges}/${results.length} (${((recordsWithChanges/results.length)*100).toFixed(1)}%)`);
console.log(`   Total Auto-Corrections: ${totalChanges}\n`);
console.log('   Corrections by Field:');
Object.entries(changesByField).forEach(([field, count]) => {
  console.log(`      • ${field}: ${count} corrections`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5. DATA QUALITY SCORE
// ═══════════════════════════════════════════════════════════════════════════════════════

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎯 5. DATA QUALITY SCORE\n');

// Calculate overall quality (0-100)
const criticalFields = ['name', 'phone', 'email', 'position', 'ctc'];
const criticalFilled = criticalFields.reduce((sum, f) => {
  const filled = results.filter(r => r.fixed[f]).length;
  return sum + filled;
}, 0);
const maxCritical = criticalFields.length * results.length;
const qualityScore = Math.round((criticalFilled / maxCritical) * 100);
if (qualityScore >= 90) console.log('   ✅ EXCELLENT - Ready for production');
else if (qualityScore >= 75) console.log('   🟢 GOOD - Can migrate with minor review');
else if (qualityScore >= 60) console.log('   🟡 ACCEPTABLE - Needs some manual review');
else console.log('   🔴 POOR - Significant manual work required');

console.log('\n   Critical Fields Quality:');
criticalFields.forEach(f => {
  const filled = results.filter(r => r.fixed[f]).length;
  const acc = ((filled / results.length) * 100).toFixed(0);
  console.log(`      ${f.padEnd(15)}: ${acc}% (${filled}/${results.length})`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6. MIGRATION RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════════════

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('💡 6. MIGRATION RECOMMENDATIONS\n');

if (qualityScore >= 90) {
  console.log('   ✅ PROCEED: Data is ready for direct database migration');
  console.log(`      - ${stats.ready} records can be imported immediately`);
  if (stats.review > 0) {
    console.log(`      - ${stats.review} records should be reviewed first`);
  }
} else if (qualityScore >= 75) {
  console.log('   🟡 REVIEW FIRST: Some data cleanup recommended before migration');
  const lowAccFields = sorted.filter(([f, d]) => parseFloat(d.accuracy) < 70);
  console.log('      Fields to focus on:');
  lowAccFields.forEach(([f, d]) => {
    console.log(`        - ${f}: ${d.accuracy}%`);
  });
} else {
  console.log('   🔴 CLEANUP NEEDED: Significant data issues before migration');
  console.log('      1. Fill missing critical fields');
  console.log('      2. Verify auto-corrected values');
  console.log('      3. Resolve blocked records');
  console.log('      4. Re-run validation');
}

console.log('\n   Next Steps:');
if (stats.ready > 0) {
  console.log(`   1. Import ${stats.ready} ready records to database`);
}
if (stats.review > 0) {
  console.log(`   2. Manually review and approve ${stats.review} records`);
}
if (stats.blocked > 0) {
  console.log(`   3. Fix/delete ${stats.blocked} blocked records`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7. MIGRATION SUMMARY TABLE
// ═══════════════════════════════════════════════════════════════════════════════════════

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📊 7. MIGRATION SUMMARY\n');

console.log('┌────────────────────────┬──────────┬────────────────┐');
console.log('│ Category               │ Count    │ Percentage     │');
console.log('├────────────────────────┼──────────┼────────────────┤');
console.log(`│ Ready (DB)             │ ${stats.ready.toString().padEnd(8)} │ ${((stats.ready/stats.total)*100).toFixed(1).padStart(6)}%        │`);
console.log(`│ Needs Review           │ ${stats.review.toString().padEnd(8)} │ ${((stats.review/stats.total)*100).toFixed(1).padStart(6)}%        │`);
console.log(`│ Blocked                │ ${stats.blocked.toString().padEnd(8)} │ ${((stats.blocked/stats.total)*100).toFixed(1).padStart(6)}%        │`);
console.log('├────────────────────────┼──────────┼────────────────┤');
console.log(`│ TOTAL                  │ ${stats.total.toString().padEnd(8)} │ 100.0%        │`);
console.log('└────────────────────────┴──────────┴────────────────┘\n');

console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                        END OF MIGRATION REPORT                                 ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// Export to JSON for dashboards
const report = {
  timestamp: new Date().toISOString(),
  file: 'candidates-2026-02-04.xlsx',
  overallStatus: {
    ready: stats.ready,
    review: stats.review,
    blocked: stats.blocked,
    total: stats.total,
    qualityScore: qualityScore,
    overallAccuracy: ((stats.ready / stats.total) * 100).toFixed(1)
  },
  fieldAccuracy: Object.fromEntries(sorted),
  autoCorrections: {
    recordsFixed: recordsWithChanges,
    totalChanges: totalChanges,
    byField: changesByField
  }
};

console.log('📁 Report exported to: migration-report.json\n');
require('fs').writeFileSync('migration-report.json', JSON.stringify(report, null, 2));
