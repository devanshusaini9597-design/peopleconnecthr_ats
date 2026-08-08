const $ = (id) => document.getElementById(id);

const getSettings = () => new Promise((resolve) => {
  chrome.storage.sync.get(['apiDomain', 'apiToken'], (result) => resolve(result));
});

const saveSettings = (apiDomain, apiToken) => new Promise((resolve) => {
  chrome.storage.sync.set({ apiDomain, apiToken }, resolve);
});

const setFeedback = (el, message, type) => {
  el.textContent = message;
  el.className = `feedback ${type || ''}`;
};

const showSettings = (show) => {
  $('settings-view').classList.toggle('hidden', !show);
  $('settings-toggle').textContent = show ? 'Back' : 'Settings';
};

const init = async () => {
  const { apiDomain, apiToken } = await getSettings();
  $('api-domain').value = apiDomain || '';
  $('api-token').value = apiToken || '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isLinkedInProfile = tab?.url && /https:\/\/[a-z]*\.?linkedin\.com\/in\//.test(tab.url);

  if (!isLinkedInProfile) {
    $('profile-view').classList.add('hidden');
    $('not-linkedin-view').classList.remove('hidden');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PROFILE' }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      // Content script may not have loaded yet on a fresh navigation — fail
      // quietly, the recruiter can still fill fields in manually.
      return;
    }
    const { name, position, companyName, location } = response.data;
    $('name').value = name || '';
    $('position').value = position || '';
    $('companyName').value = companyName || '';
    $('location').value = location || '';
  });
};

$('settings-toggle').addEventListener('click', () => {
  const isHidden = $('settings-view').classList.contains('hidden');
  showSettings(isHidden);
});

$('save-settings').addEventListener('click', async () => {
  const apiDomain = $('api-domain').value.trim().replace(/\/$/, '');
  const apiToken = $('api-token').value.trim();
  await saveSettings(apiDomain, apiToken);
  setFeedback($('settings-feedback'), 'Saved.', 'success');
});

$('import-btn').addEventListener('click', async () => {
  const feedback = $('import-feedback');
  const { apiDomain, apiToken } = await getSettings();

  if (!apiDomain || !apiToken) {
    setFeedback(feedback, 'Set your API domain and token in Settings first.', 'error');
    showSettings(true);
    return;
  }

  const name = $('name').value.trim();
  const email = $('email').value.trim();
  if (!name || !email) {
    setFeedback(feedback, 'Name and email are required.', 'error');
    return;
  }

  const payload = {
    name,
    email,
    position: $('position').value.trim(),
    companyName: $('companyName').value.trim(),
    location: $('location').value.trim()
  };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) payload.linkedinUrl = tab.url.split('?')[0];

  $('import-btn').disabled = true;
  setFeedback(feedback, 'Importing…', '');

  try {
    const res = await fetch(`${apiDomain}/api/chrome-extension/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Import failed');
    setFeedback(feedback, data.created ? 'Imported as a new candidate!' : 'Existing candidate updated!', 'success');
  } catch (err) {
    setFeedback(feedback, err.message, 'error');
  } finally {
    $('import-btn').disabled = false;
  }
});

init();
