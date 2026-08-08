/**
 * Content script — runs on LinkedIn profile pages (linkedin.com/in/*).
 * Scrapes the small set of public, visible fields the popup needs and
 * responds to a single message so the popup stays the only place with
 * any real logic. Deliberately does NOT scrape email (LinkedIn doesn't
 * expose it on the public profile) — the recruiter fills that in.
 *
 * NOTE: LinkedIn's DOM/class names change over time and are not a stable
 * public API. Selectors here use broad, resilient fallbacks (top-card
 * headings) rather than brittle utility-class names, but may still need
 * updating if LinkedIn redesigns the profile page.
 */

const text = (el) => (el ? el.textContent.trim().replace(/\s+/g, ' ') : '');

const scrapeProfile = () => {
  const name = text(document.querySelector('main h1'));

  // The line directly under the name is the "headline" (often "Title at Company").
  const topCard = document.querySelector('main h1')?.closest('section') || document.querySelector('main');
  const headline = text(topCard?.querySelector('h1 + div')) || text(topCard?.querySelector('.text-body-medium'));

  // Location is usually the next text block after the headline in the top card.
  const locationCandidates = topCard ? Array.from(topCard.querySelectorAll('span, div')) : [];
  const location = text(
    locationCandidates.find((el) => /,\s*[A-Za-z]/.test(el.textContent) && el.textContent.length < 60 && el !== topCard?.querySelector('h1 + div'))
  );

  let position = '';
  let companyName = '';
  if (headline.includes(' at ')) {
    [position, companyName] = headline.split(' at ').map((s) => s.trim());
  } else {
    position = headline;
  }

  return {
    name,
    position,
    companyName,
    location,
    linkedinUrl: window.location.href.split('?')[0]
  };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SCRAPE_PROFILE') {
    try {
      sendResponse({ success: true, data: scrapeProfile() });
    } catch (err) {
      sendResponse({ success: false, message: err.message });
    }
  }
  return true;
});
