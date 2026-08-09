require('dotenv').config();
const { sendEmail } = require('./services/emailService');

async function testEmail() {
  try {
    console.log('Testing email sending...');
    console.log('From:', process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL);
    console.log('API URL:', process.env.ZOHO_ZEPTOMAIL_API_URL);
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 30px; color: white; text-align: center;">
          <h2 style="margin: 0;">Test Email</h2>
        </div>
        <div style="padding: 30px; background: white; border: 1px solid #ddd;">
          <p style="color: #333;">This is a test email from your SkillNix ATS system.</p>
          <p style="color: #666;">If you received this, your Zoho ZeptoMail configuration is working correctly!</p>
        </div>
      </div>
    `;
    
    // REPLACE THIS WITH YOUR ACTUAL EMAIL FOR TESTING
    const testEmail = 'your-email@example.com'; 
    
    const result = await sendEmail(
      testEmail,
      'Test Email - SkillNix ATS',
      htmlBody,
      'This is a test email from SkillNix ATS'
    );
    
    console.log('✅ Email sent successfully:', result);
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('Error details:', error);
  }
}

testEmail();