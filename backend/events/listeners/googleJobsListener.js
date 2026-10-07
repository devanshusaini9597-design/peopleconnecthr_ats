const { on } = require('../eventBus');
const eventTypes = require('../eventTypes');
const { scheduleGoogleJobsNotify } = require('../../services/googleJobsService');

function initGoogleJobsListeners() {
  const onChange = (payload) => {
    const job = payload?.job || { _id: payload?.jobId, organizationId: payload?.organizationId };
    scheduleGoogleJobsNotify(job, { deleted: false });
  };
  const onRemove = (payload) => {
    const job = payload?.job || { _id: payload?.jobId, organizationId: payload?.organizationId };
    scheduleGoogleJobsNotify(job, { deleted: true });
  };
  on(eventTypes.JOB_PUBLISHED, onChange);
  on(eventTypes.JOB_UPDATED, onChange);
  on(eventTypes.JOB_CLOSED, onRemove);
}

module.exports = { initGoogleJobsListeners };
