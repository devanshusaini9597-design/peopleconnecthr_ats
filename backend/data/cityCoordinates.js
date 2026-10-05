/**
 * Indian cities / towns (lat/lng) for nearby-location search.
 * Keys are lowercase; aliases share coordinates.
 */
const CITY_COORDS = {
  delhi: { lat: 28.6139, lng: 77.209 },
  'new delhi': { lat: 28.6139, lng: 77.209 },
  ncr: { lat: 28.6139, lng: 77.209 },
  dwarka: { lat: 28.5921, lng: 77.046 },
  noida: { lat: 28.5355, lng: 77.391 },
  'greater noida': { lat: 28.4744, lng: 77.504 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  ghaziabad: { lat: 28.6692, lng: 77.4538 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  sonipat: { lat: 28.9288, lng: 77.091 },
  bahadurgarh: { lat: 28.6929, lng: 76.9378 },
  meerut: { lat: 28.9845, lng: 77.7064 },
  panipat: { lat: 29.3909, lng: 76.9635 },
  karnal: { lat: 29.6857, lng: 76.9905 },
  rohtak: { lat: 28.8955, lng: 76.6066 },
  rewari: { lat: 28.197, lng: 76.617 },
  palwal: { lat: 28.1487, lng: 77.332 },
  baghpat: { lat: 28.944, lng: 77.219 },
  hapur: { lat: 28.7306, lng: 77.7759 },
  greaterfaridabad: { lat: 28.4089, lng: 77.3178 },
  manesar: { lat: 28.3543, lng: 76.937 },

  mumbai: { lat: 19.076, lng: 72.8777 },
  bombay: { lat: 19.076, lng: 72.8777 },
  'navi mumbai': { lat: 19.033, lng: 73.0297 },
  thane: { lat: 19.2183, lng: 72.9781 },
  kalyan: { lat: 19.2403, lng: 73.1305 },
  dombivali: { lat: 19.218, lng: 73.0868 },
  vasai: { lat: 19.3919, lng: 72.8397 },
  virar: { lat: 19.4559, lng: 72.8111 },
  panvel: { lat: 18.9894, lng: 73.1175 },
  pune: { lat: 18.5204, lng: 73.8567 },
  pimpri: { lat: 18.6298, lng: 73.7997 },
  nashik: { lat: 19.9975, lng: 73.7898 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  aurangabad: { lat: 19.8762, lng: 75.3433 },
  kolhapur: { lat: 16.705, lng: 74.2433 },
  solapur: { lat: 17.6599, lng: 75.9064 },
  navi: { lat: 19.033, lng: 73.0297 },

  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  whitefield: { lat: 12.9698, lng: 77.7499 },
  'electronic city': { lat: 12.8452, lng: 77.6602 },
  mysuru: { lat: 12.2958, lng: 76.6394 },
  mysore: { lat: 12.2958, lng: 76.6394 },
  mangaluru: { lat: 12.9141, lng: 74.856 },
  mangalore: { lat: 12.9141, lng: 74.856 },
  hubli: { lat: 15.3647, lng: 75.124 },
  belgaum: { lat: 15.8497, lng: 74.4977 },

  hyderabad: { lat: 17.385, lng: 78.4867 },
  secunderabad: { lat: 17.4399, lng: 78.4983 },
  warangal: { lat: 17.9689, lng: 79.5941 },
  vijayawada: { lat: 16.5062, lng: 80.648 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  vizag: { lat: 17.6868, lng: 83.2185 },
  guntur: { lat: 16.3067, lng: 80.4365 },
  tirupati: { lat: 13.6288, lng: 79.4192 },

  chennai: { lat: 13.0827, lng: 80.2707 },
  madras: { lat: 13.0827, lng: 80.2707 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  trichy: { lat: 10.7905, lng: 78.7047 },
  salem: { lat: 11.6643, lng: 78.146 },
  tirunelveli: { lat: 8.7139, lng: 77.7567 },
  vellore: { lat: 12.9165, lng: 79.1325 },

  kolkata: { lat: 22.5726, lng: 88.3639 },
  calcutta: { lat: 22.5726, lng: 88.3639 },
  howrah: { lat: 22.5958, lng: 88.2636 },
  durgapur: { lat: 23.52, lng: 87.3119 },
  asansol: { lat: 23.6739, lng: 86.9524 },
  siliguri: { lat: 26.7271, lng: 88.3953 },

  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  gandhinagar: { lat: 23.2156, lng: 72.6369 },
  surat: { lat: 21.1702, lng: 72.8311 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  baroda: { lat: 22.3072, lng: 73.1812 },
  rajkot: { lat: 22.3039, lng: 70.8022 },
  bhavnagar: { lat: 21.7645, lng: 72.1519 },

  jaipur: { lat: 26.9124, lng: 75.7873 },
  jodhpur: { lat: 26.2389, lng: 73.0243 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  kota: { lat: 25.2138, lng: 75.8648 },
  ajmer: { lat: 26.4499, lng: 74.6399 },
  bikaner: { lat: 28.0229, lng: 73.3119 },

  chandigarh: { lat: 30.7333, lng: 76.7794 },
  mohali: { lat: 30.7046, lng: 76.7179 },
  panchkula: { lat: 30.6942, lng: 76.8606 },
  ambala: { lat: 30.3782, lng: 76.7767 },
  ludhiana: { lat: 30.901, lng: 75.8573 },
  amritsar: { lat: 31.634, lng: 74.8723 },
  jalandhar: { lat: 31.326, lng: 75.5762 },
  patiala: { lat: 30.3398, lng: 76.3869 },

  lucknow: { lat: 26.8467, lng: 80.9462 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  agra: { lat: 27.1767, lng: 78.0081 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  prayagraj: { lat: 25.4358, lng: 81.8463 },
  allahabad: { lat: 25.4358, lng: 81.8463 },
  noidaextension: { lat: 28.58, lng: 77.5 },
  ghaziabadncr: { lat: 28.6692, lng: 77.4538 },
  aligarh: { lat: 27.8974, lng: 78.088 },
  bareilly: { lat: 28.367, lng: 79.4304 },
  moradabad: { lat: 28.8386, lng: 78.7733 },
  saharanpur: { lat: 29.968, lng: 77.546 },
  muzaffarnagar: { lat: 29.4727, lng: 77.7085 },

  indore: { lat: 22.7196, lng: 75.8577 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  jabalpur: { lat: 23.1815, lng: 79.9864 },
  gwalior: { lat: 26.2183, lng: 78.1828 },
  raipur: { lat: 21.2514, lng: 81.6296 },
  durg: { lat: 21.1904, lng: 81.2849 },

  patna: { lat: 25.5941, lng: 85.1376 },
  gaya: { lat: 24.7914, lng: 85.0002 },
  ranchi: { lat: 23.3441, lng: 85.3096 },
  jamshedpur: { lat: 22.8046, lng: 86.2029 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  cuttack: { lat: 20.4625, lng: 85.883 },
  guwahati: { lat: 26.1445, lng: 91.7362 },

  kochi: { lat: 9.9312, lng: 76.2673 },
  cochin: { lat: 9.9312, lng: 76.2673 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  trivandrum: { lat: 8.5241, lng: 76.9366 },
  kozhikode: { lat: 11.2588, lng: 75.7804 },
  calicut: { lat: 11.2588, lng: 75.7804 },
  thrissur: { lat: 10.5276, lng: 76.2144 },
  goa: { lat: 15.4909, lng: 73.8278 },
  panaji: { lat: 15.4909, lng: 73.8278 },
  margao: { lat: 15.2736, lng: 73.9581 },
  vasco: { lat: 15.3982, lng: 73.8113 },

  rishikesh: { lat: 30.0869, lng: 78.2676 },
  hrishikesh: { lat: 30.0869, lng: 78.2676 },
  risikesh: { lat: 30.0869, lng: 78.2676 },
  dehradun: { lat: 30.3165, lng: 78.0322 },
  'dehra dun': { lat: 30.3165, lng: 78.0322 },
  dehradoon: { lat: 30.3165, lng: 78.0322 },
  selaqui: { lat: 30.361, lng: 77.861 },
  vikasnagar: { lat: 30.468, lng: 77.774 },
  haridwar: { lat: 29.9457, lng: 78.1642 },
  hardwar: { lat: 29.9457, lng: 78.1642 },
  jwalapur: { lat: 29.926, lng: 78.112 },
  kankhal: { lat: 29.933, lng: 78.143 },
  roorkee: { lat: 29.8543, lng: 77.888 },
  laksar: { lat: 29.749, lng: 78.041 },
  mussoorie: { lat: 30.4598, lng: 78.0644 },
  tehri: { lat: 30.3833, lng: 78.48 },
  kotdwar: { lat: 29.746, lng: 78.522 },
  kotdwara: { lat: 29.746, lng: 78.522 },
  doiwala: { lat: 30.176, lng: 78.116 },
  raiwala: { lat: 30.072, lng: 78.216 },
  pauri: { lat: 30.152, lng: 78.781 },
  haldwani: { lat: 29.2183, lng: 79.513 },
  nainital: { lat: 29.3803, lng: 79.4636 },
  rudrapur: { lat: 28.9875, lng: 79.4141 },
  kashipur: { lat: 29.2136, lng: 78.9569 },
  ramnagar: { lat: 29.3947, lng: 79.128 },
  pithoragarh: { lat: 29.583, lng: 80.218 },
  almora: { lat: 29.597, lng: 79.659 },
  joshimath: { lat: 30.555, lng: 79.564 },

  shimla: { lat: 31.1048, lng: 77.1734 },
  solan: { lat: 30.9045, lng: 77.0967 },
  dharamshala: { lat: 32.219, lng: 76.3234 },
  mandi: { lat: 31.708, lng: 76.932 },
  kullu: { lat: 31.9579, lng: 77.1095 },
  manali: { lat: 32.2396, lng: 77.1887 },
  jammu: { lat: 32.7266, lng: 74.857 },
  srinagar: { lat: 34.0837, lng: 74.7973 },

  pondicherry: { lat: 11.9416, lng: 79.8083 },
  puducherry: { lat: 11.9416, lng: 79.8083 },
};

const METRO_CLUSTERS = [
  ['delhi', 'new delhi', 'ncr', 'noida', 'greater noida', 'gurugram', 'gurgaon', 'ghaziabad', 'faridabad', 'dwarka', 'sonipat', 'bahadurgarh', 'hapur', 'baghpat', 'palwal', 'manesar'],
  ['mumbai', 'bombay', 'navi mumbai', 'thane', 'kalyan', 'dombivali', 'vasai', 'virar', 'panvel'],
  ['bengaluru', 'bangalore', 'whitefield', 'electronic city'],
  ['hyderabad', 'secunderabad'],
  ['kolkata', 'calcutta', 'howrah'],
  ['chennai', 'madras'],
  ['pune', 'pimpri'],
  ['ahmedabad', 'gandhinagar'],
  ['chandigarh', 'mohali', 'panchkula', 'ambala'],
  ['rishikesh', 'hrishikesh', 'risikesh', 'dehradun', 'dehra dun', 'dehradoon', 'haridwar', 'hardwar', 'roorkee', 'mussoorie', 'doiwala', 'raiwala', 'kotdwar', 'kotdwara', 'selaqui', 'jwalapur', 'kankhal', 'laksar'],
];

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function normalizePlace(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\/|,._-]+/g, ' ')
    .replace(/\b(nearby|near by|near|around|within|kms?|kilomet(?:re|er)s?|india)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

function fuzzyCityKey(key) {
  const max = key.length >= 8 ? 2 : key.length >= 5 ? 1 : 0;
  if (!max) return '';
  let best = '';
  let bestD = 99;
  for (const city of Object.keys(CITY_COORDS)) {
    if (Math.abs(city.length - key.length) > max) continue;
    const d = editDistance(key, city);
    if (d < bestD || (d === bestD && city.length > best.length)) {
      bestD = d;
      best = city;
    }
  }
  return bestD <= max ? best : '';
}

function resolveCityKey(name) {
  const key = normalizePlace(name);
  if (!key) return '';
  if (CITY_COORDS[key]) return key;
  let best = '';
  for (const city of Object.keys(CITY_COORDS)) {
    if (key === city) return city;
    if (key.includes(city) && city.length >= 4 && city.length > best.length) best = city;
  }
  if (best) return best;
  return fuzzyCityKey(key);
}

function coordsForPlace(name) {
  const key = resolveCityKey(name);
  return key && CITY_COORDS[key] ? CITY_COORDS[key] : null;
}

/**
 * Cities within `km` of the typed location, including the original text.
 * Radius 0 = this city and same-spot aliases only.
 */
function nearbyCityNames(location, km = 50) {
  const original = String(location || '').trim();
  if (!original) return [];
  const names = new Set([original]);
  const key = resolveCityKey(original);
  if (key) names.add(key);
  if (!key || !CITY_COORDS[key]) return [...names];
  const origin = CITY_COORDS[key];
  const radius = Number.isFinite(Number(km)) && Number(km) >= 0 ? Number(km) : 50;
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (haversineKm(origin, coords) <= radius + 0.5) names.add(city);
  }
  if (radius > 0) {
    for (const cluster of METRO_CLUSTERS) {
      if (!cluster.includes(key)) continue;
      for (const city of cluster) {
        const coords = CITY_COORDS[city];
        if (coords && haversineKm(origin, coords) <= Math.max(radius, 55) + 0.5) names.add(city);
      }
    }
  }
  return [...names];
}

function cityOptionLabels() {
  const skip = new Set([
    'bombay', 'madras', 'calcutta', 'ncr', 'hardwar', 'dehra dun', 'kotdwara',
    'vizag', 'baroda', 'cochin', 'trivandrum', 'calicut', 'allahabad', 'gurgaon',
    'hrishikesh', 'risikesh', 'dehradoon', 'greaterfaridabad', 'ghaziabadncr', 'noidaextension',
  ]);
  const seen = new Set();
  const labels = [];
  for (const key of Object.keys(CITY_COORDS)) {
    if (skip.has(key)) continue;
    const label = key.replace(/\b\w/g, (c) => c.toUpperCase());
    const dedupe = label.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    labels.push(label);
  }
  return labels.sort((a, b) => a.localeCompare(b));
}

module.exports = {
  CITY_COORDS,
  METRO_CLUSTERS,
  haversineKm,
  resolveCityKey,
  nearbyCityNames,
  normalizePlace,
  coordsForPlace,
  cityOptionLabels,
};
