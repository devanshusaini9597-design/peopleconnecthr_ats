/**
 * Locale helpers for Organization settings — country ↔ currency + common timezones.
 */

export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC', description: 'Coordinated Universal Time' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu', description: 'Hawaii' },
  { value: 'America/Anchorage', label: 'America/Anchorage', description: 'Alaska' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles', description: 'US Pacific' },
  { value: 'America/Denver', label: 'America/Denver', description: 'US Mountain' },
  { value: 'America/Chicago', label: 'America/Chicago', description: 'US Central' },
  { value: 'America/New_York', label: 'America/New_York', description: 'US Eastern' },
  { value: 'America/Toronto', label: 'America/Toronto', description: 'Canada Eastern' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo', description: 'Brazil' },
  { value: 'America/Mexico_City', label: 'America/Mexico_City', description: 'Mexico' },
  { value: 'Europe/London', label: 'Europe/London', description: 'UK / Ireland' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin', description: 'Ireland' },
  { value: 'Europe/Paris', label: 'Europe/Paris', description: 'Central Europe' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin', description: 'Germany' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam', description: 'Netherlands' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid', description: 'Spain' },
  { value: 'Europe/Rome', label: 'Europe/Rome', description: 'Italy' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw', description: 'Poland' },
  { value: 'Europe/Athens', label: 'Europe/Athens', description: 'Greece' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow', description: 'Russia' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo', description: 'Egypt' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg', description: 'South Africa' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos', description: 'Nigeria' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai', description: 'UAE' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh', description: 'Saudi Arabia' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi', description: 'Pakistan' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata', description: 'India' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka', description: 'Bangladesh' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok', description: 'Thailand' },
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta', description: 'Indonesia' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore', description: 'Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong', description: 'Hong Kong' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai', description: 'China' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei', description: 'Taiwan' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo', description: 'Japan' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul', description: 'South Korea' },
  { value: 'Australia/Perth', label: 'Australia/Perth', description: 'Australia West' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney', description: 'Australia East' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland', description: 'New Zealand' },
];

/** Country list: value = ISO country code, currency stored separately */
export const COUNTRY_CURRENCY_OPTIONS = [
  { value: 'US', label: 'United States', description: 'USD ($)', currency: 'USD', flagIso: 'us' },
  { value: 'IN', label: 'India', description: 'INR (₹)', currency: 'INR', flagIso: 'in' },
  { value: 'GB', label: 'United Kingdom', description: 'GBP (£)', currency: 'GBP', flagIso: 'gb' },
  { value: 'CA', label: 'Canada', description: 'CAD (C$)', currency: 'CAD', flagIso: 'ca' },
  { value: 'AU', label: 'Australia', description: 'AUD (A$)', currency: 'AUD', flagIso: 'au' },
  { value: 'NZ', label: 'New Zealand', description: 'NZD (NZ$)', currency: 'NZD', flagIso: 'nz' },
  { value: 'IE', label: 'Ireland', description: 'EUR (€)', currency: 'EUR', flagIso: 'ie' },
  { value: 'DE', label: 'Germany', description: 'EUR (€)', currency: 'EUR', flagIso: 'de' },
  { value: 'FR', label: 'France', description: 'EUR (€)', currency: 'EUR', flagIso: 'fr' },
  { value: 'ES', label: 'Spain', description: 'EUR (€)', currency: 'EUR', flagIso: 'es' },
  { value: 'IT', label: 'Italy', description: 'EUR (€)', currency: 'EUR', flagIso: 'it' },
  { value: 'NL', label: 'Netherlands', description: 'EUR (€)', currency: 'EUR', flagIso: 'nl' },
  { value: 'BE', label: 'Belgium', description: 'EUR (€)', currency: 'EUR', flagIso: 'be' },
  { value: 'PT', label: 'Portugal', description: 'EUR (€)', currency: 'EUR', flagIso: 'pt' },
  { value: 'AT', label: 'Austria', description: 'EUR (€)', currency: 'EUR', flagIso: 'at' },
  { value: 'FI', label: 'Finland', description: 'EUR (€)', currency: 'EUR', flagIso: 'fi' },
  { value: 'GR', label: 'Greece', description: 'EUR (€)', currency: 'EUR', flagIso: 'gr' },
  { value: 'CH', label: 'Switzerland', description: 'CHF', currency: 'CHF', flagIso: 'ch' },
  { value: 'SE', label: 'Sweden', description: 'SEK', currency: 'SEK', flagIso: 'se' },
  { value: 'NO', label: 'Norway', description: 'NOK', currency: 'NOK', flagIso: 'no' },
  { value: 'DK', label: 'Denmark', description: 'DKK', currency: 'DKK', flagIso: 'dk' },
  { value: 'PL', label: 'Poland', description: 'PLN', currency: 'PLN', flagIso: 'pl' },
  { value: 'CZ', label: 'Czechia', description: 'CZK', currency: 'CZK', flagIso: 'cz' },
  { value: 'RO', label: 'Romania', description: 'RON', currency: 'RON', flagIso: 'ro' },
  { value: 'HU', label: 'Hungary', description: 'HUF', currency: 'HUF', flagIso: 'hu' },
  { value: 'UA', label: 'Ukraine', description: 'UAH', currency: 'UAH', flagIso: 'ua' },
  { value: 'RU', label: 'Russia', description: 'RUB', currency: 'RUB', flagIso: 'ru' },
  { value: 'TR', label: 'Turkey', description: 'TRY', currency: 'TRY', flagIso: 'tr' },
  { value: 'AE', label: 'United Arab Emirates', description: 'AED', currency: 'AED', flagIso: 'ae' },
  { value: 'SA', label: 'Saudi Arabia', description: 'SAR', currency: 'SAR', flagIso: 'sa' },
  { value: 'QA', label: 'Qatar', description: 'QAR', currency: 'QAR', flagIso: 'qa' },
  { value: 'KW', label: 'Kuwait', description: 'KWD', currency: 'KWD', flagIso: 'kw' },
  { value: 'BH', label: 'Bahrain', description: 'BHD', currency: 'BHD', flagIso: 'bh' },
  { value: 'OM', label: 'Oman', description: 'OMR', currency: 'OMR', flagIso: 'om' },
  { value: 'IL', label: 'Israel', description: 'ILS', currency: 'ILS', flagIso: 'il' },
  { value: 'EG', label: 'Egypt', description: 'EGP', currency: 'EGP', flagIso: 'eg' },
  { value: 'ZA', label: 'South Africa', description: 'ZAR', currency: 'ZAR', flagIso: 'za' },
  { value: 'NG', label: 'Nigeria', description: 'NGN', currency: 'NGN', flagIso: 'ng' },
  { value: 'KE', label: 'Kenya', description: 'KES', currency: 'KES', flagIso: 'ke' },
  { value: 'GH', label: 'Ghana', description: 'GHS', currency: 'GHS', flagIso: 'gh' },
  { value: 'PK', label: 'Pakistan', description: 'PKR', currency: 'PKR', flagIso: 'pk' },
  { value: 'BD', label: 'Bangladesh', description: 'BDT', currency: 'BDT', flagIso: 'bd' },
  { value: 'LK', label: 'Sri Lanka', description: 'LKR', currency: 'LKR', flagIso: 'lk' },
  { value: 'NP', label: 'Nepal', description: 'NPR', currency: 'NPR', flagIso: 'np' },
  { value: 'SG', label: 'Singapore', description: 'SGD', currency: 'SGD', flagIso: 'sg' },
  { value: 'MY', label: 'Malaysia', description: 'MYR', currency: 'MYR', flagIso: 'my' },
  { value: 'ID', label: 'Indonesia', description: 'IDR', currency: 'IDR', flagIso: 'id' },
  { value: 'TH', label: 'Thailand', description: 'THB', currency: 'THB', flagIso: 'th' },
  { value: 'VN', label: 'Vietnam', description: 'VND', currency: 'VND', flagIso: 'vn' },
  { value: 'PH', label: 'Philippines', description: 'PHP', currency: 'PHP', flagIso: 'ph' },
  { value: 'JP', label: 'Japan', description: 'JPY (¥)', currency: 'JPY', flagIso: 'jp' },
  { value: 'KR', label: 'South Korea', description: 'KRW (₩)', currency: 'KRW', flagIso: 'kr' },
  { value: 'CN', label: 'China', description: 'CNY (¥)', currency: 'CNY', flagIso: 'cn' },
  { value: 'HK', label: 'Hong Kong', description: 'HKD', currency: 'HKD', flagIso: 'hk' },
  { value: 'TW', label: 'Taiwan', description: 'TWD', currency: 'TWD', flagIso: 'tw' },
  { value: 'BR', label: 'Brazil', description: 'BRL (R$)', currency: 'BRL', flagIso: 'br' },
  { value: 'MX', label: 'Mexico', description: 'MXN', currency: 'MXN', flagIso: 'mx' },
  { value: 'AR', label: 'Argentina', description: 'ARS', currency: 'ARS', flagIso: 'ar' },
  { value: 'CL', label: 'Chile', description: 'CLP', currency: 'CLP', flagIso: 'cl' },
  { value: 'CO', label: 'Colombia', description: 'COP', currency: 'COP', flagIso: 'co' },
  { value: 'PE', label: 'Peru', description: 'PEN', currency: 'PEN', flagIso: 'pe' },
];

export const DATE_FORMAT_OPTIONS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', description: 'US format' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', description: 'EU / India format' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', description: 'ISO format' },
];

export function detectBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Prefer an exact country match for a currency; fall back to first match. */
export function countryForCurrency(currencyCode) {
  if (!currencyCode) return '';
  const preferred = {
    USD: 'US', INR: 'IN', GBP: 'GB', EUR: 'IE', CAD: 'CA', AUD: 'AU',
    JPY: 'JP', CNY: 'CN', SGD: 'SG', AED: 'AE',
  };
  if (preferred[currencyCode]) return preferred[currencyCode];
  const hit = COUNTRY_CURRENCY_OPTIONS.find((c) => c.currency === currencyCode);
  return hit?.value || '';
}

export function currencyForCountry(countryCode) {
  return COUNTRY_CURRENCY_OPTIONS.find((c) => c.value === countryCode)?.currency || 'USD';
}
