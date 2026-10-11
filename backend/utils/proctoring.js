/**
 * Assessment proctoring — risk score from integrity events.
 */

function computeRiskScore({
  tabSwitchCount = 0,
  copyPasteCount = 0,
  blurCount = 0,
  fullscreenExits = 0,
  cameraDenied = false,
  restrictedActionCount = 0,
  plagiarismScore = null,
  strictness = 'standard'
} = {}) {
  const strict = strictness === 'strict' ? 1.4 : strictness === 'off' ? 0.5 : 1;
  let risk = 0;
  risk += Math.min(40, tabSwitchCount * 8);
  risk += Math.min(25, copyPasteCount * 5);
  risk += Math.min(20, blurCount * 4);
  risk += Math.min(15, fullscreenExits * 5);
  risk += Math.min(20, restrictedActionCount * 6);
  if (cameraDenied) risk += 20;
  if (plagiarismScore != null) {
    risk += Math.min(30, Math.round(plagiarismScore * 30));
  }
  risk = Math.min(100, Math.round(risk * strict));
  const flagThreshold = strictness === 'strict' ? 35 : 50;
  return { riskScore: risk, flagged: risk >= flagThreshold };
}

function summarizeEvents(events = []) {
  let tabSwitchCount = 0;
  let copyPasteCount = 0;
  let blurCount = 0;
  let fullscreenExits = 0;
  let snapshotCount = 0;
  let restrictedActionCount = 0;
  let cameraDenied = false;
  for (const e of events) {
    if (e.type === 'tab_switch') tabSwitchCount++;
    else if (e.type === 'copy' || e.type === 'paste') copyPasteCount++;
    else if (e.type === 'window_blur') blurCount++;
    else if (e.type === 'fullscreen_exit') fullscreenExits++;
    else if (e.type === 'context_menu' || e.type === 'print' || e.type === 'devtools') restrictedActionCount++;
    else if (e.type === 'camera_denied') cameraDenied = true;
    else if (e.type === 'snapshot') {
      if (e.meta?.skipped || e.meta?.reason === 'camera_denied_or_unavailable') cameraDenied = true;
      else if (e.meta?.image || e.meta?.imagePath) snapshotCount++;
    }
  }
  return {
    tabSwitchCount, copyPasteCount, blurCount, fullscreenExits,
    snapshotCount, cameraDenied, restrictedActionCount,
  };
}

module.exports = { computeRiskScore, summarizeEvents };
