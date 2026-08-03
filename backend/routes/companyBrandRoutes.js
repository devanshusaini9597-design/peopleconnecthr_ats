/**
 * Company careers brand pack — careers.companyBrand
 */

const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');

router.use(requireFeature('careers.companyBrand'));

router.get('/', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId)
      .select('name logo atsSettings.brandColor atsSettings.companyBrand atsSettings.pageBlocks atsSettings.careersPageTitle atsSettings.careersPageDescription');
    res.json({
      success: true,
      data: {
        name: org.name,
        logo: org.logo,
        brandColor: org.atsSettings?.brandColor,
        careersPageTitle: org.atsSettings?.careersPageTitle,
        careersPageDescription: org.atsSettings?.careersPageDescription,
        companyBrand: org.atsSettings?.companyBrand || {
          tagline: '',
          benefits: [],
          teamMembers: [],
          socialLinks: {},
          seoTitle: '',
          seoDescription: '',
          customCss: ''
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    const {
      brandColor,
      careersPageTitle,
      careersPageDescription,
      companyBrand = {}
    } = req.body;

    const update = {};
    if (brandColor !== undefined) update['atsSettings.brandColor'] = brandColor;
    if (careersPageTitle !== undefined) update['atsSettings.careersPageTitle'] = careersPageTitle;
    if (careersPageDescription !== undefined) update['atsSettings.careersPageDescription'] = careersPageDescription;

    update['atsSettings.companyBrand'] = {
      tagline: String(companyBrand.tagline || '').slice(0, 200),
      benefits: Array.isArray(companyBrand.benefits)
        ? companyBrand.benefits.slice(0, 20).map((b) => ({
          title: String(b.title || '').slice(0, 80),
          description: String(b.description || '').slice(0, 300)
        }))
        : [],
      teamMembers: Array.isArray(companyBrand.teamMembers)
        ? companyBrand.teamMembers.slice(0, 20).map((m) => ({
          name: String(m.name || '').slice(0, 80),
          role: String(m.role || '').slice(0, 80),
          photoUrl: String(m.photoUrl || '').slice(0, 500)
        }))
        : [],
      socialLinks: {
        linkedin: companyBrand.socialLinks?.linkedin || '',
        twitter: companyBrand.socialLinks?.twitter || '',
        facebook: companyBrand.socialLinks?.facebook || '',
        github: companyBrand.socialLinks?.github || '',
        website: companyBrand.socialLinks?.website || ''
      },
      seoTitle: String(companyBrand.seoTitle || '').slice(0, 120),
      seoDescription: String(companyBrand.seoDescription || '').slice(0, 300),
      customCss: String(companyBrand.customCss || '').slice(0, 8000)
    };

    // customCss only for whiteLabel builder entitlement
    const { planHasFeature } = require('../config/planFeatures');
    const orgCheck = await Organization.findById(req.user.organizationId).select('plan');
    if (!planHasFeature(orgCheck?.plan, 'careers.whiteLabelBuilder')) {
      update['atsSettings.companyBrand'].customCss = '';
    }

    const org = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      { $set: update },
      { new: true }
    ).select('atsSettings.companyBrand atsSettings.brandColor atsSettings.careersPageTitle atsSettings.careersPageDescription');

    res.json({ success: true, data: org.atsSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
