const crud = require('./candidateCRUD');
const importCtrl = require('./candidateImport');
const bulk = require('./candidateBulk');
const search = require('./candidateSearch');
const resume = require('./candidateResume');
const pending = require('./candidatePending');

module.exports = {
  ...crud,
  ...importCtrl,
  ...bulk,
  ...search,
  ...resume,
  ...pending,
};
