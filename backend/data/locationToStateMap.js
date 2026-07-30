// Location to State Mapping - Indian Cities & States
const locationToStateMap = {
  // Maharashtra
  'mumbai': 'Maharashtra',
  'bombay': 'Maharashtra',
  'pune': 'Maharashtra',
  'nagpur': 'Maharashtra',
  'nashik': 'Maharashtra',
  'aurangabad': 'Maharashtra',
  'kolhapur': 'Maharashtra',
  'navi mumbai': 'Maharashtra',
  'dombivali': 'Maharashtra',
  'thane': 'Maharashtra',
  'kalyan': 'Maharashtra',
  'vasai': 'Maharashtra',
  'virar': 'Maharashtra',
  'palghar': 'Maharashtra',

  // Karnataka
  'bangalore': 'Karnataka',
  'bengaluru': 'Karnataka',
  'mysore': 'Karnataka',
  'mysuru': 'Karnataka',
  'mangalore': 'Karnataka',
  'mangaluru': 'Karnataka',
  'belgaum': 'Karnataka',
  'belagavi': 'Karnataka',
  'hubli': 'Karnataka',
  'hubballi': 'Karnataka',
  'dharwad': 'Karnataka',
  'davanagere': 'Karnataka',
  'tumkur': 'Karnataka',
  'shimoga': 'Karnataka',
  'shivamogga': 'Karnataka',
  'kolar': 'Karnataka',

  // Tamil Nadu
  'chennai': 'Tamil Nadu',
  'madras': 'Tamil Nadu',
  'coimbatore': 'Tamil Nadu',
  'salem': 'Tamil Nadu',
  'madurai': 'Tamil Nadu',
  'trichy': 'Tamil Nadu',
  'tiruppur': 'Tamil Nadu',
  'salem': 'Tamil Nadu',
  'vellore': 'Tamil Nadu',
  'thoothukudi': 'Tamil Nadu',
  'tuticorin': 'Tamil Nadu',

  // Telangana
  'hyderabad': 'Telangana',
  'secunderabad': 'Telangana',
  'warangal': 'Telangana',
  'vijayawada': 'Telangana',
  'visakhapatnam': 'Telangana',

  // Delhi
  'delhi': 'Delhi',
  'new delhi': 'Delhi',
  'new delhiм': 'Delhi',
  'dwarka': 'Delhi',
  'gurgaon': 'Delhi',
  'gurugram': 'Delhi',
  'noida': 'Delhi',
  'faridabad': 'Delhi',

  // Rajasthan
  'jaipur': 'Rajasthan',
  'jodhpur': 'Rajasthan',
  'udaipur': 'Rajasthan',
  'ajmer': 'Rajasthan',
  'bikaner': 'Rajasthan',
  'kota': 'Rajasthan',
  'sikar': 'Rajasthan',
  'alwar': 'Rajasthan',

  // Gujarat
  'ahmedabad': 'Gujarat',
  'surat': 'Gujarat',
  'vadodara': 'Gujarat',
  'rajkot': 'Gujarat',
  'gandhinagar': 'Gujarat',
  'bhavnagar': 'Gujarat',
  'anand': 'Gujarat',
  'junagadh': 'Gujarat',
  'morbi': 'Gujarat',

  // West Bengal
  'kolkata': 'West Bengal',
  'calcutta': 'West Bengal',
  'asansol': 'West Bengal',
  'siliguri': 'West Bengal',
  'darjeeling': 'West Bengal',
  'howrah': 'West Bengal',
  'durgapur': 'West Bengal',

  // Uttar Pradesh
  'lucknow': 'Uttar Pradesh',
  'kanpur': 'Uttar Pradesh',
  'agra': 'Uttar Pradesh',
  'varanasi': 'Uttar Pradesh',
  'meerut': 'Uttar Pradesh',
  'ghaziabad': 'Uttar Pradesh',
  'noida': 'Uttar Pradesh',
  'allahabad': 'Uttar Pradesh',
  'prayagraj': 'Uttar Pradesh',
  'bareilly': 'Uttar Pradesh',

  // Madhya Pradesh
  'indore': 'Madhya Pradesh',
  'bhopal': 'Madhya Pradesh',
  'jabalpur': 'Madhya Pradesh',
  'gwalior': 'Madhya Pradesh',
  'ujjain': 'Madhya Pradesh',
  'raipur': 'Madhya Pradesh',

  // Bihar
  'patna': 'Bihar',
  'gaya': 'Bihar',
  'bhagalpur': 'Bihar',
  'muzaffarpur': 'Bihar',
  'darbhanga': 'Bihar',

  // Haryana
  'faridabad': 'Haryana',
  'gurgaon': 'Haryana',
  'gurugram': 'Haryana',
  'hisar': 'Haryana',
  'rohtak': 'Haryana',
  'panipat': 'Haryana',

  // Punjab
  'chandigarh': 'Punjab',
  'ludhiana': 'Punjab',
  'amritsar': 'Punjab',
  'jalandhar': 'Punjab',
  'patiala': 'Punjab',

  // Kerala
  'kochi': 'Kerala',
  'cochin': 'Kerala',
  'thiruvananthapuram': 'Kerala',
  'trivandrum': 'Kerala',
  'kozhikode': 'Kerala',
  'calicut': 'Kerala',
  'alappuzha': 'Kerala',
  'kottayam': 'Kerala',

  // Andhra Pradesh
  'hyderabad': 'Andhra Pradesh',
  'visakhapatnam': 'Andhra Pradesh',
  'vijayawada': 'Andhra Pradesh',
  'tirupati': 'Andhra Pradesh',
  'nellore': 'Andhra Pradesh',

  // Odisha
  'bhubaneswar': 'Odisha',
  'cuttack': 'Odisha',
  'rourkela': 'Odisha',
  'sambalpur': 'Odisha',
  'balangir': 'Odisha',

  // Jharkhand
  'ranchi': 'Jharkhand',
  'dhanbad': 'Jharkhand',
  'jamshedpur': 'Jharkhand',
  'bokaro': 'Jharkhand',
  'hazaribagh': 'Jharkhand',

  // Himachal Pradesh
  'shimla': 'Himachal Pradesh',
  'simla': 'Himachal Pradesh',
  'solan': 'Himachal Pradesh',
  'mandi': 'Himachal Pradesh',
  'kullu': 'Himachal Pradesh',

  // Uttarakhand
  'dehradun': 'Uttarakhand',
  'haridwar': 'Uttarakhand',
  'rishikesh': 'Uttarakhand',
  'nainital': 'Uttarakhand',
  'almora': 'Uttarakhand',

  // Goa
  'goa': 'Goa',
  'panaji': 'Goa',
  'vasco': 'Goa',
  'margao': 'Goa',

  // Assam
  'guwahati': 'Assam',
  'silchar': 'Assam',
  'dibrugarh': 'Assam',
  'nagaon': 'Assam',

  // Meghalaya
  'shillong': 'Meghalaya',
  'tura': 'Meghalaya',

  // Manipur
  'imphal': 'Manipur',

  // Mizoram
  'aizawl': 'Mizoram',

  // Nagaland
  'kohima': 'Nagaland',
  'dimapur': 'Nagaland',

  // Tripura
  'agartala': 'Tripura',

  // Arunachal Pradesh
  'itanagar': 'Arunachal Pradesh',

  // Sikkim
  'gangtok': 'Sikkim',
};

/**
 * Get state from location name
 * @param {string} location - City or location name
 * @returns {string} State name or 'Unknown'
 */
function getStateFromLocation(location) {
  if (!location) return null;
  
  // Normalize: trim, lowercase
  const normalized = String(location).toLowerCase().trim();
  
  // Direct lookup
  if (locationToStateMap[normalized]) {
    return locationToStateMap[normalized];
  }
  
  // Partial match (check if beginning matches)
  for (const [city, state] of Object.entries(locationToStateMap)) {
    if (city.includes(normalized) || normalized.includes(city)) {
      return state;
    }
  }
  
  return 'Unknown';
}

module.exports = { locationToStateMap, getStateFromLocation };
