/**
 * Background service worker (MV3). Currently only needed so Chrome treats
 * this as a valid MV3 extension with a background context available for
 * future use (e.g. a right-click "Import to ATS" context menu) — the
 * popup talks directly to the content script and the backend today.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('SkillNix ATS — LinkedIn Import extension installed.');
});
