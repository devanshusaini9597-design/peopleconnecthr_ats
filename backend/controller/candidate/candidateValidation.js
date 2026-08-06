// ✅ VALIDATION AND AUTO-FIX HELPERS

const validateAndFixEmail = (email) => {
    if (!email) return { isValid: false, value: '' };

    let fixed = String(email).trim().toLowerCase();

    // Check if it has @ and valid domain format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(fixed);

    return { isValid, value: fixed };
};

const validateAndFixMobile = (mobile) => {
    if (!mobile) return { isValid: false, value: '' };

    // Remove all non-digits first
    let digitsOnly = String(mobile).replace(/\D/g, '');

    // If it has +91 country code, remove it and take last 10 digits
    if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
        digitsOnly = digitsOnly.slice(-10);
    }

    // Take only last 10 digits if more than 10
    if (digitsOnly.length > 10) {
        digitsOnly = digitsOnly.slice(-10);
    }

    // Check if exactly 10 digits and starts with 6-9
    const isValid = digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly);

    return { isValid, value: digitsOnly };
};

const validateAndFixName = (name) => {
    if (!name) return { isValid: false, value: '' };

    // Remove all digits and special characters, keep only alphabets and spaces
    let fixed = String(name).replace(/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?/\\|`~-]/g, '').trim();

    // Convert to title case (First letter of each word capitalized)
    fixed = fixed.split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    // Check if length >= 2 and only has alphabets and spaces
    const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);

    return { isValid, value: fixed };
};

const is100PercentCorrect = (candidate) => {
    const emailCheck = validateAndFixEmail(candidate.email);
    const mobileCheck = validateAndFixMobile(candidate.contact);
    const nameCheck = validateAndFixName(candidate.name);

    return emailCheck.isValid && mobileCheck.isValid && nameCheck.isValid;
};

/** Tenant boundary: same-org access, or createdBy-only for legacy accounts. */
const orgOrOwnerScope = (req) => (
    req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id }
);

module.exports = {
    validateAndFixEmail,
    validateAndFixMobile,
    validateAndFixName,
    is100PercentCorrect,
    orgOrOwnerScope,
};
