# 🎯 ZOHO ZEPTOMAIL SETUP - QUICK START GUIDE

Your API Credentials (Provided):
```
📧 Domain: skillnixrecruitment.com
🔐 API Key: PHtE6r1bQujuiWQn9BMDt6e6FJaiPIkq/u9gLQdG5N1GC6RXHU1VrtEtlWDh+hYjAKEXQPWdzIprtbjJte3UJ2foPDofWGqyqK3sx/VYSPOZsbq6x00ctV8Yd0DaVoHoddNv1yfTv9/ZNA==
🌐 API URL: https://api.zeptomail.in/
📮 Sender Email: noreply@skillnixrecruitment.com
```

## ✅ What We've Set Up:

1. **✅ zeptomail npm package** - Installed (`v7.0.2`)
2. **✅ Email service integration** - Zeptomail API support added
3. **✅ Company-wide configuration** - All employees share one Zoho account
4. **✅ Per-user override** - Employees can use their own Zoho account if desired
5. **✅ Email templates system** - Pre-made templates for different email types
6. **✅ Mail icon in ATS** - Click to send emails with templates

## 🚀 Three Ways to Configure Your Zoho Account:

### **Option A: Interactive Setup Script (Easiest)**
```bash
cd backend
node setup-zoho-config.js
```
Then follow the prompts - it will:
- Ask for your API Key
- Test the credentials
- Save to database
- Confirm it's working

### **Option B: Using curl/Postman**
First, login to get a JWT token, then:

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

### **Option C: Through Frontend (When UI is ready)**
1. Go to Settings → Email Settings
2. Select "Zoho Zeptomail" tab
3. Enter your credentials
4. Click "Save & Test"

## 📧 How to Send Emails:

### **From ATS Dashboard:**
1. Find a candidate in the Candidates table
2. Click the **mail icon** 📧 (or right-click → Send Email)
3. **Template Mode:**
   - Select from pre-made templates
   - Fill in variables
   - Preview
   - Send ✉️
4. **Quick Mode:**
   - Type custom message
   - Send ✉️

### **From Email Templates Page:**
1. Go to **Profile → Email Templates**
2. Create new templates with variables like `{{candidateName}}`
3. Save templates
4. Use them when sending emails

## 📊 System Flow:

```
User clicks Mail Icon
       ↓
Select/Create Template
       ↓
Fill Variables (Name, Position, etc.)
       ↓
Click Send
       ↓
Backend checks: User config? → Company config? → Send!
       ↓
Zoho Zeptomail API receives request
       ↓
Sends email from: noreply@skillnixrecruitment.com
       ↓
Recipient receives email in inbox ✅
```

## 🔒 Security (What's Protected):

✅ API Key is never sent to frontend
✅ Only shown as `••••••••` in UI
✅ Stored securely in MongoDB on server
✅ Only used server-side for API calls
✅ Full HTTPS encryption
✅ JWT authentication required

## 🐛 Troubleshooting:

**Error: "Email not configured"**
→ Run the setup script (Option A)

**Error: "Invalid API Key"**
→ Verify the API key in your Zoho account
→ Check it hasn't expired
→ Regenerate a new one if needed

**Error: "Unauthorized 401"**
→ API key is wrong or Zoho account inactive
→ Verify From Email is verified in Zoho

**Error: "Rate limit 429"**
→ You've sent too many emails today (free tier limit: ~100/day)
→ Upgrade your Zoho plan or try tomorrow

## 📞 Need Help?

1. **Setup Issues?** → Run the setup script with `--verbose` flag
2. **Zoho Account Help?** → Log in to Zoho Mail → Settings
3. **API Key Location?** → Zoho Mail → Settings → Email Service Integrations
4. **Send Not Working?** → Check `/api/company-email-settings/test` endpoint

## ✨ Features Available Now:

✅ Send single emails with templates
✅ Bulk email to multiple candidates
✅ Template preview before sending
✅ CC/BCC support
✅ Variable replacement (`{{name}}`, `{{position}}`, etc.)
✅ Professional HTML email formatting
✅ Sent from your company domain
✅ Employee can override with personal config

## 🎁 Email Templates Included:

1. **Interview** - Interview scheduling emails
2. **Hiring Drive** - Job announcement emails
3. **Rejection** - Candidate rejection emails
4. **Document Collection** - Document request emails
5. **Onboarding** - New employee onboarding emails
6. **Custom** - Create your own templates

---

**STATUS:** ✅ Ready to Use
**Version:** 1.0
**Last Updated:** Feb 2026

Start with Option A (setup script) - it's the easiest! 🚀
