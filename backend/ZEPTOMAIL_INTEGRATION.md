
# 📧 Skillnix Zoho Zeptomail Integration Guide

## Overview

Your Skillnix PCHR system is now integrated with **Zoho Zeptomail** email service! This allows all employees to send professional emails directly through your Zoho account.

## Your Zoho Credentials (from setup)

```
Domain: skillnixrecruitment.com
Host: api.zeptomail.in
From Email: noreply@skillnixrecruitment.com (or your configured sender)
API Endpoint: https://api.zeptomail.in/
Agent Alias: 13bd1520ca0ff0aa
API Key: PHtE6r1bQujuiWQn9BMDt6e6FJaiPIkq/u9gLQdG5N1GC6RXHU1VrtEtlWDh+hYjAKEXQPWdzIprtbjJte3UJ2foPDofWGqyqK3sx/VYSPOZsbq6x00ctV8Yd0DaVoHoddNv1yfTv9/ZNA==
```

## 🚀 Quick Start

### Option 1: Using the Setup Script (Recommended)

```bash
cd backend
node setup-zoho-config.js
```

This interactive script will:
1. Prompt you for your Zoho API credentials
2. Test the credentials by sending a test email
3. Save the configuration to the database
4. Confirm that all employees can now send emails

### Option 2: Using the API Directly

Make a POST request to configure Zoho:

```bash
curl -X PUT http://localhost:5000/api/company-email-settings/zoho-zeptomail \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "zohoZeptomailApiKey": "PHtE6r1bQujuiWQn9BMDt6e6FJaiPIkq/u9gLQdG5N1GC6RXHU1VrtEtlWDh+hYjAKEXQPWdzIprtbjJte3UJ2foPDofWGqyqK3sx/VYSPOZsbq6x00ctV8Yd0DaVoHoddNv1yfTv9/ZNA==",
    "zohoZeptomailApiUrl": "https://api.zeptomail.in/",
    "zohoZeptomailFromEmail": "noreply@skillnixrecruitment.com"
  }'
```

## 📧 How to Send Emails

### From the ATS Dashboard:

1. **Find a Candidate** - Click on any candidate row in the ATS
2. **Click the Mail Icon** - In the candidate details, find and click the envelope/mail icon
3. **Choose Your Mode**:
   - **Use Template** - Select from pre-made email templates (email templates, interview calls, etc.)
   - **Quick Send** - Write a custom email on the fly
4. **Select Template** - Choose from categories:
   - 📋 **Hiring Drive** - For job announcements
   - 📞 **Interview** - For interview scheduling
   - ❌ **Rejection** - For rejection notifications
   - 📄 **Document** - For document collection
   - 🎯 **Onboarding** - For new hire onboarding
   - ✨ **Custom** - Your custom templates
5. **Fill Variables** - Replace placeholder variables:
   - `{{candidateName}}` → Candidate's name
   - `{{position}}` → Job position
   - `{{company}}` → Company name
   - `{{ctc}}` → Salary/CTC
   - `{{location}}` → Job location
   - Other custom variables you've created
6. **Add CC/BCC** (optional) - Add additional recipients
7. **Send** - Click send, and the email will be delivered via your Zoho account!

### From Email Templates Page:

1. Go to **Profile → Email Templates**
2. **Create/Edit Template** - Define your email templates with variables
3. **Preview** - See how the email looks with sample data
4. **Send** - Later, send emails using these templates from the ATS

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  - User clicks mail icon or goes to Email Templates page     │
│  - Selects template and fills in variables                   │
│  - Sends request to backend API                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js Express)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Email Routes & Controllers                   │   │
│  │  - /api/email/send - Send single email               │   │
│  │  - /api/email-templates - Manage templates           │   │
│  │  - /api/company-email-settings - Company config      │   │
│  └────────┬─────────────────────────────────────────────┘   │
│           │                                                   │
│           ↓                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Email Service (emailService.js)                │   │
│  │  - Checks user's personal email config               │   │
│  │  - Falls back to company-wide Zoho config            │   │
│  │  - Sends via Zoho Zeptomail API                      │   │
│  └────────┬─────────────────────────────────────────────┘   │
└───────────┼─────────────────────────────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────────────────────────┐
│            Database (MongoDB)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      CompanyEmailConfig Collection                   │   │
│  │  - zohoZeptomailApiKey (stored securely)            │   │
│  │  - zohoZeptomailFromEmail                            │   │
│  │  - zohoZeptomailApiUrl                               │   │
│  │  - isConfigured (boolean flag)                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      User.emailSettings (optional override)          │   │
│  │  - For employees with personal Zoho accounts         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────────────────────────┐
│      Zoho Zeptomail API (Cloud)                            │
│  https://api.zeptomail.in/v1.1/email                       │
│                                                              │
│  - Receives email request from backend                      │
│  - Authenticates using your API key                         │
│  - Sends email from your domain                             │
│  - Delivers to recipient's inbox                            │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Email Configuration Types

### 1. Company-Wide Configuration (Default)
**Who Sets It Up:** Admin/Owner
**Who Uses It:** All 30-50+ employees automatically
**How It Works:** One shared Zoho API key for entire organization

✅ **Advantages:**
- Centralized management (one API key for all)
- No individual Zoho accounts needed
- Consistent "From" address (company domain)
- Easy to set up

### 2. Per-User Configuration (Optional Override)
**Who Sets It Up:** Individual employee
**Who Uses It:** Only that employee
**How It Works:** Employee's personal Zoho or SMTP settings override company config

✅ **Advantages:**
- Send from personal email address
- Use personal Zoho account
- Sales team can use their own setup

## 🔐 Security Notes

### ✅ What's Protected:
- API keys stored securely in database (never logged)
- API keys never sent to frontend (only masked as `••••••••`)
- HTTPS-only transmission between backend and Zoho
- JWT authentication required for all email operations
- All credentials remain server-side

### ⚠️ Current Limitations:
- API keys stored as plain text in database (TODO: Add encryption)
- Full credentials only visible to backend admins

### 🔑 API Key Safety:
- Keep your Zoho API key confidential
- Never share it in emails or chats
- Only stored on your server, not in frontend
- Zoho can regenerate/revoke if compromised

## 📊 Email Statistics

Monitor email sending:

```bash
# Check recent emails sent
curl -X GET http://localhost:5000/api/email/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Track:
- Total emails sent
- Latest email activity
- Failed deliveries
- By template type

## 🐛 Troubleshooting

### Problem: "Email not configured"
**Solution:** Run the setup script:
```bash
node setup-zoho-config.js
```

### Problem: "Invalid API Key"
**Solution:**
1. Verify your API key in Zoho Mail settings
2. Make sure the API key is not expired
3. Check that the key starts with `Zoho-enczapikey` or similar
4. Regenerate a new key in Zoho if needed

### Problem: "Unauthorized (401)"
**Solution:**
1. Verify API key is correct
2. Check that Zoho account is active
3. Ensure "From Email" is verified in Zoho
4. Try sending a test email via `POST /api/company-email-settings/test`

### Problem: "Rate limit exceeded (429)"
**Solution:**
- You've hit Zoho's daily email limit (usually 100/day for free accounts)
- Upgrade your Zoho plan for more emails
- Try again tomorrow

### Problem: Emails not being delivered
**Solution:**
1. Check that `From Email` is verified in your Zoho account
2. Verify recipient email addresses are correct
3. Check Zoho's inbox for any delivery reports
4. Review email content for spam triggers

## 📞 Zoho Zeptomail Support

For issues related to Zoho:
- **Zoho Mail Help:** https://www.zoho.com/mail/help/
- **Zeptomail Docs:** https://www.zoho.com/zeptomail/

For your API key or account:
- Log in to your Zoho Mail account
- Go to Settings → Email Service Integrations
- Find your Zeptomail API credentials

## 🎯 Next Steps

1. **✅ Run Setup Script:**
   ```bash
   cd backend
   node setup-zoho-config.js
   ```

2. **✅ Create Email Templates:**
   - Go to Profile → Email Templates
   - Create templates for different scenarios
   - Use variables like `{{candidateName}}`, `{{position}}`

3. **✅ Send Your First Email:**
   - Find a candidate in the ATS
   - Click the mail icon
   - Select a template
   - Send!

4. **✅ Monitor Delivery:**
   - Check Zoho Mail for sent emails
   - Verify recipients are receiving them
   - Adjust templates as needed

## 📚 API Documentation

### GET /api/company-email-settings
Retrieve current company email configuration (masked)

```bash
curl -X GET http://localhost:5000/api/company-email-settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "success": true,
  "configured": true,
  "settings": {
    "primaryProvider": "zoho-zeptomail",
    "zohoZeptomailApiKey": "••••••••••••••••",
    "zohoZeptomailFromEmail": "noreply@skillnixrecruitment.com",
    "zohoZeptomailApiUrl": "https://api.zeptomail.in/",
    "hasZohoApiKey": true,
    "configuredBy": "admin_user_id",
    "configuredAt": "2024-02-21T10:00:00Z"
  }
}
```

### PUT /api/company-email-settings/zoho-zeptomail
Configure company-wide Zoho Zeptomail

```bash
curl -X PUT http://localhost:5000/api/company-email-settings/zoho-zeptomail \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "zohoZeptomailApiKey": "YOUR_API_KEY",
    "zohoZeptomailApiUrl": "https://api.zeptomail.in/",
    "zohoZeptomailFromEmail": "noreply@skillnixrecruitment.com",
    "zohoZeptomailBounceAddress": "bounce@skillnixrecruitment.com"
  }'
```

### POST /api/company-email-settings/test
Test current configuration

```bash
curl -X POST http://localhost:5000/api/company-email-settings/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### POST /api/email-templates/send
Send email using a template

```json
{
  "templateId": "template_id_here",
  "recipients": [
    { "email": "candidate@example.com", "name": "John Doe" }
  ],
  "variables": {
    "candidateName": "John Doe",
    "position": "Full Stack Developer",
    "company": "XYZ Corp",
    "ctc": "5-7 LPA",
    "location": "Bangalore"
  },
  "cc": ["manager@company.com"],
  "bcc": []
}
```

---

**Version:** 1.0
**Last Updated:** February 2026
**Status:** ✅ Active & Production Ready
