const net = require('net');

const ipv4ToLong = (ip) => {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

const matchIpv4Cidr = (ip, cidr) => {
  const [range, bitsStr] = cidr.split('/');
  const bits = bitsStr ? parseInt(bitsStr, 10) : 32;
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  if (ipLong === null || rangeLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
};

/**
 * @param {string} clientIp
 * @param {string[]} allowlist - exact IPs or IPv4 CIDR (e.g. 10.0.0.0/8)
 */
const ipMatchesAllowlist = (clientIp, allowlist) => {
  if (!clientIp || !allowlist?.length) return true;
  const normalized = clientIp.replace(/^::ffff:/, '');
  for (const entry of allowlist) {
    const rule = String(entry).trim();
    if (!rule) continue;
    if (rule.includes('/')) {
      if (matchIpv4Cidr(normalized, rule)) return true;
    } else if (net.isIP(normalized) && net.isIP(rule) && normalized === rule) {
      return true;
    } else if (normalized === rule) {
      return true;
    }
  }
  return false;
};

module.exports = { ipMatchesAllowlist, getClientIp: require('./clientIp').getClientIp };
