// Content script for LinkedIn profile pages — hardened SPA + resilient selectors
(function () {
  'use strict';

  const CONFIG = {
    SELECTORS: {
      name: [
        'h1.text-heading-xlarge',
        'h1[class*="inline"]',
        'main section h1',
        'h1',
      ],
      headline: [
        '.text-body-medium.break-words',
        'div.text-body-medium',
        '[data-generated-suggestion-target]',
        '.top-card-layout__headline',
      ],
      location: [
        '.text-body-small.inline.t-black--light.break-words',
        'span.text-body-small.inline',
        '.top-card__subline-item',
        '.top-card-layout__first-subline',
      ],
      experience: ['#experience', 'section[id*="experience"]', 'div[id*="experience"]'],
      education: ['#education', 'section[id*="education"]'],
      skills: ['#skills', 'section[id*="skills"]', 'div[id*="skills"]'],
      about: ['#about', 'section[id*="about"]'],
      actionBar: [
        '.pv-top-card-v2-ctas',
        '.pvs-profile-actions',
        'div.ph5.pb5',
        '[class*="pv-top-card__actions"]',
        'main section:first-of-type div.mt2',
      ],
    },
    MAX_SKILLS: 50,
    MAX_EXPERIENCE: 10,
  };

  const BUTTON_STATES = {
    default: { text: 'Import to ATS', class: '' },
    importing: { text: 'Importing...', class: 'ats-btn-loading' },
    success: { text: '✓ Imported!', class: 'ats-btn-success' },
    error: { text: '✗ Failed', class: 'ats-btn-error' },
    validating: { text: 'Checking...', class: 'ats-btn-loading' },
  };

  let importButton = null;
  let isProcessing = false;
  let lastUrl = location.href;
  let buttonRetryTimer = null;

  function firstText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text) return text;
    }
    return '';
  }

  function firstEl(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function isProfilePage() {
    return /linkedin\.com\/in\//i.test(location.href);
  }

  function expandSeeMore() {
    document
      .querySelectorAll(
        'button.inline-show-more-text__button, button[aria-label*="more" i], button[aria-expanded="false"]'
      )
      .forEach((btn) => {
        try {
          if (/more|see|show/i.test(btn.textContent || btn.getAttribute('aria-label') || '')) {
            btn.click();
          }
        } catch {
          /* ignore */
        }
      });
  }

  function createImportButton() {
    removeImportButton();
    if (!isProfilePage()) return;

    // Wait for name to appear (LinkedIn SPA)
    if (!firstText(CONFIG.SELECTORS.name)) {
      if (buttonRetryTimer) clearTimeout(buttonRetryTimer);
      buttonRetryTimer = setTimeout(createImportButton, 800);
      return;
    }

    importButton = document.createElement('button');
    importButton.id = 'ats-import-btn';
    importButton.className = 'ats-import-button';
    importButton.type = 'button';
    importButton.innerHTML = `
      <span class="ats-btn-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </span>
      <span class="ats-btn-text">Import to ATS</span>
    `;
    importButton.addEventListener('click', handleImportClick);

    const actionBar = firstEl(CONFIG.SELECTORS.actionBar);
    if (actionBar) {
      actionBar.insertBefore(importButton, actionBar.firstChild);
    } else {
      const header =
        document.querySelector('main section') ||
        document.querySelector('header') ||
        document.body;
      const container = document.createElement('div');
      container.className = 'ats-button-container';
      container.appendChild(importButton);
      header.prepend(container);
    }
  }

  function removeImportButton() {
    document.getElementById('ats-import-btn')?.remove();
    document.querySelector('.ats-button-container')?.remove();
    importButton = null;
  }

  function updateButtonState(state, errorMessage = '') {
    if (!importButton) return;
    const config = BUTTON_STATES[state];
    const textSpan = importButton.querySelector('.ats-btn-text');
    if (textSpan) textSpan.textContent = config.text;

    Object.values(BUTTON_STATES).forEach((s) => {
      if (s.class) importButton.classList.remove(s.class);
    });
    if (config.class) importButton.classList.add(config.class);
    importButton.disabled = state === 'importing' || state === 'validating';

    if (state === 'error' && errorMessage) {
      showTooltip(importButton, errorMessage);
    }
  }

  function showTooltip(element, message) {
    const tooltip = document.createElement('div');
    tooltip.className = 'ats-tooltip';
    tooltip.textContent = message;
    document.body.appendChild(tooltip);
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    setTimeout(() => tooltip.remove(), 4000);
  }

  function extractListItems(section, max) {
    if (!section) return [];
    const items = [];
    const nodes = section.querySelectorAll(
      'li.artdeco-list__item, li, div[data-view-name*="profile-component-entity"]'
    );
    nodes.forEach((item) => {
      if (items.length >= max) return;
      const titleEl = item.querySelector(
        'div[class*="hoverable-link-text"] span[aria-hidden="true"], .mr1.t-bold span[aria-hidden="true"], h3, span.mr1 span[aria-hidden="true"]'
      );
      const companyEl = item.querySelector(
        'span.t-14.t-normal span[aria-hidden="true"], .t-14.t-normal:not(.t-black--light) span[aria-hidden="true"]'
      );
      const dateEl = item.querySelector(
        '.t-black--light span[aria-hidden="true"], span.pvs-entity__caption-wrapper'
      );
      const title = titleEl?.textContent?.trim() || '';
      const company = companyEl?.textContent?.trim() || '';
      if (title || company) {
        items.push({
          title,
          company,
          duration: dateEl?.textContent?.trim() || '',
        });
      }
    });
    return items;
  }

  function extractProfileData() {
    expandSeeMore();

    const name = firstText(CONFIG.SELECTORS.name);
    const headline = firstText(CONFIG.SELECTORS.headline);
    let location = '';
    for (const selector of CONFIG.SELECTORS.location) {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && !/followers|connections|contact/i.test(text)) {
        location = text;
        break;
      }
    }

    const experience = extractListItems(firstEl(CONFIG.SELECTORS.experience), CONFIG.MAX_EXPERIENCE);
    const educationRaw = extractListItems(firstEl(CONFIG.SELECTORS.education), 5);
    const education = educationRaw.map((e) => ({
      school: e.title || e.company,
      degree: e.company && e.title ? e.company : e.duration,
    }));

    const skills = [];
    const skillsSection = firstEl(CONFIG.SELECTORS.skills);
    if (skillsSection) {
      skillsSection
        .querySelectorAll(
          'a[data-field="skill_card_skill_topic"] span[aria-hidden="true"], .hoverable-link-text span[aria-hidden="true"], span[class*="skill"]'
        )
        .forEach((el) => {
          if (skills.length >= CONFIG.MAX_SKILLS) return;
          const skill = el.textContent?.trim();
          if (skill && skill.length < 60 && !skills.includes(skill)) skills.push(skill);
        });
    }

    // Fallback: pull skills-like tokens from headline
    if (!skills.length && headline) {
      headline.split(/[|•·,]/).forEach((part) => {
        const s = part.trim();
        if (s && s.length > 1 && s.length < 40 && skills.length < 10) skills.push(s);
      });
    }

    let about = '';
    const aboutSection = firstEl(CONFIG.SELECTORS.about);
    if (aboutSection) {
      about =
        aboutSection.querySelector('span[aria-hidden="true"]')?.textContent?.trim() ||
        aboutSection.textContent?.trim().slice(0, 2000) ||
        '';
    }

    return {
      name,
      headline,
      currentTitle: experience[0]?.title || headline,
      currentCompany: experience[0]?.company || '',
      location,
      about,
      experience,
      education,
      skills,
      yearsOfExperience: Math.min(40, experience.length * 2),
      linkedInUrl: normalizeProfileUrl(location.href),
      extractedAt: new Date().toISOString(),
    };
  }

  function normalizeProfileUrl(href) {
    try {
      const u = new URL(href);
      const m = u.pathname.match(/\/in\/([^/]+)/i);
      if (m) return `https://www.linkedin.com/in/${m[1]}`;
    } catch {
      /* ignore */
    }
    return href.split('?')[0];
  }

  async function handleImportClick() {
    if (isProcessing) return;
    isProcessing = true;
    updateButtonState('importing');

    try {
      const profileData = extractProfileData();
      if (!profileData.name) {
        throw new Error('Could not extract candidate name. Scroll the page and try again.');
      }

      const response = await chrome.runtime.sendMessage({
        type: 'IMPORT_CANDIDATE',
        data: {
          linkedInUrl: normalizeProfileUrl(window.location.href),
          linkedInData: profileData,
        },
      });

      if (response?.success) {
        updateButtonState('success');
        if (response.candidateId) {
          chrome.storage.local.set({
            [`lastImport_${response.candidateId}`]: {
              candidateId: response.candidateId,
              candidateName: profileData.name,
              importedAt: new Date().toISOString(),
              updated: !!response.updated,
            },
          });
        }
      } else {
        throw new Error(response?.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      updateButtonState('error', error.message || String(error));
    } finally {
      isProcessing = false;
      setTimeout(() => updateButtonState('default'), 3500);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'TRIGGER_IMPORT') {
      if (importButton && !isProcessing) handleImportClick();
      sendResponse({ triggered: true });
    } else if (message.type === 'SHOW_NOTIFICATION') {
      showTooltip(importButton || document.body, message.message);
      sendResponse({ shown: true });
    } else {
      sendResponse({ error: 'Unknown message type' });
    }
    return true;
  });

  function onNavigation() {
    if (location.href === lastUrl) {
      // Soft re-render on same URL — ensure button exists
      if (isProfilePage() && !document.getElementById('ats-import-btn')) {
        createImportButton();
      }
      return;
    }
    lastUrl = location.href;
    setTimeout(() => {
      if (isProfilePage()) createImportButton();
      else removeImportButton();
    }, 600);
  }

  const observer = new MutationObserver(() => onNavigation());
  observer.observe(document.documentElement, { subtree: true, childList: true });

  // LinkedIn history API navigation
  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      setTimeout(onNavigation, 50);
      return result;
    };
  });
  window.addEventListener('popstate', () => setTimeout(onNavigation, 50));

  if (document.readyState === 'complete') {
    setTimeout(createImportButton, 1200);
  } else {
    window.addEventListener('load', () => setTimeout(createImportButton, 1200));
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isProfilePage()) setTimeout(createImportButton, 400);
  });
})();
