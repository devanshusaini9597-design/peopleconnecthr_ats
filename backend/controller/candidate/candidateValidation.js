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

    // Block letters (ALL CAPS) — consistent with Candidate storage
    fixed = fixed.replace(/\s+/g, ' ').toUpperCase();

    // Check if length >= 2 and only has alphabets and spaces
    const isValid = fixed.length >= 2 && /^[A-Z\s]+$/.test(fixed);

    return { isValid, value: fixed };
};

const is100PercentCorrect = (candidate) => {
    const emailCheck = validateAndFixEmail(candidate.email);
    const mobileCheck = validateAndFixMobile(candidate.contact);
    const nameCheck = validateAndFixName(candidate.name);

    return emailCheck.isValid && mobileCheck.isValid && nameCheck.isValid;
};

const { orgOrOwnerScope, candidateWriteScope, candidateResumeScope } = require('../../utils/dataScope');

module.exports = {
    validateAndFixEmail,
    validateAndFixMobile,
    validateAndFixName,
    is100PercentCorrect,
    orgOrOwnerScope,
    candidateWriteScope,
    candidateResumeScope,
};
