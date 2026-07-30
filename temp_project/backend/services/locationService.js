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

module.exports = {
  detectState,
  enrichCandidateWithState,
  enrichCandidatesBatch,
  getStateFromLocation
};
