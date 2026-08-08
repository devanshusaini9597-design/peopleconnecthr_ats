/**
 * Company email configuration routes — thin HTTP wrappers.
 * Logic lives in companyEmailSettingsService.
 */
const express = require('express');
const router = express.Router();
const {
  getCompanyEmailConfig,
  saveZohoConfig,
  saveSmtpConfig,
  testCompanyEmailConfig,
  clearCompanyEmailConfig,
} = require('../services/companyEmailSettingsService');

function handle(res, err) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ success: false, message: err.message });
}

router.get('/', async (req, res) => {
  try {
    const result = await getCompanyEmailConfig();
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err);
  }
});

router.put('/zoho-zeptomail', async (req, res) => {
  try {
    const result = await saveZohoConfig(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err);
  }
});

router.put('/smtp', async (req, res) => {
  try {
    const result = await saveSmtpConfig(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err);
  }
});

router.post('/test', async (req, res) => {
  try {
    const result = await testCompanyEmailConfig();
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err);
  }
});

router.delete('/', async (req, res) => {
  try {
    const result = await clearCompanyEmailConfig(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err);
  }
});

module.exports = router;
