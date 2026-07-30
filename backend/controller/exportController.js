// backend/controller/exportController.js
const Candidate = require('../models/Candidate');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

// ─── Helper: build date filter ───
function buildDateFilter(dateRange, customFrom, customTo) {
  if (dateRange === 'custom' && customFrom && customTo) {
    return { $gte: new Date(customFrom), $lte: new Date(new Date(customTo).setHours(23, 59, 59, 999)) };
  }
  const now = new Date();
  switch (dateRange) {
    case 'today': { const start = new Date(now); start.setHours(0, 0, 0, 0); return { $gte: start }; }
    case 'yesterday': { const yS = new Date(now); yS.setDate(yS.getDate() - 1); yS.setHours(0, 0, 0, 0); const yE = new Date(now); yE.setDate(yE.getDate() - 1); yE.setHours(23, 59, 59, 999); return { $gte: yS, $lte: yE }; }
    case 'week': { const wS = new Date(now); wS.setDate(wS.getDate() - 7); wS.setHours(0, 0, 0, 0); return { $gte: wS }; }
    case 'month': return { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'quarter': return { $gte: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1) };
    case 'year': return { $gte: new Date(now.getFullYear(), 0, 1) };
    default: return null;
  }
}

function styleHeaderRow(ws) {
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;
  ws.columns.forEach(col => { col.width = Math.max(col.width || 12, 14); });
}

function getDateRangeLabel(dateRange, customFrom, customTo) {
  if (dateRange === 'custom' && customFrom && customTo) {
    return `${new Date(customFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — ${new Date(customTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  return { all: 'All Time', today: 'Today', yesterday: 'Yesterday', week: 'Last 7 Days', month: 'This Month', quarter: 'This Quarter', year: 'This Year' }[dateRange] || 'All Time';
}

// ═══════════════════════════════════════════
//  PDF HELPER FUNCTIONS
// ═══════════════════════════════════════════

function createPDFDoc() {
  return new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
}

function drawPDFHeader(doc, title, dateRangeLabel) {
  const now = new Date();
  doc.rect(0, 0, doc.page.width, 56).fill('#4338CA');
  doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold').text('Skillnix Recruitment Services', 40, 20);
  doc.moveDown(2);
  doc.fontSize(14).fillColor('#1E293B').font('Helvetica-Bold').text(title, 40);
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#64748B').font('Helvetica')
    .text(`Date Range: ${dateRangeLabel}    |    Generated: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, 40);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
  doc.moveDown(0.8);
}

function drawPDFTable(doc, headers, rows, colWidths) {
  const startX = 40;
  const pageWidth = doc.page.width - 80;
  const rowHeight = 20;
  const headerHeight = 24;
  let y = doc.y;

  if (!colWidths) colWidths = headers.map(() => pageWidth / headers.length);

  const checkPage = (h) => { if (y + h > doc.page.height - 55) { doc.addPage(); y = 40; return true; } return false; };

  checkPage(headerHeight);
  doc.rect(startX, y, pageWidth, headerHeight).fill('#4338CA');
  let x = startX;
  headers.forEach((h, i) => {
    doc.fontSize(7.5).fillColor('#FFFFFF').font('Helvetica-Bold')
      .text(h, x + 5, y + 7, { width: colWidths[i] - 10, align: 'left', lineBreak: false });
    x += colWidths[i];
  });
  y += headerHeight;

  rows.forEach((row, ri) => {
    checkPage(rowHeight);
    doc.rect(startX, y, pageWidth, rowHeight).fill(ri % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
    doc.moveTo(startX, y + rowHeight).lineTo(startX + pageWidth, y + rowHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
    x = startX;
    row.forEach((cell, i) => {
      doc.fontSize(7.5).fillColor('#334155').font('Helvetica')
        .text(cell != null ? String(cell) : '', x + 5, y + 5, { width: colWidths[i] - 10, align: 'left', lineBreak: false });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.rect(startX, y - headerHeight - rows.length * rowHeight, pageWidth, headerHeight + rows.length * rowHeight).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
  doc.y = y + 10;
}

function drawPDFSummaryCards(doc, cards) {
  const startX = 40;
  const cardW = (doc.page.width - 80 - 30) / 4;
  const cardH = 50;
  if (doc.y + cardH + 10 > doc.page.height - 55) doc.addPage();
  const baseY = doc.y;
  cards.forEach((card, i) => {
    const x = startX + i * (cardW + 10);
    doc.roundedRect(x, baseY, cardW, cardH, 4).fill('#F1F5F9').roundedRect(x, baseY, cardW, cardH, 4).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor('#64748B').font('Helvetica').text(card.label, x + 8, baseY + 8, { width: cardW - 16 });
    doc.fontSize(14).fillColor('#1E293B').font('Helvetica-Bold').text(String(card.value), x + 8, baseY + 22, { width: cardW - 16 });
  });
  doc.y = baseY + cardH + 12;
}

function addPDFFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
      .text(`Page ${i + 1} of ${pages.count}  |  Confidential — Generated by Skillnix Recruitment Services`, 40, doc.page.height - 30, { width: doc.page.width - 80, align: 'center' });
  }
}

// ═══════════════════════════════════════════
//  REPORT GENERATORS
// ═══════════════════════════════════════════

async function getRecruitmentData(userId, dateFilter) {
  const userFilter = { createdBy: userId };
  if (dateFilter) userFilter.createdAt = dateFilter;
  const pipelineCounts = await Candidate.aggregate([{ $match: userFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const pipeline = {}; pipelineCounts.forEach(p => { pipeline[p._id] = p.count; });
  const total = Object.values(pipeline).reduce((s, v) => s + v, 0);
  const hired = (pipeline['Hired'] || 0) + (pipeline['Joined'] || 0);
  const rejected = (pipeline['Rejected'] || 0) + (pipeline['Dropped'] || 0);
  const inProgress = (pipeline['Applied'] || 0) + (pipeline['Screening'] || 0) + (pipeline['Interview'] || 0) + (pipeline['Offer'] || 0);
  return { pipeline, total, hired, rejected, inProgress };
}

// Recruitment Summary - Excel
async function recruitmentSummaryReport(wb, userId, dateFilter) {
  const ws = wb.addWorksheet('Recruitment Summary');
  const { pipeline, total, hired, rejected, inProgress } = await getRecruitmentData(userId, dateFilter);
  ws.columns = [{ header: 'Metric', key: 'metric', width: 30 }, { header: 'Value', key: 'value', width: 18 }, { header: 'Percentage', key: 'percent', width: 16 }];
  const pct = (v) => total ? Math.round((v / total) * 100) + '%' : '0%';
  const rows = [
    { metric: 'Total Candidates', value: total, percent: '100%' }, { metric: '', value: '', percent: '' },
    { metric: '── Pipeline Breakdown ──', value: '', percent: '' },
    ...['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped'].map(s => ({ metric: s, value: pipeline[s] || 0, percent: pct(pipeline[s] || 0) })),
    { metric: '', value: '', percent: '' }, { metric: '── Key Metrics ──', value: '', percent: '' },
    { metric: 'Total In Progress', value: inProgress, percent: pct(inProgress) },
    { metric: 'Total Hired / Joined', value: hired, percent: pct(hired) },
    { metric: 'Total Rejected / Dropped', value: rejected, percent: pct(rejected) },
    { metric: 'Conversion Rate', value: pct(hired), percent: '' },
    { metric: 'Rejection Rate', value: pct(rejected), percent: '' },
  ];
  rows.forEach(r => ws.addRow(r));
  styleHeaderRow(ws);
  [3, 13].forEach(n => { ws.getRow(n + 1).font = { bold: true, color: { argb: 'FF1E293B' } }; });
}

// Recruitment Summary - PDF
async function recruitmentSummaryPDF(doc, userId, dateFilter, label) {
  drawPDFHeader(doc, 'Recruitment Summary Report', label);
  const { pipeline, total, hired, rejected, inProgress } = await getRecruitmentData(userId, dateFilter);
  const conv = total ? Math.round((hired / total) * 100) : 0;
  drawPDFSummaryCards(doc, [{ label: 'Total Candidates', value: total }, { label: 'In Progress', value: inProgress }, { label: 'Hired / Joined', value: hired }, { label: 'Conversion Rate', value: conv + '%' }]);
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Pipeline Breakdown', 40); doc.moveDown(0.5);
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped', 'Interested', 'Interested and scheduled'];
  drawPDFTable(doc, ['Stage', 'Count', 'Percentage'], stages.filter(s => pipeline[s]).map(s => [s, pipeline[s] || 0, total ? Math.round(((pipeline[s] || 0) / total) * 100) + '%' : '0%']), [200, 160, 155]);
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Key Metrics', 40); doc.moveDown(0.5);
  drawPDFTable(doc, ['Metric', 'Value'], [['Total In Progress', inProgress], ['Total Hired / Joined', hired], ['Total Rejected / Dropped', rejected], ['Conversion Rate', conv + '%'], ['Rejection Rate', total ? Math.round((rejected / total) * 100) + '%' : '0%']], [300, 215]);
}

// Source Performance
async function getSourceData(userId, dateFilter) {
  const userFilter = { createdBy: userId }; if (dateFilter) userFilter.createdAt = dateFilter;
  return Candidate.aggregate([
    { $match: { ...userFilter, source: { $exists: true, $ne: '' } } },
    { $group: { _id: '$source', total: { $sum: 1 }, applied: { $sum: { $cond: [{ $eq: ['$status', 'Applied'] }, 1, 0] } }, screening: { $sum: { $cond: [{ $eq: ['$status', 'Screening'] }, 1, 0] } }, interview: { $sum: { $cond: [{ $eq: ['$status', 'Interview'] }, 1, 0] } }, offer: { $sum: { $cond: [{ $eq: ['$status', 'Offer'] }, 1, 0] } }, hired: { $sum: { $cond: [{ $in: ['$status', ['Hired', 'Joined']] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $in: ['$status', ['Rejected', 'Dropped']] }, 1, 0] } } } },
    { $sort: { total: -1 } }
  ]);
}

async function sourcePerformanceReport(wb, userId, dateFilter) {
  const ws = wb.addWorksheet('Source Performance');
  const sourceData = await getSourceData(userId, dateFilter);
  ws.columns = [{ header: 'Source', key: 'source', width: 20 }, { header: 'Total', key: 'total', width: 10 }, { header: 'Applied', key: 'applied', width: 10 }, { header: 'Screening', key: 'screening', width: 12 }, { header: 'Interview', key: 'interview', width: 12 }, { header: 'Offer', key: 'offer', width: 10 }, { header: 'Hired/Joined', key: 'hired', width: 14 }, { header: 'Rejected/Dropped', key: 'rejected', width: 16 }, { header: 'Conversion %', key: 'conversion', width: 14 }];
  sourceData.forEach(s => { ws.addRow({ source: s._id, total: s.total, applied: s.applied, screening: s.screening, interview: s.interview, offer: s.offer, hired: s.hired, rejected: s.rejected, conversion: s.total > 0 ? Math.round((s.hired / s.total) * 100) + '%' : '0%' }); });
  styleHeaderRow(ws);
}

async function sourcePerformancePDF(doc, userId, dateFilter, label) {
  drawPDFHeader(doc, 'Source Performance Report', label);
  const data = await getSourceData(userId, dateFilter);
  const totalAll = data.reduce((s, d) => s + d.total, 0);
  drawPDFSummaryCards(doc, [{ label: 'Total Sources', value: data.length }, { label: 'Total Candidates', value: totalAll }, { label: 'Top Source', value: data.length > 0 ? data[0]._id : 'N/A' }, { label: 'Best Conversion', value: data.reduce((b, s) => { const r = s.total > 0 ? (s.hired / s.total) * 100 : 0; return r > b.rate ? { n: s._id, rate: r } : b; }, { n: 'N/A', rate: 0 }).n }]);
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Source-wise Breakdown', 40); doc.moveDown(0.5);
  const w = (doc.page.width - 80) / 9;
  drawPDFTable(doc, ['Source', 'Total', 'Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected', 'Conv%'], data.map(s => [s._id, s.total, s.applied, s.screening, s.interview, s.offer, s.hired, s.rejected, s.total > 0 ? Math.round((s.hired / s.total) * 100) + '%' : '0%']), [w * 1.5, w * 0.7, w * 0.8, w * 0.8, w * 0.9, w * 0.7, w * 0.8, w * 0.9, w * 0.9]);
}

// Position-wise Report
async function getPositionData(userId, dateFilter) {
  const userFilter = { createdBy: userId }; if (dateFilter) userFilter.createdAt = dateFilter;
  return Candidate.aggregate([
    { $match: { ...userFilter, position: { $exists: true, $ne: '' } } },
    { $group: { _id: '$position', total: { $sum: 1 }, applied: { $sum: { $cond: [{ $eq: ['$status', 'Applied'] }, 1, 0] } }, screening: { $sum: { $cond: [{ $eq: ['$status', 'Screening'] }, 1, 0] } }, interview: { $sum: { $cond: [{ $eq: ['$status', 'Interview'] }, 1, 0] } }, offer: { $sum: { $cond: [{ $eq: ['$status', 'Offer'] }, 1, 0] } }, hired: { $sum: { $cond: [{ $in: ['$status', ['Hired', 'Joined']] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $in: ['$status', ['Rejected', 'Dropped']] }, 1, 0] } } } },
    { $sort: { total: -1 } }
  ]);
}

async function positionWiseReport(wb, userId, dateFilter) {
  const ws = wb.addWorksheet('Position Report');
  const data = await getPositionData(userId, dateFilter);
  ws.columns = [{ header: 'Position', key: 'position', width: 26 }, { header: 'Total', key: 'total', width: 10 }, { header: 'Applied', key: 'applied', width: 10 }, { header: 'Screening', key: 'screening', width: 12 }, { header: 'Interview', key: 'interview', width: 12 }, { header: 'Offer', key: 'offer', width: 10 }, { header: 'Hired/Joined', key: 'hired', width: 14 }, { header: 'Rejected/Dropped', key: 'rejected', width: 16 }, { header: 'Fill Rate %', key: 'fillRate', width: 12 }];
  data.forEach(p => { ws.addRow({ position: p._id, total: p.total, applied: p.applied, screening: p.screening, interview: p.interview, offer: p.offer, hired: p.hired, rejected: p.rejected, fillRate: p.total > 0 ? Math.round((p.hired / p.total) * 100) + '%' : '0%' }); });
  styleHeaderRow(ws);
}

async function positionWisePDF(doc, userId, dateFilter, label) {
  drawPDFHeader(doc, 'Position-wise Report', label);
  const data = await getPositionData(userId, dateFilter);
  const totalAll = data.reduce((s, d) => s + d.total, 0);
  drawPDFSummaryCards(doc, [{ label: 'Total Positions', value: data.length }, { label: 'Total Candidates', value: totalAll }, { label: 'Avg per Position', value: data.length > 0 ? Math.round(totalAll / data.length) : 0 }, { label: 'Active Positions', value: data.filter(p => p.total > 0).length }]);
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Position-wise Breakdown', 40); doc.moveDown(0.5);
  const w = (doc.page.width - 80) / 9;
  drawPDFTable(doc, ['Position', 'Total', 'Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected', 'Fill%'], data.map(p => [p._id, p.total, p.applied, p.screening, p.interview, p.offer, p.hired, p.rejected, p.total > 0 ? Math.round((p.hired / p.total) * 100) + '%' : '0%']), [w * 1.5, w * 0.7, w * 0.8, w * 0.8, w * 0.9, w * 0.7, w * 0.8, w * 0.9, w * 0.9]);
}

// Client Report
async function getClientData(userId, dateFilter) {
  const userFilter = { createdBy: userId }; if (dateFilter) userFilter.createdAt = dateFilter;
  return Candidate.aggregate([
    { $match: { ...userFilter, client: { $exists: true, $ne: '' } } },
    { $group: { _id: '$client', total: { $sum: 1 }, hired: { $sum: { $cond: [{ $in: ['$status', ['Hired', 'Joined']] }, 1, 0] } }, interview: { $sum: { $cond: [{ $eq: ['$status', 'Interview'] }, 1, 0] } }, offer: { $sum: { $cond: [{ $eq: ['$status', 'Offer'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $in: ['$status', ['Rejected', 'Dropped']] }, 1, 0] } } } },
    { $sort: { total: -1 } }
  ]);
}

async function clientReport(wb, userId, dateFilter) {
  const ws = wb.addWorksheet('Client Report');
  const data = await getClientData(userId, dateFilter);
  ws.columns = [{ header: 'Client', key: 'client', width: 26 }, { header: 'Total Candidates', key: 'total', width: 16 }, { header: 'In Interview', key: 'interview', width: 14 }, { header: 'Offer', key: 'offer', width: 10 }, { header: 'Hired/Joined', key: 'hired', width: 14 }, { header: 'Rejected/Dropped', key: 'rejected', width: 16 }, { header: 'Success Rate %', key: 'successRate', width: 16 }];
  data.forEach(c => { ws.addRow({ client: c._id, total: c.total, interview: c.interview, offer: c.offer, hired: c.hired, rejected: c.rejected, successRate: c.total > 0 ? Math.round((c.hired / c.total) * 100) + '%' : '0%' }); });
  styleHeaderRow(ws);
}

async function clientReportPDF(doc, userId, dateFilter, label) {
  drawPDFHeader(doc, 'Client Report', label);
  const data = await getClientData(userId, dateFilter);
  const totalAll = data.reduce((s, d) => s + d.total, 0);
  const totalHired = data.reduce((s, d) => s + d.hired, 0);
  drawPDFSummaryCards(doc, [{ label: 'Total Clients', value: data.length }, { label: 'Total Candidates', value: totalAll }, { label: 'Total Hired', value: totalHired }, { label: 'Avg Success', value: totalAll > 0 ? Math.round((totalHired / totalAll) * 100) + '%' : '0%' }]);
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Client-wise Breakdown', 40); doc.moveDown(0.5);
  const w = (doc.page.width - 80) / 7;
  drawPDFTable(doc, ['Client', 'Total', 'Interview', 'Offer', 'Hired', 'Rejected', 'Success%'], data.map(c => [c._id, c.total, c.interview, c.offer, c.hired, c.rejected, c.total > 0 ? Math.round((c.hired / c.total) * 100) + '%' : '0%']), [w * 1.4, w * 0.9, w * 0.9, w * 0.8, w * 0.9, w * 0.9, w * 1.2]);
}

// Pipeline Status - PDF
async function pipelineStatusPDF(doc, userId, dateFilter, label) {
  drawPDFHeader(doc, 'Pipeline Status Report', label);
  const userFilter = { createdBy: userId }; if (dateFilter) userFilter.createdAt = dateFilter;
  const candidates = await Candidate.find(userFilter).sort({ status: 1, createdAt: -1 }).lean();
  const statusCounts = {}; candidates.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
  const cards = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, c]) => ({ label: s, value: c }));
  if (cards.length > 0) drawPDFSummaryCards(doc, cards);
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Status Breakdown', 40); doc.moveDown(0.5);
  drawPDFTable(doc, ['Status', 'Count', 'Percentage'], Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([s, c]) => [s, c, candidates.length > 0 ? Math.round((c / candidates.length) * 100) + '%' : '0%']), [200, 160, 155]);
  if (candidates.length > 0) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Candidate Pipeline Details', 40); doc.moveDown(0.5);
    const w = (doc.page.width - 80) / 7;
    drawPDFTable(doc, ['Name', 'Position', 'Status', 'Source', 'Client', 'Exp', 'CTC'], candidates.slice(0, 100).map(c => [c.name || '', c.position || '', c.status || '', c.source || '', c.client || '', c.experience || '', c.ctc || '']), [w * 1.3, w * 1.2, w * 0.9, w * 0.9, w * 0.9, w * 0.4, w * 0.5]);
    if (candidates.length > 100) { doc.moveDown(0.3); doc.fontSize(8).fillColor('#64748B').font('Helvetica').text(`Showing 100 of ${candidates.length} candidates.`, 40); }
  }
}

// ═══════════════════════════════════════════
//  PREVIEW ENDPOINT
// ═══════════════════════════════════════════
exports.previewReport = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { reportType, dateRange, customFrom, customTo } = req.body;
    if (!reportType) return res.status(400).json({ message: 'Report type is required' });
    const dateFilter = buildDateFilter(dateRange, customFrom, customTo);
    const userFilter = { createdBy: userId }; if (dateFilter) userFilter.createdAt = dateFilter;
    let preview = { title: '', headers: [], rows: [], summary: [] };

    switch (reportType) {
      case 'recruitment-summary': {
        preview.title = 'Recruitment Summary';
        const { pipeline, total, hired, rejected } = await getRecruitmentData(userId, dateFilter);
        preview.summary = [{ label: 'Total', value: total }, { label: 'Hired', value: hired }, { label: 'Rejected', value: rejected }, { label: 'Conversion', value: total ? Math.round((hired / total) * 100) + '%' : '0%' }];
        preview.headers = ['Stage', 'Count', 'Percentage'];
        preview.rows = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped'].filter(s => pipeline[s]).map(s => [s, pipeline[s] || 0, total ? Math.round(((pipeline[s] || 0) / total) * 100) + '%' : '0%']);
        break;
      }
      case 'source-performance': {
        preview.title = 'Source Performance';
        const data = await getSourceData(userId, dateFilter);
        preview.summary = [{ label: 'Sources', value: data.length }, { label: 'Total', value: data.reduce((s, d) => s + d.total, 0) }];
        preview.headers = ['Source', 'Total', 'Hired', 'Conversion'];
        preview.rows = data.map(s => [s._id, s.total, s.hired, s.total > 0 ? Math.round((s.hired / s.total) * 100) + '%' : '0%']);
        break;
      }
      case 'position-report': {
        preview.title = 'Position-wise Report';
        const data = await getPositionData(userId, dateFilter);
        preview.summary = [{ label: 'Positions', value: data.length }, { label: 'Total', value: data.reduce((s, d) => s + d.total, 0) }];
        preview.headers = ['Position', 'Total', 'Hired', 'Fill Rate'];
        preview.rows = data.map(p => [p._id, p.total, p.hired, p.total > 0 ? Math.round((p.hired / p.total) * 100) + '%' : '0%']);
        break;
      }
      case 'client-report': {
        preview.title = 'Client Report';
        const data = await getClientData(userId, dateFilter);
        preview.summary = [{ label: 'Clients', value: data.length }, { label: 'Total', value: data.reduce((s, d) => s + d.total, 0) }];
        preview.headers = ['Client', 'Total', 'Hired', 'Success Rate'];
        preview.rows = data.map(c => [c._id, c.total, c.hired, c.total > 0 ? Math.round((c.hired / c.total) * 100) + '%' : '0%']);
        break;
      }
      case 'pipeline-status': {
        preview.title = 'Pipeline Status';
        const candidates = await Candidate.find(userFilter).sort({ status: 1, createdAt: -1 }).select('name position status source client').lean();
        const sc = {}; candidates.forEach(c => { sc[c.status] = (sc[c.status] || 0) + 1; });
        preview.summary = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, c]) => ({ label: s, value: c }));
        preview.headers = ['Name', 'Position', 'Status', 'Source', 'Client'];
        preview.rows = candidates.slice(0, 20).map(c => [c.name, c.position || '', c.status, c.source || '', c.client || '']);
        preview.totalRows = candidates.length;
        break;
      }
      default: return res.status(400).json({ message: 'Invalid report type' });
    }
    res.json(preview);
  } catch (err) { console.error('Preview error:', err); res.status(500).json({ message: 'Preview failed', error: err.message }); }
};

// ═══════════════════════════════════════════
//  MAIN EXPORT ENDPOINT
// ═══════════════════════════════════════════
exports.exportReport = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { reportType, format, dateRange, customFrom, customTo } = req.body;
    if (!reportType) return res.status(400).json({ message: 'Report type is required' });

    const dateFilter = buildDateFilter(dateRange, customFrom, customTo);
    const dateRangeLabel = getDateRangeLabel(dateRange, customFrom, customTo);
    const userFilter = { createdBy: userId }; if (dateFilter) userFilter.createdAt = dateFilter;
    const dateSuffix = new Date().toISOString().split('T')[0];

    // ═══════ PDF FORMAT ═══════
    if (format === 'pdf') {
      const doc = createPDFDoc();
      let filename = 'report';
      switch (reportType) {
        case 'recruitment-summary': filename = 'Recruitment_Summary'; await recruitmentSummaryPDF(doc, userId, dateFilter, dateRangeLabel); break;
        case 'source-performance': filename = 'Source_Performance'; await sourcePerformancePDF(doc, userId, dateFilter, dateRangeLabel); break;
        case 'position-report': filename = 'Position_Report'; await positionWisePDF(doc, userId, dateFilter, dateRangeLabel); break;
        case 'client-report': filename = 'Client_Report'; await clientReportPDF(doc, userId, dateFilter, dateRangeLabel); break;
        case 'pipeline-status': filename = 'Pipeline_Status'; await pipelineStatusPDF(doc, userId, dateFilter, dateRangeLabel); break;
        default: return res.status(400).json({ message: 'Invalid report type' });
      }
      addPDFFooter(doc);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}_${dateSuffix}.pdf"`);
      doc.pipe(res);
      doc.end();
      return;
    }

    // ═══════ EXCEL / CSV FORMAT ═══════
    const wb = new ExcelJS.Workbook(); wb.creator = 'SkillNix PCHR'; wb.created = new Date();
    let filename = 'report';
    switch (reportType) {
      case 'recruitment-summary': filename = 'Recruitment_Summary'; await recruitmentSummaryReport(wb, userId, dateFilter); break;
      case 'source-performance': filename = 'Source_Performance'; await sourcePerformanceReport(wb, userId, dateFilter); break;
      case 'position-report': filename = 'Position_Report'; await positionWiseReport(wb, userId, dateFilter); break;
      case 'client-report': filename = 'Client_Report'; await clientReport(wb, userId, dateFilter); break;
      case 'pipeline-status': {
        filename = 'Pipeline_Status';
        const candidates = await Candidate.find(userFilter).sort({ status: 1, createdAt: -1 }).lean();
        const ws = wb.addWorksheet('Pipeline Status');
        ws.columns = [{ header: 'Name', key: 'name', width: 22 }, { header: 'Position', key: 'position', width: 22 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Source', key: 'source', width: 14 }, { header: 'Client', key: 'client', width: 18 }, { header: 'Location', key: 'location', width: 16 }, { header: 'Experience', key: 'experience', width: 12 }, { header: 'CTC', key: 'ctc', width: 12 }, { header: 'Added On', key: 'createdAt', width: 14 }];
        candidates.forEach(c => { ws.addRow({ name: c.name, position: c.position, status: c.status, source: c.source, client: c.client, location: c.location, experience: c.experience, ctc: c.ctc, createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '' }); });
        styleHeaderRow(ws);
        break;
      }
      default: return res.status(400).json({ message: 'Invalid report type' });
    }

    const fullFilename = `${filename}_${dateSuffix}`;
    if (format === 'csv') {
      const worksheet = wb.worksheets[0]; const csvRows = [];
      worksheet.eachRow(row => { const v = []; row.eachCell({ includeEmpty: true }, cell => { let val = cell.value || ''; if (typeof val === 'string' && val.includes(',')) val = `"${val}"`; v.push(val); }); csvRows.push(v.join(',')); });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}.csv"`);
      return res.send(csvRows.join('\n'));
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { console.error('Export error:', err); res.status(500).json({ message: 'Export failed', error: err.message }); }
};

// Share report with team members
exports.shareReport = async (req, res) => {
  try {
    const { reportType, dateRange, customFrom, customTo, selectedMembers, message } = req.body;
    const userId = req.user.id;

    if (!selectedMembers || selectedMembers.length === 0) {
      return res.status(400).json({ success: false, message: 'No team members selected' });
    }

    const User = mongoose.model('User');
    const Notification = mongoose.model('Notification');
    const TeamMember = mongoose.model('TeamMember');

    const sender = await User.findById(userId).select('name email').lean();
    if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

    // Build date filter and get candidate count for the report
    const dateFilter = buildDateFilter(dateRange, customFrom, customTo);
    const candidateFilter = { createdBy: userId };
    if (dateFilter) candidateFilter.createdAt = dateFilter;
    const candidateCount = await Candidate.countDocuments(candidateFilter);

    const reportLabel = reportType === 'summary' ? 'Summary Report' : reportType === 'detailed' ? 'Detailed Report' : 'Analytics Report';
    const dateLabel = dateRange === 'custom' ? `${customFrom} to ${customTo}` : dateRange;

    // Create notifications for each selected member
    const notifications = [];
    for (const memberId of selectedMembers) {
      const member = await TeamMember.findById(memberId).lean();
      if (!member) continue;

      // Find the recipient user by their email
      const recipientUser = await User.findOne({ email: member.email.toLowerCase() }).select('_id').lean();
      if (!recipientUser) continue;

      notifications.push({
        userId: recipientUser._id,
        senderId: userId,
        senderName: sender.name || sender.email,
        type: 'system',
        title: `Report Shared: ${reportLabel}`,
        message: `${sender.name || sender.email} shared a ${reportLabel} with you (${dateLabel}, ${candidateCount} candidates).${message ? ` Message: "${message}"` : ''}`,
        priority: 'medium',
        isRead: false
      });
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.json({ success: true, message: `Report shared with ${notifications.length} team member(s)` });
  } catch (err) {
    console.error('Share report error:', err);
    res.status(500).json({ success: false, message: 'Failed to share report' });
  }
};
