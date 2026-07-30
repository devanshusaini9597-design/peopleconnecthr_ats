#!/usr/bin/env node

// PARAMETERS & VALIDATION RULES USED IN ENTERPRISE ATS
// This document lists ALL parameters being used for field detection

const parameters = {
  "GLOBAL_SETTINGS": {
    "dataSource": "All file formats (XLSX, CSV, etc)",
    "columnDetection": "Content-based (not position-based)",
    "conflictResolution": "Prioritize by field context + column hints",
    "autoCorrection": "Applied to all detected values before import",
    "placeholderHandling": "All placeholder values rejected globally"
  },

  "FIELDS_AND_KEYWORDS": {
    "NAME": {
      "allowedLength": "2-40 characters",
      "allowedWords": "2-4 words",
      "allowedCharacters": ["Letters (Unicode)", "Spaces", "Hyphens", "Apostrophes"],
      "rejectedKeywords": ["interested", "scheduled", "rejected", "developer", "engineer", "manager", "pvt", "ltd", "bangalore"],
      "priority": "FLS/Non-FLS column > Name column > Other columns"
    },

    "PHONE": {
      "format": "Indian 10-digit mobile",
      "startingDigits": ["6", "7", "8", "9"],
      "formats": ["7359355840", "+91-735-9355840", "91-735-9355840", "(+91) 735 9355840"],
      "validation": "Strip non-digits, take last 10, must start with 6-9"
    },

    "EMAIL": {
      "format": "RFC 5322",
      "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
      "examples": ["user@example.com", "first.last@company.co.in"]
    },

    "POSITION": {
      "keywords": [
        "Developer", "Engineer", "Manager", "Lead", "Analyst", "Designer",
        "Architect", "Consultant", "Specialist", "Executive", "Officer", "Coordinator",
        "Supervisor", "Associate", "Senior", "Junior", "Trainee", "Intern", "Director",
        "Head", "CEO", "CFO", "CTO", "QA", "Tester", "Business", "Sales", "Marketing",
        "HR", "Finance", "Operations", "SO", "Non-FLS"
      ],
      "priority": "Column with 'position' header > Content match"
    },

    "CTC": {
      "formats": ["1LPA", "2.5 LPA", "1,50,000", "150K", "1.5L", "1,20,000 lac"],
      "minimumValue": "1.5 LPA",
      "maximumValue": "100 LPA",
      "rejectedValues": ["Plain numbers < 1.5", "> 100", "As per company norms", "Negotiable"],
      "priority": "Column with 'ctc' header > 'salary' header"
    },

    "EXPERIENCE": {
      "requiresSuffix": "YES - Must have yrs/years/y/months",
      "formats": ["7.9 Yrs", "0.3 Years", "1.5 years", "10 y", "3 months", "Fresher"],
      "minimumValue": "0.1 years",
      "maximumValue": "70 years",
      "rejectedValues": ["Plain numbers like 1, 2, 0.3", "Values > 70"],
      "unitConversion": {"months": "÷ 12 to years"}
    },

    "NOTICE_PERIOD": {
      "formats": ["90 days", "3 months", "2 weeks", "Immediate", "immedidate joinner"],
      "minimumValue": "0 days",
      "maximumValue": "365 days",
      "unitConversion": {"months": "× 30", "weeks": "× 7"},
      "strictPlainNumbers": "ONLY pure digits (29, 60, 90) - no suffixes like '1lpa'"
    },

    "STATUS": {
      "keywords": [
        "Applied", "Interested", "Intersted", "Scheduled", "Interviewed", "Rejected",
        "Joined", "Pending", "Active", "On hold", "Not interested", "Hold", "Selected",
        "Offered", "Accepted", "Declined", "Didn't attend", "Referred",
        "Under consideration", "Offer received"
      ],
      "matchType": "Case-insensitive substring"
    },

    "LOCATION": {
      "keywords": [
        "Vadodara", "Bangalore", "Mumbai", "Delhi", "Pune", "Hyderabad", "Surat",
        "Ahmedabad", "Chennai", "Kolkata", "Jaipur", "Chandigarh", "Indore", "Lucknow",
        "Kochi", "Gurgaon", "Noida", "Thane"
      ],
      "formatKeywords": ["Remote", "Work from home", "WFH", "Tier"]
    },

    "COMPANY": {
      "keywords": [
        "Pvt", "Ltd", "LLP", "Solutions", "Technologies", "Systems", "Services",
        "Company", "Corp", "Bank", "Finance", "Insurance", "Consulting", "Group",
        "HSBC", "Canara", "ICICI", "HDFC", "Axis", "Kotak", "YES", "Equitas", "Utkarsh",
        "IndusInd", "RBL", "IDBI", "SBI", "BOI", "Syndicate", "Union", "Bob",
        "TCS", "Infosys", "Wipro", "Cognizant", "Deloitte", "Accenture", "IBM",
        "Microsoft", "Google", "Amazon", "Flipkart", "Uber"
      ],
      "rejectedPatterns": ["Person names", "Experience values", "Email addresses", "Phone numbers"],
      "minimumLength": "2 words OR contains org keywords"
    },

    "SOURCE": {
      "keywords": [
        "Naukri", "LinkedIn", "Referral", "Indeed", "Walk-in", "Monster",
        "Glassdoor", "Job portal", "Agency", "College", "Campus", "Email",
        "Direct", "Recruiter", "Internal", "Networking", "Portal", "Social",
        "Facebook", "Twitter", "Instagram", "WhatsApp", "Recruitment", "Placement",
        "Consultant", "Headhunter"
      ]
    }
  },

  "PLACEHOLDER_VALUES": {
    "rejected": [
      "NA", "N/A", "no", "—", "-", "", "null", "undefined",
      "As per company norms", "TBD", "Will share", "Negotiable",
      "Flexible", "To be", "Open", "Competitive"
    ]
  },

  "AUTO_CORRECTIONS": {
    "name": "Title case (John Smith)",
    "email": "Lowercase",
    "phone": "10 digits only",
    "experience": "Decimal number (7.9)",
    "ctc": "LPA value (2.5)",
    "noticePeriod": "Days (90)"
  },

  "CONFLICT_RESOLUTION_ORDER": [
    "1. Prefer value from column with matching header keyword",
    "2. For names: Prefer FLS/Non-FLS column over others",
    "3. For phones: Prefer Contact/Phone columns",
    "4. For email: Prefer Email column",
    "5. If tied: Use value quality/length criteria",
    "6. For multiple org names: Map by context (company vs client)"
  ],

  "VALIDATION_RULES": {
    "READY": "All critical fields (name, phone, email, position, ctc) present",
    "REVIEW": "Some critical fields missing - manual review needed",
    "BLOCKED": "Invalid data or too many missing fields"
  }
};

// Print formatted report
console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║     VALIDATION RULES & PARAMETERS - ENTERPRISE ATS DATA MIGRATION SYSTEM        ║');
console.log('║                         SHOW TO YOUR CLIENTS                                   ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('GLOBAL SETTINGS:\n');
Object.entries(parameters.GLOBAL_SETTINGS).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n' + '─'.repeat(88) + '\n');
console.log('FIELD-SPECIFIC PARAMETERS:\n');

Object.entries(parameters.FIELDS_AND_KEYWORDS).forEach(([field, config]) => {
  console.log(`\n📌 ${field}`);
  if (config.keywords) console.log(`   Keywords: ${config.keywords.slice(0, 5).join(', ')}... (+${config.keywords.length - 5} more)`);
  if (config.formats) console.log(`   Formats: ${config.formats.join(', ')}`);
  if (config.minimumValue) console.log(`   Range: ${config.minimumValue} to ${config.maximumValue}`);
  if (config.pattern) console.log(`   Regex: ${config.pattern}`);
  if (config.requiresSuffix === 'YES') console.log(`   ⚠️  REQUIRES SUFFIX (yrs/years/months)`);
  if (config.rejectedValues) console.log(`   Rejects: ${config.rejectedValues.join(', ')}`);
});

console.log('\n' + '─'.repeat(88) + '\n');
console.log('PLACEHOLDER VALUES (REJECTED FROM ALL FIELDS):\n');
parameters.PLACEHOLDER_VALUES.rejected.forEach(v => console.log(`  • ${v}`));

console.log('\n' + '─'.repeat(88) + '\n');
console.log('CONFLICT RESOLUTION:\n');
parameters.CONFLICT_RESOLUTION_ORDER.forEach(line => console.log(`  ${line}`));

console.log('\n' + '─'.repeat(88) + '\n');
console.log('VALIDATION RESULTS:\n');
Object.entries(parameters.VALIDATION_RULES).forEach(([status, desc]) => {
  console.log(`  ${status}: ${desc}`);
});

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  Present this document to your clients to show transparency in data processing  ║');
console.log('║  All parameters are configurable based on client requirements                   ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// Export as JSON
require('fs').writeFileSync('validation-parameters.json', JSON.stringify(parameters, null, 2));
console.log('✓ Parameters exported to: validation-parameters.json\n');
