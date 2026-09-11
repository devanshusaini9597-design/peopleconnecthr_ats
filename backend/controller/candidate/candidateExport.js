const { orgOrOwnerScope } = require('./candidateValidation');
const { exportCandidates } = require('../../services/candidateExportService');
const logger = require('../../utils/logger');

async function exportCandidatesExcel(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const selected = Boolean(req.body?.selected);
    const { buffer, filename, count } = await exportCandidates({
      user: req.user,
      scopeFilter: orgOrOwnerScope(req),
      ids,
      selected,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Count', String(count));
    return res.status(200).send(buffer);
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error({ err: err.message }, '[candidate-export] failed');
    return res.status(status).json({ success: false, message: err.message || 'Export failed' });
  }
}

module.exports = { exportCandidatesExcel };
