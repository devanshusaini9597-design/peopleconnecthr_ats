#!/usr/bin/env node

/**
 * Skillnix Zoho Zeptomail Setup Script
 * 
 * This script configures company-wide Zoho Zeptomail email settings
 * so all employees can send emails through your Zoho account.
 * 
 * Usage: node setup-zoho-config.js
 * 
 * You'll be prompted to enter your Zoho credentials
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

async function setupZoho() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Skillnix Zoho Zeptomail Email Configuration Setup        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillnix-pchr');
    console.log('✅ Database connected\n');

    // Get Zoho credentials from user
    console.log('📧 Enter your Zoho Zeptomail credentials:');
    console.log('(You can find these in your Zoho Mail account settings)\n');

    const zohoApiKey = await question('🔑 API Key: ');
    const zohoApiUrl = await question('🌐 API URL (default: https://api.zeptomail.com/): ') || 'https://api.zeptomail.com/';
    const zohoFromEmail = await question('📬 From Email Address (e.g., noreply@skillnixrecruitment.com): ');
    const zohoBounceAddress = await question('📨 Bounce Address (optional, leave empty): ');

    if (!zohoApiKey || !zohoFromEmail) {
      console.log('\n❌ API Key and From Email are required!');
      process.exit(1);
    }

    console.log('\n⏳ Testing Zoho API credentials...');

    // Test the credentials
    try {
      const apiEndpoint = zohoApiUrl.endsWith('/') 
        ? `${zohoApiUrl}v1.1/email`
        : `${zohoApiUrl}/v1.1/email`;
      
      const testResponse = await axios.post(
        apiEndpoint,
        {
          from: {
            address: zohoFromEmail.trim(),
            name: 'Skillnix Setup Test'
          },
          to: [{
            email_address: {
              address: zohoFromEmail.trim()
            }
          }],
          subject: '✅ Skillnix Zoho Zeptomail Company Configuration Test',
          htmlbody: '<p>If you received this email, your Zoho Zeptomail configuration is working! All employees will now send emails through this account.</p>',
          textbody: 'If you received this email, your Zoho Zeptomail configuration is working!'
        },
        {
          headers: {
            'Authorization': `Zoho-enczapikey ${zohoApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log('✅ Zoho API credentials verified!\n');

      // Save to database
      console.log('💾 Saving configuration to database...\n');
      
      const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
      
      let config = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
      if (!config) {
        config = new CompanyEmailConfig({ companyId: 'default-company' });
      }

      config.primaryProvider = 'zoho-zeptomail';
      config.zohoZeptomailApiKey = zohoApiKey.trim();
      config.zohoZeptomailApiUrl = zohoApiUrl;
      config.zohoZeptomailFromEmail = zohoFromEmail.trim();
      config.zohoZeptomailBounceAddress = zohoBounceAddress.trim() || '';
      config.isConfigured = true;
      config.configuredAt = new Date();
      config.lastModifiedAt = new Date();

      await config.save();

      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║                    ✅ SETUP COMPLETE!                        ║');
      console.log('╚══════════════════════════════════════════════════════════════╝\n');
      console.log('✅ Company Zoho Zeptomail configuration saved!');
      console.log(`✅ All employees can now send emails from: ${zohoFromEmail}\n`);
      console.log('📌 What happens next:');
      console.log('   1. Users can click the mail icon in the ATS');
      console.log('   2. Select from ready-made email templates');
      console.log('   3. Fill in template variables (candidate name, position, etc.)');
      console.log('   4. Send the email - it will be delivered via your Zoho account\n');

      console.log('🔧 Configuration Details:');
      console.log(`   - Provider: Zoho Zeptomail`);
      console.log(`   - From Email: ${zohoFromEmail}`);
      console.log(`   - API URL: ${zohoApiUrl}`);
      console.log(`   - Status: Active\n`);

      process.exit(0);
    } catch (apiError) {
      console.error('\n❌ Failed to verify Zoho API credentials!\n');
      
      if (apiError.response?.status === 401) {
        console.error('❌ Invalid API Key. Please check your credentials in Zoho Mail settings.');
      } else if (apiError.response?.status === 400) {
        console.error('❌ Invalid request. Check your API URL and From Email address.');
        console.error(`   Error: ${apiError.response.data?.message || 'Unknown error'}`);
      } else if (apiError.code === 'ECONNABORTED') {
        console.error('❌ Connection timeout. Check your API URL or network connection.');
      } else {
        console.error(`❌ Error: ${apiError.message}`);
      }
      
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    rl.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

setupZoho();
