const mongoose = require('mongoose');

// NOTE: this model currently has no routes/controller wired to it (dead code
// as of this writing). organizationId/createdBy are here so that whoever
// wires it up next scopes it correctly from day one, instead of repeating
// the createdBy-only mistake that Client/Position/Source had.
const jdTemplateSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    roleTitle: { type: String, required: true },
    experience: { type: String },
    description: { type: String }, // Ismein detail JD hoga
    skills: [{ type: String }],
    category: { type: String } // e.g., Tech, Marketing
}, { timestamps: true });

jdTemplateSchema.index({ organizationId: 1, roleTitle: 1 });

module.exports = mongoose.model('JDTemplate', jdTemplateSchema);