const Company = require('../models/Company');
const { normalizeText } = require('../utils/textNormalize');

// Tenant scope: prefer organizationId (multi-tenant safe, shared across the
// org's team) so this list matches how every other module in the codebase
// scopes data. Falls back to createdBy only for legacy users somehow
// without an org.
const scopeFilter = (req) => (
  req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id }
);

exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find(scopeFilter(req)).sort({ name: 1 });
    res.json(companies);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching companies' });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const scope = scopeFilter(req);
    const existing = await Company.findOne({ ...scope, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'Company already exists' });

    const company = new Company({
      name: normalizeText(name),
      description: description?.trim(),
      createdBy: req.user.id,
      organizationId: req.user.organizationId
    });
    await company.save();
    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ message: 'Error creating company' });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { name, description } = req.body;
    const company = await Company.findOneAndUpdate(
      { _id: req.params.id, ...scopeFilter(req) },
      { name: name ? normalizeText(name) : name, description: description?.trim() },
      { new: true }
    );
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ message: 'Error updating company' });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting company' });
  }
};
