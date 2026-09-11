// Location & State Management Service
const { locationToStateMap, getStateFromLocation } = require('../data/locationToStateMap');

/**
 * Get state from a location name with validation
 * @param {string} location - City or location name
 * @returns {string} State name
 */
function detectState(location) {
  return getStateFromLocation(location);
}

/**
 * Enriched candidate object with state
 * @param {object} candidateData - Candidate object
 * @returns {object} Enriched candidate object with state field
 */
function enrichCandidateWithState(candidateData) {
  const enriched = { ...candidateData };
  
  if (enriched.location) {
    enriched.state = detectState(enriched.location);
  } else {
    enriched.state = null;
  }
  
  return enriched;
}

/**
 * Batch enrich candidates with state
 * @param {array} candidates - Array of candidate objects
 * @returns {array} Array of enriched candidates
 */
function enrichCandidatesBatch(candidates) {
  return candidates.map(candidate => enrichCandidateWithState(candidate));
}

function listCatalogCities() {
  const skip = new Set(['new delhiм']);
  const seen = new Set();
  const names = [];
  for (const city of Object.keys(locationToStateMap)) {
    if (skip.has(city)) continue;
    const name = String(city || '').trim().toUpperCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  for (const extra of ['RAJAHMUNDRY', 'KARIMNAGAR', 'GORAKHPUR']) {
    if (!seen.has(extra)) {
      seen.add(extra);
      names.push(extra);
    }
  }
  names.sort((a, b) => a.localeCompare(b));
  return names;
}

module.exports = {
  detectState,
  enrichCandidateWithState,
  enrichCandidatesBatch,
  getStateFromLocation,
  listCatalogCities,
};
