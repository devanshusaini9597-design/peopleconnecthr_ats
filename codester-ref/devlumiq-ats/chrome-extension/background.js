// Background Service Worker for ATS LinkedIn Import Extension
// Manifest V3 compatible

import { MESSAGE_TYPES } from './config.js';

chrome.runtime.onInstalled.addListener((details) => {
  console.log('ATS LinkedIn Import Extension installed:', details.reason);

  chrome.storage.sync.set({
    atsDomain: '',
    atsApiKey: '',
    isFirstInstall: details.reason === 'install',
  });

  if (details.reason === 'install') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'ATS LinkedIn Import Installed',
      message: 'Click the extension icon to set your ATS domain and API key',
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.IMPORT_CANDIDATE: {
          const result = await handleCandidateImport(message.data);
          sendResponse(result);
          break;
        }
        case MESSAGE_TYPES.GET_SETTINGS: {
          const settings = await chrome.storage.sync.get(['atsDomain', 'atsApiKey']);
          sendResponse({ success: true, settings });
          break;
        }
        case MESSAGE_TYPES.SAVE_SETTINGS: {
          await chrome.storage.sync.set({
            atsDomain: message.data.atsDomain,
            atsApiKey: message.data.atsApiKey,
          });
          sendResponse({ success: true });
          break;
        }
        case MESSAGE_TYPES.VALIDATE_SETTINGS: {
          const validation = await validateSettings();
          sendResponse(validation);
          break;
        }
        case MESSAGE_TYPES.GET_CANDIDATE_STATUS: {
          const status = await checkCandidateStatus(message.candidateId);
          sendResponse(status);
          break;
        }
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  })();

  return true;
});

async function handleCandidateImport(data) {
  // chrome.storage.sync.get returns a flat object — do NOT nest under .settings
  const { atsDomain, atsApiKey } = await chrome.storage.sync.get(['atsDomain', 'atsApiKey']);

  if (!atsDomain || !atsApiKey) {
    return {
      success: false,
      error: 'Please configure ATS domain and API key in the extension popup',
    };
  }

  const domain = atsDomain.replace(/\/$/, '');

  try {
    const response = await fetch(`${domain}/api/linkedin/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${atsApiKey}`,
        'X-Extension-Version': chrome.runtime.getManifest().version,
      },
      body: JSON.stringify({
        linkedInUrl: data.linkedInUrl,
        linkedInData: data.linkedInData,
        importedAt: new Date().toISOString(),
        source: 'chrome_extension',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: Import failed`);
    }

    const result = await response.json();

    await storeImportHistory({
      candidateId: result.candidateId,
      candidateName: data.linkedInData?.name,
      linkedInUrl: data.linkedInUrl,
      importedAt: new Date().toISOString(),
      status: 'success',
    });

    return { success: true, ...result };
  } catch (error) {
    console.error('Import failed:', error);
    return { success: false, error: error.message };
  }
}

async function validateSettings() {
  const { atsDomain, atsApiKey } = await chrome.storage.sync.get(['atsDomain', 'atsApiKey']);

  if (!atsDomain || !atsApiKey) {
    return { valid: false, error: 'Settings not configured' };
  }

  const domain = atsDomain.replace(/\/$/, '');

  try {
    const response = await fetch(`${domain}/api/auth/validate`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${atsApiKey}`,
        'X-Extension-Version': chrome.runtime.getManifest().version,
      },
    });

    if (response.ok) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid API key or domain' };
  } catch {
    return { valid: false, error: 'Cannot connect to ATS. Check domain URL.' };
  }
}

async function checkCandidateStatus(candidateId) {
  const { atsDomain, atsApiKey } = await chrome.storage.sync.get(['atsDomain', 'atsApiKey']);
  if (!atsDomain || !atsApiKey) {
    return { success: false, error: 'Not configured' };
  }
  const domain = atsDomain.replace(/\/$/, '');

  try {
    const response = await fetch(`${domain}/api/candidates/${candidateId}`, {
      headers: { Authorization: `Bearer ${atsApiKey}` },
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, candidate: data };
    }
    return { success: false, error: 'Candidate not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function storeImportHistory(importData) {
  const { importHistory = [] } = await chrome.storage.local.get(['importHistory']);
  importHistory.unshift(importData);
  if (importHistory.length > 100) importHistory.pop();
  await chrome.storage.local.set({ importHistory });
}

// Note: do NOT register chrome.action.onClicked when default_popup is set — MV3 ignores it.
