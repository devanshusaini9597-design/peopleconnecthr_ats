const mongoose = require('mongoose');

const DemoLeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  company: { type: String, required: true },
  teamSize: { type: String, default: '1-10' },
  message: { type: String, default: '' },
  kind: { type: String, default: 'demo' },
  emailSent: { type: Boolean, default: false },
  emailError: { type: String, default: '' },
}, { timestamps: true, collection: 'demo_leads' });

module.exports = mongoose.model('DemoLead', DemoLeadSchema);
