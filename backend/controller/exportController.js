// backend/controller/exportController.js
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Organization = require('../models/Organization');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { analyticsScope, analyticsScopeMeta, canViewOrgAnalytics, requestedAnalyticsUserId } = require('../utils/dataScope');
const { foldStatusCounts, statusMatchValues, canonCandidateStatus } = require('../utils/statusCanon');
const { buildDateFilter, getDateRangeLabel } = require('../utils/analyticsTime');
const { withActivityDateRange, activityDateExpr } = require('../utils/candidateActivityDate');

async function scopeFilter(req) {
  return analyticsScope(req);
}

function statusInExpr(labels) {
  return { $in: ['$status', statusMatchValues(labels)] };
}

function statusCountExpr(labels) {
  return { $sum: { $cond: [statusInExpr(labels), 1, 0] } };
}

function styleHeaderRow(ws) {
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 28;
  ws.columns.forEach((col) => { col.width = Math.max(col.width || 12, 14); });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/** ExcelJS reserves cell.value — never use "value" as a column key. */
function polishDataRows(ws, { startRow = 2 } = {}) {
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;
    row.alignment = { vertical: 'middle', wrapText: true };
    row.height = Math.max(row.height || 0, 22);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber > 1) cell.alignment = { ...(cell.alignment || {}), horizontal: 'center', vertical: 'middle' };
    });
  });
}

function styleSectionRow(ws, rowNumber) {
  const row = ws.getRow(rowNumber);
  row.font = { bold: true, color: { argb: 'FF0F172A' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  row.height = 26;
  row.alignment = { vertical: 'middle' };
}

function displayLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return '—';
  if (s !== s.toUpperCase() || s.length <= 3) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

const PIPELINE_CHART_COLORS = {
  Applied: '#3b82f6', Screening: '#f59e0b', Interview: '#8b5cf6',
  Offer: '#06b6d4', Hired: '#10b981', Joined: '#059669',
  Rejected: '#ef4444', Dropped: '#6b7280',
};

// ═══════════════════════════════════════════
//  PDF HELPER FUNCTIONS
// ═══════════════════════════════════════════

function createPDFDoc() {
  return new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
}

function resolveLocalLogoPath(logo) {
  const raw = String(logo || '').trim();
  if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith('data:')) return null;
  const rel = raw.replace(/^\//, '');
  const file = path.join(__dirname, '..', rel);
  return fs.existsSync(file) ? file : null;
}

/** Resolve org logo for PDFKit — local disk, data URI, or S3 buffer. */
async function resolveLogoForPdf(logo) {
  const raw = String(logo || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:image')) {
    try {
      const b64 = raw.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      return Buffer.from(b64, 'base64');
    } catch {
      return null;
    }
  }
  const local = resolveLocalLogoPath(raw);
  if (local) return local;
  try {
    const s3Service = require('../services/s3Service');
    const rel = raw.replace(/^\//, '');
    const asset = await s3Service.getAssetBuffer(rel);
    if (asset?.buffer?.length) return asset.buffer;
  } catch {
    /* optional */
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetch(raw);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        if (ab.byteLength) return Buffer.from(ab);
      }
    } catch {
      /* optional */
    }
  }
  return null;
}

function drawPDFCover(doc, { title, periodLabel, scopeLabel, orgName, orgLogoPath }) {
  const w = doc.page.width;
  doc.rect(0, 0, w, 92).fill('#0f172a');
  doc.rect(0, 92, w, 3).fill('#14b8a6');
  if (orgLogoPath) {
    try {
      doc.image(orgLogoPath, w - 108, 14, { fit: [68, 34], align: 'right', valign: 'center' });
    } catch {
      /* logo optional */
    }
  }
  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold')
    .text('CONFIDENTIAL · INTERNAL RECRUITMENT REPORT', 40, 20);
  doc.fontSize(17).fillColor('#FFFFFF').font('Helvetica-Bold')
    .text(title, 40, 36, { width: w - (orgLogoPath ? 130 : 80) });
  const metaParts = [];
  if (orgName) metaParts.push(orgName);
  if (scopeLabel) metaParts.push(`Scope: ${scopeLabel}`);
  if (periodLabel) metaParts.push(`Period: ${periodLabel}`);
  doc.fontSize(9).fillColor('#cbd5e1').font('Helvetica')
    .text(metaParts.join('  ·  '), 40, 66, { width: w - 80 });
  doc.fontSize(8).fillColor('#64748b').font('Helvetica')
    .text(`Generated ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 40, 78);
  doc.y = 108;
}

function drawPDFHeader(doc, title, dateRangeLabel, meta = {}) {
  drawPDFCover(doc, {
    title,
    periodLabel: dateRangeLabel,
    scopeLabel: meta.scopeLabel || 'All employees',
    orgName: meta.orgName || '',
    orgLogoPath: meta.orgLogoPath || null,
  });
}

function drawPDFInsights(doc, insights = []) {
  if (!insights?.length) return;
  let y = doc.y;
  if (y + 60 > doc.page.height - 55) { doc.addPage(); y = 40; }

  doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('Executive summary', 40, y);
  y += 18;

  const pageW = doc.page.width - 80;
  const gap = 10;
  const cardW = (pageW - gap) / 2;
  const items = insights.slice(0, 6);
  let rowMax = 0;

  items.forEach((line, i) => {
    const col = i % 2;
    const x = 40 + col * (cardW + gap);

    if (col === 0 && i > 0) {
      y += rowMax + 10;
      rowMax = 0;
    }

    const textH = doc.heightOfString(String(line), { width: cardW - 28, fontSize: 8.5 });
    const cardH = Math.max(48, textH + 24);

    if (col === 0 && y + cardH > doc.page.height - 55) {
      doc.addPage();
      y = 40;
    }

    doc.roundedRect(x, y, cardW, cardH, 6).fill('#F8FAFC');
    doc.rect(x, y, 4, cardH).fill('#0d9488');
    doc.roundedRect(x, y, cardW, cardH, 6).strokeColor('#E2E8F0').lineWidth(0.6).stroke();
    doc.fontSize(8.5).fillColor('#334155').font('Helvetica')
      .text(String(line), x + 14, y + 12, { width: cardW - 28, lineGap: 2 });

    rowMax = Math.max(rowMax, cardH);
  });

  doc.y = y + rowMax + 14;
}

function drawPDFTable(doc, headers, rows, colWidths) {
  const startX = 40;
  const pageWidth = doc.page.width - 80;
  const headerHeight = 24;
  let y = doc.y;

  if (!colWidths) colWidths = headers.map(() => pageWidth / headers.length);

  const checkPage = (h) => {
    if (y + h > doc.page.height - 55) {
      doc.addPage();
      y = 40;
      return true;
    }
    return false;
  };

  const drawHeader = () => {
    checkPage(headerHeight);
    doc.rect(startX, y, pageWidth, headerHeight).fill('#0f172a');
    let x = startX;
    headers.forEach((h, i) => {
      doc.fontSize(7.5).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text(h, x + 5, y + 7, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'center', lineBreak: false });
      x += colWidths[i];
    });
    y += headerHeight;
  };

  drawHeader();

  rows.forEach((row, ri) => {
    const heights = row.map((cell, i) => {
      const text = cell != null ? String(cell) : '';
      return Math.max(20, doc.heightOfString(text, {
        width: colWidths[i] - 10,
        fontSize: 7.5,
      }) + 10);
    });
    const rowH = Math.max(...heights, 22);

    if (checkPage(rowH + 2)) drawHeader();

    doc.rect(startX, y, pageWidth, rowH).fill(ri % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
    doc.moveTo(startX, y + rowH).lineTo(startX + pageWidth, y + rowH).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
    let x = startX;
    row.forEach((cell, i) => {
      doc.fontSize(7.5).fillColor('#334155').font('Helvetica')
        .text(cell != null ? String(cell) : '', x + 5, y + 5, {
          width: colWidths[i] - 10,
          align: i === 0 ? 'left' : 'center',
          lineGap: 1,
        });
      x += colWidths[i];
    });
    y += rowH;
  });

  doc.y = y + 10;
}

function drawPDFSummaryCards(doc, cards) {
  const startX = 40;
  const cardW = (doc.page.width - 80 - 30) / Math.min(4, Math.max(cards.length, 1));
  const cardH = 54;
  if (doc.y + cardH + 10 > doc.page.height - 55) doc.addPage();
  const baseY = doc.y;
  cards.forEach((card, i) => {
    const x = startX + i * (cardW + 10);
    doc.roundedRect(x, baseY, cardW, cardH, 6).fill('#F8FAFC');
    doc.roundedRect(x, baseY, cardW, 4, 6).fill('#0d9488');
    doc.roundedRect(x, baseY, cardW, cardH, 6).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor('#64748B').font('Helvetica').text(card.label, x + 10, baseY + 12, { width: cardW - 20 });
    doc.fontSize(15).fillColor('#0F172A').font('Helvetica-Bold').text(String(card.value), x + 10, baseY + 26, {
      width: cardW - 20,
      lineBreak: false,
    });
  });
  doc.y = baseY + cardH + 14;
}

/** Enterprise-style horizontal bar chart for PDF reports */
function drawPDFBarChart(doc, items, { title = 'Distribution', maxBars = 10 } = {}) {
  if (!items?.length) return;
  const data = items.filter((d) => d.value > 0).slice(0, maxBars);
  if (!data.length) return;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartX = 40;
  const chartW = doc.page.width - 80;
  const labelW = 130;
  const rowH = 18;
  const chartH = data.length * rowH + 24;
  let y = doc.y;
  if (y + chartH > doc.page.height - 55) { doc.addPage(); y = 40; }

  doc.fontSize(11).fillColor('#0F172A').font('Helvetica-Bold').text(title, chartX, y);
  y += 20;

  data.forEach((item) => {
    const barW = Math.max(8, (item.value / maxVal) * (chartW - labelW - 36));
    const label = displayLabel(item.label);
    doc.fontSize(8).fillColor('#475569').font('Helvetica')
      .text(label, chartX, y + 2, { width: labelW - 6 });
    doc.roundedRect(chartX + labelW, y + 3, barW, 10, 2).fill(item.color || '#0d9488');
    doc.fontSize(8).fillColor('#0F172A').font('Helvetica-Bold')
      .text(String(item.value), chartX + labelW + barW + 6, y + 2, { lineBreak: false });
    y += rowH;
  });
  doc.y = y + 8;
}

/** Trend line chart (daily submissions) for PDF */
function drawPDFTrendChart(doc, points, { title = 'Submission Trend' } = {}) {
  if (!points?.length) return;
  const chartX = 40;
  const chartW = doc.page.width - 80;
  const chartH = 100;
  let y = doc.y;
  if (y + chartH + 30 > doc.page.height - 55) { doc.addPage(); y = 40; }

  doc.fontSize(11).fillColor('#0F172A').font('Helvetica-Bold').text(title, chartX, y);
  y += 18;

  const maxVal = Math.max(...points.map((p) => p.count), 1);
  const step = chartW / Math.max(points.length - 1, 1);
  const baseY = y + chartH;

  doc.moveTo(chartX, baseY).lineTo(chartX + chartW, baseY).strokeColor('#CBD5E1').lineWidth(0.5).stroke();

  let px = chartX;
  let py = baseY;
  points.forEach((p, i) => {
    const x = chartX + i * step;
    const h = (p.count / maxVal) * (chartH - 8);
    const cy = baseY - h;
    if (i > 0) {
      doc.moveTo(px, py).lineTo(x, cy).strokeColor('#4338CA').lineWidth(1.5).stroke();
    }
    doc.circle(x, cy, 2.5).fill('#4338CA');
    px = x;
    py = cy;
  });

  doc.y = baseY + 16;
}

function addPDFFooter(doc, orgName = '') {
  const pages = doc.bufferedPageRange();
  const orgBit = orgName ? `${orgName}  ·  ` : '';
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
      .text(
        `Page ${i + 1} of ${pages.count}  ·  ${orgBit}Confidential — internal use only`,
        40,
        doc.page.height - 30,
        { width: doc.page.width - 80, align: 'center' }
      );
  }
}

// ═══════════════════════════════════════════
//  REPORT GENERATORS
// ═══════════════════════════════════════════

async function getRecruitmentData(scope, dateFilter) {
  const userFilter = withActivityDateRange({ ...scope }, dateFilter);
  const pipelineCounts = await Candidate.aggregate([{ $match: userFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const pipeline = foldStatusCounts(pipelineCounts);
  const total = Object.values(pipeline).reduce((s, v) => s + v, 0);
  const hired = (pipeline.Hired || 0) + (pipeline.Joined || 0);
  const rejected = (pipeline.Rejected || 0) + (pipeline.Dropped || 0);
  const inProgress = (pipeline.Applied || 0) + (pipeline.Screening || 0) + (pipeline.Interview || 0) + (pipeline.Offer || 0);
  return { pipeline, total, hired, rejected, inProgress };
}

// Recruitment Summary - Excel
async function recruitmentSummaryReport(wb, scope, dateFilter) {
  const ws = wb.addWorksheet('Recruitment Summary');
  const { pipeline, total, hired, rejected, inProgress } = await getRecruitmentData(scope, dateFilter);
  // keys must NOT be "value" — ExcelJS reserves Cell.value
  ws.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Count', key: 'count', width: 14 },
    { header: 'Share %', key: 'share', width: 14 },
  ];
  const pctNum = (v) => (total ? Math.round((v / total) * 100) : 0);
  const pctStr = (v) => `${pctNum(v)}%`;

  const rows = [
    { metric: 'Total Candidates', count: total, share: '100%' },
    { metric: '', count: '', share: '' },
    { metric: 'Pipeline Breakdown', count: '', share: '' },
    ...['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped'].map((s) => ({
      metric: s,
      count: pipeline[s] || 0,
      share: pctStr(pipeline[s] || 0),
    })),
    { metric: '', count: '', share: '' },
    { metric: 'Key Metrics', count: '', share: '' },
    { metric: 'Total In Progress', count: inProgress, share: pctStr(inProgress) },
    { metric: 'Total Hired / Joined', count: hired, share: pctStr(hired) },
    { metric: 'Total Rejected / Dropped', count: rejected, share: pctStr(rejected) },
    { metric: 'Conversion Rate', count: pctStr(hired), share: '' },
    { metric: 'Rejection Rate', count: pctStr(rejected), share: '' },
  ];
  rows.forEach((r) => ws.addRow(r));
  styleHeaderRow(ws);
  polishDataRows(ws);
  // Section header rows (after ExcelJS header = row 1)
  [4, 14].forEach((n) => styleSectionRow(ws, n));
}

// Recruitment Summary - PDF
async function recruitmentSummaryPDF(doc, scope, dateFilter, label, meta = {}) {
  drawPDFHeader(doc, 'Recruitment Summary Report', label, meta);
  const { pipeline, total, hired, rejected, inProgress } = await getRecruitmentData(scope, dateFilter);
  const conv = total ? Math.round((hired / total) * 100) : 0;
  drawPDFSummaryCards(doc, [
    { label: 'Total Candidates', value: total.toLocaleString() },
    { label: 'In Progress', value: inProgress.toLocaleString() },
    { label: 'Hired / Joined', value: hired.toLocaleString() },
    { label: 'Conversion Rate', value: `${conv}%` },
  ]);

  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped'];
  drawPDFBarChart(doc, stages.filter((s) => pipeline[s]).map((s) => ({
    label: s,
    value: pipeline[s] || 0,
    color: PIPELINE_CHART_COLORS[s] || '#0d9488',
  })), { title: 'Pipeline Distribution' });

  const userFilter = withActivityDateRange({ ...scope }, dateFilter);
  const trendRows = await Candidate.aggregate([
    { $match: userFilter },
    { $addFields: { activityDate: activityDateExpr() } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$activityDate' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ]);
  if (trendRows.length > 1) {
    drawPDFTrendChart(doc, trendRows.map((r) => ({ day: r._id, count: r.count })), { title: 'Application trend' });
  }

  drawPDFInsights(doc, buildInsights({ total, hired, rejected, inProgress, pipeline }));

  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Pipeline Breakdown', 40); doc.moveDown(0.5);
  drawPDFTable(
    doc,
    ['Stage', 'Count', 'Share'],
    stages.filter((s) => pipeline[s]).map((s) => [
      s,
      pipeline[s] || 0,
      total ? `${Math.round(((pipeline[s] || 0) / total) * 100)}%` : '0%',
    ]),
    [200, 160, 155],
  );
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Key Metrics', 40); doc.moveDown(0.5);
  drawPDFTable(
    doc,
    ['Metric', 'Value'],
    [
      ['Total In Progress', inProgress],
      ['Total Hired / Joined', hired],
      ['Total Rejected / Dropped', rejected],
      ['Conversion Rate', `${conv}%`],
      ['Rejection Rate', total ? `${Math.round((rejected / total) * 100)}%` : '0%'],
    ],
    [300, 215],
  );
}

// Source Performance
async function getSourceData(scope, dateFilter) {
  const userFilter = withActivityDateRange({ ...scope }, dateFilter);
  return Candidate.aggregate([
    { $match: { ...userFilter, source: { $exists: true, $ne: '' } } },
    { $group: { _id: '$source', total: { $sum: 1 }, applied: statusCountExpr(['Applied']), screening: statusCountExpr(['Screening']), interview: statusCountExpr(['Interview']), offer: statusCountExpr(['Offer']), hired: statusCountExpr(['Hired', 'Joined']), rejected: statusCountExpr(['Rejected', 'Dropped']) } },
    { $sort: { total: -1 } }
  ]);
}

async function sourcePerformanceReport(wb, scope, dateFilter) {
  const ws = wb.addWorksheet('Source Performance');
  const sourceData = await getSourceData(scope, dateFilter);
  ws.columns = [{ header: 'Source', key: 'source', width: 20 }, { header: 'Total', key: 'total', width: 10 }, { header: 'Applied', key: 'applied', width: 10 }, { header: 'Screening', key: 'screening', width: 12 }, { header: 'Interview', key: 'interview', width: 12 }, { header: 'Offer', key: 'offer', width: 10 }, { header: 'Hired/Joined', key: 'hired', width: 14 }, { header: 'Rejected/Dropped', key: 'rejected', width: 16 }, { header: 'Conversion %', key: 'conversion', width: 14 }];
  sourceData.forEach(s => { ws.addRow({ source: s._id, total: s.total, applied: s.applied, screening: s.screening, interview: s.interview, offer: s.offer, hired: s.hired, rejected: s.rejected, conversion: s.total > 0 ? Math.round((s.hired / s.total) * 100) + '%' : '0%' }); });
  styleHeaderRow(ws);
  polishDataRows(ws);
}

async function sourcePerformancePDF(doc, scope, dateFilter, label, meta = {}) {
  drawPDFHeader(doc, 'Source Performance Report', label, meta);
  const data = await getSourceData(scope, dateFilter);
  const totalAll = data.reduce((s, d) => s + d.total, 0);
  const totalHired = data.reduce((s, d) => s + d.hired, 0);
  drawPDFSummaryCards(doc, [{ label: 'Total Sources', value: data.length }, { label: 'Total Candidates', value: totalAll }, { label: 'Top Source', value: data.length > 0 ? data[0]._id : 'N/A' }, { label: 'Best Conversion', value: data.reduce((b, s) => { const r = s.total > 0 ? (s.hired / s.total) * 100 : 0; return r > b.rate ? { n: s._id, rate: r } : b; }, { n: 'N/A', rate: 0 }).n }]);
  drawPDFBarChart(doc, data.slice(0, 8).map((s) => ({ label: String(s._id), value: s.total })), { title: 'Top Sources by Volume' });
  const trendChart = await fetchTrendChart(scope, dateFilter);
  if (trendChart.length > 1) {
    drawPDFTrendChart(doc, trendChart.map((r) => ({ day: r.date || r.day || r._id, count: r.count })), { title: 'Application trend' });
  }
  drawPDFInsights(doc, buildInsights({ total: totalAll, hired: totalHired, rejected: data.reduce((s, d) => s + d.rejected, 0), inProgress: 0, pipeline: {}, topSource: data[0]?._id }));
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Source-wise Breakdown', 40); doc.moveDown(0.5);
  const w = (doc.page.width - 80) / 9;
  drawPDFTable(doc, ['Source', 'Total', 'Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected', 'Conv%'], data.map(s => [displayLabel(s._id), s.total, s.applied, s.screening, s.interview, s.offer, s.hired, s.rejected, s.total > 0 ? Math.round((s.hired / s.total) * 100) + '%' : '0%']), [w * 1.8, w * 0.7, w * 0.75, w * 0.75, w * 0.85, w * 0.65, w * 0.7, w * 0.8, w * 0.8]);
}

// Position-wise Report
async function getPositionData(scope, dateFilter) {
  const userFilter = withActivityDateRange({ ...scope }, dateFilter);
  return Candidate.aggregate([
    { $match: { ...userFilter, position: { $exists: true, $ne: '' } } },
    { $group: { _id: '$position', total: { $sum: 1 }, applied: statusCountExpr(['Applied']), screening: statusCountExpr(['Screening']), interview: statusCountExpr(['Interview']), offer: statusCountExpr(['Offer']), hired: statusCountExpr(['Hired', 'Joined']), rejected: statusCountExpr(['Rejected', 'Dropped']) } },
    { $sort: { total: -1 } }
  ]);
}

async function positionWiseReport(wb, scope, dateFilter) {
  const ws = wb.addWorksheet('Position Report');
  const data = await getPositionData(scope, dateFilter);
  ws.columns = [{ header: 'Position', key: 'position', width: 26 }, { header: 'Total', key: 'total', width: 10 }, { header: 'Applied', key: 'applied', width: 10 }, { header: 'Screening', key: 'screening', width: 12 }, { header: 'Interview', key: 'interview', width: 12 }, { header: 'Offer', key: 'offer', width: 10 }, { header: 'Hired/Joined', key: 'hired', width: 14 }, { header: 'Rejected/Dropped', key: 'rejected', width: 16 }, { header: 'Fill Rate %', key: 'fillRate', width: 12 }];
  data.forEach(p => { ws.addRow({ position: p._id, total: p.total, applied: p.applied, screening: p.screening, interview: p.interview, offer: p.offer, hired: p.hired, rejected: p.rejected, fillRate: p.total > 0 ? Math.round((p.hired / p.total) * 100) + '%' : '0%' }); });
  styleHeaderRow(ws);
  polishDataRows(ws);
  ws.getColumn(1).width = 36;
}

async function positionWisePDF(doc, scope, dateFilter, label, meta = {}) {
  drawPDFHeader(doc, 'Position-wise Report', label, meta);
  const data = await getPositionData(scope, dateFilter);
  const totalAll = data.reduce((s, d) => s + d.total, 0);
  const totalHired = data.reduce((s, d) => s + d.hired, 0);
  drawPDFSummaryCards(doc, [{ label: 'Total Positions', value: data.length }, { label: 'Total Candidates', value: totalAll }, { label: 'Avg per Position', value: data.length > 0 ? Math.round(totalAll / data.length) : 0 }, { label: 'Active Positions', value: data.filter(p => p.total > 0).length }]);
  drawPDFBarChart(doc, data.slice(0, 8).map((p) => ({ label: String(p._id), value: p.total })), { title: 'Top Positions by Volume' });
  const trendChart = await fetchTrendChart(scope, dateFilter);
  if (trendChart.length > 1) {
    drawPDFTrendChart(doc, trendChart.map((r) => ({ day: r.date || r.day || r._id, count: r.count })), { title: 'Application trend' });
  }
  drawPDFInsights(doc, buildInsights({ total: totalAll, hired: totalHired, rejected: data.reduce((s, d) => s + d.rejected, 0), inProgress: 0, pipeline: {}, topPosition: data[0]?._id }));
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Position-wise Breakdown', 40); doc.moveDown(0.5);
  const w = (doc.page.width - 80) / 9;
  drawPDFTable(doc, ['Position', 'Total', 'Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected', 'Fill%'], data.map(p => [displayLabel(p._id), p.total, p.applied, p.screening, p.interview, p.offer, p.hired, p.rejected, p.total > 0 ? Math.round((p.hired / p.total) * 100) + '%' : '0%']), [w * 2.2, w * 0.65, w * 0.75, w * 0.75, w * 0.85, w * 0.65, w * 0.7, w * 0.8, w * 0.75]);
}

// Client Report
async function getClientData(scope, dateFilter) {
  const userFilter = withActivityDateRange({ ...scope }, dateFilter);
  return Candidate.aggregate([
    { $match: { ...userFilter, client: { $exists: true, $ne: '' } } },
    { $group: { _id: '$client', total: { $sum: 1 }, hired: statusCountExpr(['Hired', 'Joined']), interview: statusCountExpr(['Interview']), offer: statusCountExpr(['Offer']), rejected: statusCountExpr(['Rejected', 'Dropped']) } },
    { $sort: { total: -1 } }
  ]);
}

async function clientReport(wb, scope, dateFilter) {
  const ws = wb.addWorksheet('Client Report');
  const data = await getClientData(scope, dateFilter);
  ws.columns = [{ header: 'Client', key: 'client', width: 26 }, { header: 'Total Candidates', key: 'total', width: 16 }, { header: 'In Interview', key: 'interview', width: 14 }, { header: 'Offer', key: 'offer', width: 10 }, { header: 'Hired/Joined', key: 'hired', width: 14 }, { header: 'Rejected/Dropped', key: 'rejected', width: 16 }, { header: 'Success Rate %', key: 'successRate', width: 16 }];
  data.forEach(c => { ws.addRow({ client: c._id, total: c.total, interview: c.interview, offer: c.offer, hired: c.hired, rejected: c.rejected, successRate: c.total > 0 ? Math.round((c.hired / c.total) * 100) + '%' : '0%' }); });
  styleHeaderRow(ws);
  polishDataRows(ws);
}

async function clientReportPDF(doc, scope, dateFilter, label, meta = {}) {
  drawPDFHeader(doc, 'Client Report', label, meta);
  const data = await getClientData(scope, dateFilter);
  const totalAll = data.reduce((s, d) => s + d.total, 0);
  const totalHired = data.reduce((s, d) => s + d.hired, 0);
  drawPDFSummaryCards(doc, [{ label: 'Total Clients', value: data.length }, { label: 'Total Candidates', value: totalAll }, { label: 'Total Hired', value: totalHired }, { label: 'Avg Success', value: totalAll > 0 ? Math.round((totalHired / totalAll) * 100) + '%' : '0%' }]);
  drawPDFBarChart(doc, data.slice(0, 8).map((c) => ({ label: String(c._id).slice(0, 20), value: c.total })), { title: 'Top Clients by Volume' });
  const trendChart = await fetchTrendChart(scope, dateFilter);
  if (trendChart.length > 1) {
    drawPDFTrendChart(doc, trendChart.map((r) => ({ day: r.date || r.day || r._id, count: r.count })), { title: 'Application trend' });
  }
  drawPDFInsights(doc, buildInsights({ total: totalAll, hired: totalHired, rejected: data.reduce((s, d) => s + d.rejected, 0), inProgress: data.reduce((s, d) => s + d.interview + d.offer, 0), pipeline: {} }));
  doc.fontSize(11).fillColor('#1E293B').font('Helvetica-Bold').text('Client-wise Breakdown', 40); doc.moveDown(0.5);
  const w = (doc.page.width - 80) / 7;
  drawPDFTable(doc, ['Client', 'Total', 'Interview', 'Offer', 'Hired', 'Rejected', 'Success%'], data.map(c => [c._id, c.total, c.interview, c.offer, c.hired, c.rejected, c.total > 0 ? Math.round((c.hired / c.total) * 100) + '%' : '0%']), [w * 1.4, w * 0.9, w * 0.9, w * 0.8, w * 0.9, w * 0.9, w * 1.2]);
}

// Pipeline Status - PDF
async function pipelineStatusPDF(doc, scope, dateFilter, label, meta = {}) {
  drawPDFHeader(doc, 'Pipeline Status Report', label, meta);
  const userFilter = withActivityDateRange({ ...scope }, dateFilter);
  const candidates = await Candidate.find(userFilter).sort({ appliedAt: -1, createdAt: -1 }).lean();
  const statusCounts = {};
  candidates.forEach((c) => {
    const s = canonCandidateStatus(c.status);
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const cards = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, c]) => ({ label: s, value: c }));
  if (cards.length > 0) drawPDFSummaryCards(doc, cards);
  drawPDFBarChart(doc, Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, c]) => ({
    label: s,
    value: c,
    color: PIPELINE_CHART_COLORS[s] || '#4338CA',
  })), { title: 'Status Distribution' });
  const trendChart = await fetchTrendChart(scope, dateFilter);
  if (trendChart.length > 1) {
    drawPDFTrendChart(doc, trendChart.map((r) => ({ day: r.date || r.day || r._id, count: r.count })), { title: 'Application trend' });
  }
  drawPDFInsights(doc, buildInsights({
    total: candidates.length,
    hired: (statusCounts.Hired || 0) + (statusCounts.Joined || 0),
    rejected: (statusCounts.Rejected || 0) + (statusCounts.Dropped || 0),
    inProgress: (statusCounts.Applied || 0) + (statusCounts.Screening || 0) + (statusCounts.Interview || 0) + (statusCounts.Offer || 0),
    pipeline: statusCounts,
  }));
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
//  BUFFER GENERATOR (for scheduled reports — see services/reportScheduler.js)
//  Same report builders as exportReport() below, but returns a Buffer
//  instead of streaming straight to an HTTP response, since there's no
//  `res` object when a cron-style job generates this unattended.
// ═══════════════════════════════════════════
async function generateReportBuffer({ reportType, format, organizationId, dateRange, customFrom, customTo }) {
  const scope = { organizationId };
  const dateFilter = buildDateFilter(dateRange, customFrom, customTo);
  const dateRangeLabel = getDateRangeLabel(dateRange, customFrom, customTo);
  const userFilter = withActivityDateRange({ ...scope }, dateFilter);

  const filenames = {
    'recruitment-summary': 'Recruitment_Summary',
    'source-performance': 'Source_Performance',
    'position-report': 'Position_Report',
    'client-report': 'Client_Report',
    'pipeline-status': 'Pipeline_Status'
  };
  const filename = filenames[reportType];
  if (!filename) throw new Error(`Invalid report type: ${reportType}`);

  if (format === 'pdf') {
    const doc = createPDFDoc();
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise((resolve) => doc.on('end', resolve));

    switch (reportType) {
      case 'recruitment-summary': await recruitmentSummaryPDF(doc, scope, dateFilter, dateRangeLabel); break;
      case 'source-performance': await sourcePerformancePDF(doc, scope, dateFilter, dateRangeLabel); break;
      case 'position-report': await positionWisePDF(doc, scope, dateFilter, dateRangeLabel); break;
      case 'client-report': await clientReportPDF(doc, scope, dateFilter, dateRangeLabel); break;
      case 'pipeline-status': await pipelineStatusPDF(doc, scope, dateFilter, dateRangeLabel); break;
    }
    let orgNameForFooter = '';
    if (organizationId) {
      const org = await Organization.findById(organizationId).select('name').lean();
      orgNameForFooter = org?.name || '';
    }
    addPDFFooter(doc, orgNameForFooter);
    doc.end();
    await done;
    return { buffer: Buffer.concat(chunks), filename: `${filename}.pdf`, contentType: 'application/pdf' };
  }

  const wb = new ExcelJS.Workbook(); wb.creator = 'SkillNix'; wb.created = new Date();
  switch (reportType) {
    case 'recruitment-summary': await recruitmentSummaryReport(wb, scope, dateFilter); break;
    case 'source-performance': await sourcePerformanceReport(wb, scope, dateFilter); break;
    case 'position-report': await positionWiseReport(wb, scope, dateFilter); break;
    case 'client-report': await clientReport(wb, scope, dateFilter); break;
    case 'pipeline-status': {
      const candidates = await Candidate.find(userFilter).sort({ status: 1, createdAt: -1 }).lean();
      const ws = wb.addWorksheet('Pipeline Status');
      ws.columns = [{ header: 'Name', key: 'name', width: 22 }, { header: 'Position', key: 'position', width: 22 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Source', key: 'source', width: 14 }, { header: 'Client', key: 'client', width: 18 }, { header: 'Location', key: 'location', width: 16 }, { header: 'Experience', key: 'experience', width: 12 }, { header: 'CTC', key: 'ctc', width: 12 }, { header: 'Added On', key: 'createdAt', width: 14 }];
      candidates.forEach(c => { ws.addRow({ name: c.name, position: c.position, status: c.status, source: c.source, client: c.client, location: c.location, experience: c.experience, ctc: c.ctc, createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '' }); });
      styleHeaderRow(ws);
      polishDataRows(ws);
      break;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: `${filename}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}
exports.generateReportBuffer = generateReportBuffer;

const PIPELINE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped'];

async function fetchTrendChart(scope, dateFilter, limit = 30) {
  const userFilter = withActivityDateRange({ ...scope }, dateFilter);
  const rows = await Candidate.aggregate([
    { $match: userFilter },
    { $addFields: { activityDate: activityDateExpr() } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$activityDate' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({
    date: r._id,
    label: new Date(r._id).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    count: r.count,
  }));
}

function pipelineChartFromCounts(pipeline) {
  return PIPELINE_STAGES
    .filter((s) => (pipeline[s] || 0) > 0)
    .map((s) => ({ label: s, value: pipeline[s] || 0, color: PIPELINE_CHART_COLORS[s] }));
}

function reportMeta(dateRange, customFrom, customTo) {
  return {
    subtitle: getDateRangeLabel(dateRange, customFrom, customTo),
    generatedAt: new Date().toISOString(),
  };
}

async function enrichReportMeta(req, meta) {
  const scopeMeta = analyticsScopeMeta(req);
  let scopeLabel = 'All employees';
  if (scopeMeta.scope === 'employee' && scopeMeta.scopedUserId) {
    const target = await User.findById(scopeMeta.scopedUserId).select('name email').lean();
    const name = target?.name || (target?.email || '').split('@')[0] || 'Recruiter';
    scopeLabel = `${name}'s desk`;
  } else if (scopeMeta.scope === 'employee') {
    scopeLabel = 'Your desk';
  }
  let orgName = '';
  let orgLogo = '';
  let orgLogoPath = null;
  if (req.user?.organizationId) {
    const org = await Organization.findById(req.user.organizationId).select('name logo').lean();
    orgName = org?.name || '';
    orgLogo = org?.logo || '';
    orgLogoPath = await resolveLogoForPdf(orgLogo);
  }
  return { ...meta, scopeLabel, orgName, orgLogo, orgLogoPath };
}

function buildInsights({ total, hired, rejected, inProgress, pipeline, topSource, topPosition }) {
  const insights = [];
  const conv = total > 0 ? Math.round((hired / total) * 100) : 0;
  const rej = total > 0 ? Math.round((rejected / total) * 100) : 0;
  if (total > 0) {
    insights.push(
      `Period volume: ${total.toLocaleString()} candidate${total === 1 ? '' : 's'}. Hire rate ${conv}%. Attrition rate ${rej}%.`
    );
  }
  if (inProgress > 0) {
    insights.push(`${inProgress.toLocaleString()} candidate${inProgress === 1 ? '' : 's'} currently active across open pipeline stages.`);
  }
  const topStage = Object.entries(pipeline || {}).sort((a, b) => b[1] - a[1])[0];
  if (topStage?.[0]) {
    insights.push(`Highest concentration: ${topStage[0]} (${topStage[1].toLocaleString()} candidates).`);
  }
  if (topSource) insights.push(`Leading source channel: ${displayLabel(topSource)}.`);
  if (topPosition) insights.push(`Highest-volume role: ${displayLabel(topPosition)}.`);
  if (!insights.length) insights.push('No candidates match this period. Expand the date range to generate insights.');
  return insights;
}

// ═══════════════════════════════════════════
//  PREVIEW ENDPOINT
// ═══════════════════════════════════════════
exports.previewReport = async (req, res) => {
  try {
    const scope = await scopeFilter(req);
    const { reportType, dateRange, customFrom, customTo } = req.body;
    if (!reportType) return res.status(400).json({ message: 'Report type is required' });
    const dateFilter = buildDateFilter(dateRange, customFrom, customTo);
    const userFilter = withActivityDateRange({ ...scope }, dateFilter);
    const meta = await enrichReportMeta(req, reportMeta(dateRange, customFrom, customTo));
    let preview = { title: '', headers: [], rows: [], summary: [], ...meta };

    switch (reportType) {
      case 'recruitment-summary': {
        preview.title = 'Recruitment Summary Report';
        const { pipeline, total, hired, rejected, inProgress } = await getRecruitmentData(scope, dateFilter);
        const conv = total ? Math.round((hired / total) * 100) : 0;
        const rej = total ? Math.round((rejected / total) * 100) : 0;
        const trendChart = await fetchTrendChart(scope, dateFilter);
        preview.summary = [
          { label: 'Total candidates', value: total.toLocaleString() },
          { label: 'Active in pipeline', value: inProgress.toLocaleString() },
          { label: 'Hired & joined', value: hired.toLocaleString() },
          { label: 'Hire rate', value: conv + '%' },
        ];
        preview.metrics = [
          { label: 'Rejected or dropped', value: rejected.toLocaleString() },
          { label: 'Drop-off rate', value: rej + '%' },
          { label: 'Open pipeline', value: inProgress.toLocaleString() },
        ];
        preview.pipelineChart = pipelineChartFromCounts(pipeline);
        preview.trendChart = trendChart;
        preview.chartTitle = 'Pipeline by stage';
        preview.insights = buildInsights({ total, hired, rejected, inProgress, pipeline });
        preview.headers = ['Stage', 'Count', 'Share'];
        preview.rows = PIPELINE_STAGES.map((s) => [
          s,
          pipeline[s] || 0,
          total ? Math.round(((pipeline[s] || 0) / total) * 100) + '%' : '0%',
        ]);
        preview.totalCount = total;
        break;
      }
      case 'source-performance': {
        preview.title = 'Source Performance Report';
        const data = await getSourceData(scope, dateFilter);
        const totalAll = data.reduce((s, d) => s + d.total, 0);
        const totalHired = data.reduce((s, d) => s + d.hired, 0);
        preview.summary = [
          { label: 'Total Sources', value: data.length },
          { label: 'Total Candidates', value: totalAll.toLocaleString() },
          { label: 'Hired / Joined', value: totalHired.toLocaleString() },
          { label: 'Overall Conversion', value: totalAll ? Math.round((totalHired / totalAll) * 100) + '%' : '0%' },
        ];
        preview.pipelineChart = data.slice(0, 8).map((s) => ({ label: s._id, value: s.total, fullLabel: s._id }));
        preview.trendChart = await fetchTrendChart(scope, dateFilter);
        preview.chartTitle = 'Top sources';
        preview.insights = buildInsights({
          total: totalAll,
          hired: totalHired,
          rejected: data.reduce((s, d) => s + d.rejected, 0),
          inProgress: 0,
          pipeline: {},
          topSource: data[0]?._id,
        });
        preview.headers = ['Source', 'Total', 'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Conv.'];
        preview.rows = data.slice(0, 25).map((s) => [
          s._id, s.total, s.applied, s.screening, s.interview, s.offer, s.hired, s.rejected,
          s.total > 0 ? Math.round((s.hired / s.total) * 100) + '%' : '0%',
        ]);
        preview.totalRows = data.length;
        preview.totalCount = totalAll;
        break;
      }
      case 'position-report': {
        preview.title = 'Position-wise Report';
        const data = await getPositionData(scope, dateFilter);
        const totalAll = data.reduce((s, d) => s + d.total, 0);
        const totalHired = data.reduce((s, d) => s + d.hired, 0);
        preview.summary = [
          { label: 'Positions', value: data.length },
          { label: 'Total Candidates', value: totalAll.toLocaleString() },
          { label: 'Hired / Joined', value: totalHired.toLocaleString() },
          { label: 'Avg Fill Rate', value: totalAll ? Math.round((totalHired / totalAll) * 100) + '%' : '0%' },
        ];
        preview.pipelineChart = data.slice(0, 8).map((p) => ({ label: displayLabel(p._id), value: p.total, fullLabel: p._id }));
        preview.trendChart = await fetchTrendChart(scope, dateFilter);
        preview.chartTitle = 'Top positions';
        preview.insights = buildInsights({
          total: totalAll,
          hired: totalHired,
          rejected: data.reduce((s, d) => s + d.rejected, 0),
          inProgress: 0,
          pipeline: {},
          topPosition: data[0]?._id,
        });
        preview.headers = ['Position', 'Total', 'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Fill Rate'];
        preview.rows = data.slice(0, 25).map((p) => [
          displayLabel(p._id), p.total, p.applied, p.screening, p.interview, p.offer, p.hired, p.rejected,
          p.total > 0 ? Math.round((p.hired / p.total) * 100) + '%' : '0%',
        ]);
        preview.totalRows = data.length;
        preview.totalCount = totalAll;
        break;
      }
      case 'client-report': {
        preview.title = 'Client Report';
        const data = await getClientData(scope, dateFilter);
        const totalAll = data.reduce((s, d) => s + d.total, 0);
        const totalHired = data.reduce((s, d) => s + d.hired, 0);
        preview.summary = [
          { label: 'Clients', value: data.length },
          { label: 'Total Candidates', value: totalAll.toLocaleString() },
          { label: 'Hired / Joined', value: totalHired.toLocaleString() },
          { label: 'Success Rate', value: totalAll ? Math.round((totalHired / totalAll) * 100) + '%' : '0%' },
        ];
        preview.pipelineChart = data.slice(0, 8).map((c) => ({ label: String(c._id).slice(0, 22), value: c.total, fullLabel: c._id }));
        preview.trendChart = await fetchTrendChart(scope, dateFilter);
        preview.chartTitle = 'Top clients';
        preview.insights = buildInsights({
          total: totalAll,
          hired: totalHired,
          rejected: data.reduce((s, d) => s + d.rejected, 0),
          inProgress: data.reduce((s, d) => s + d.interview + d.offer, 0),
          pipeline: {},
        });
        preview.headers = ['Client', 'Total', 'Interview', 'Offer', 'Hired', 'Rejected', 'Success Rate'];
        preview.rows = data.slice(0, 25).map((c) => [
          c._id, c.total, c.interview, c.offer, c.hired, c.rejected,
          c.total > 0 ? Math.round((c.hired / c.total) * 100) + '%' : '0%',
        ]);
        preview.totalRows = data.length;
        preview.totalCount = totalAll;
        break;
      }
      case 'pipeline-status': {
        preview.title = 'Pipeline Status Report';
        const candidates = await Candidate.find(userFilter)
          .sort({ appliedAt: -1, createdAt: -1 })
          .select('name position status source client appliedAt createdAt date')
          .lean();
        const sc = {};
        candidates.forEach((c) => {
          const s = canonCandidateStatus(c.status);
          sc[s] = (sc[s] || 0) + 1;
        });
        preview.summary = [
          { label: 'Total Candidates', value: candidates.length.toLocaleString() },
          { label: 'Pipeline Stages', value: Object.keys(sc).length },
          { label: 'Top Status', value: Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0] || '—' },
          { label: 'In Period', value: meta.subtitle },
        ];
        preview.pipelineChart = Object.entries(sc)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([label, value]) => ({ label, value, color: PIPELINE_CHART_COLORS[label] }));
        preview.trendChart = await fetchTrendChart(scope, dateFilter);
        preview.chartTitle = 'Status distribution';
        preview.insights = buildInsights({
          total: candidates.length,
          hired: (sc.Hired || 0) + (sc.Joined || 0),
          rejected: (sc.Rejected || 0) + (sc.Dropped || 0),
          inProgress: (sc.Applied || 0) + (sc.Screening || 0) + (sc.Interview || 0) + (sc.Offer || 0),
          pipeline: sc,
        });
        preview.headers = ['Name', 'Position', 'Status', 'Source', 'Client', 'Record Date'];
        preview.rows = candidates.slice(0, 25).map((c) => [
          c.name,
          c.position || '',
          canonCandidateStatus(c.status),
          c.source || '',
          c.client || '',
          c.date || (c.appliedAt ? new Date(c.appliedAt).toLocaleDateString('en-IN') : ''),
        ]);
        preview.totalRows = candidates.length;
        preview.totalCount = candidates.length;
        break;
      }
      default: return res.status(400).json({ message: 'Invalid report type' });
    }
    if (preview.totalCount == null) {
      const totalRow = preview.summary?.find((s) => /total/i.test(s.label));
      preview.totalCount = totalRow
        ? parseInt(String(totalRow.value).replace(/[^\d]/g, ''), 10) || 0
        : preview.rows?.length || 0;
    }
    delete preview.orgLogoPath;
    res.json(preview);
  } catch (err) {
    const status = err.statusCode || 500;
    if (status < 500) return res.status(status).json({ message: err.message });
    console.error('Preview error:', err);
    res.status(500).json({ message: 'Preview failed', error: err.message });
  }
};

// ═══════════════════════════════════════════
//  MAIN EXPORT ENDPOINT
// ═══════════════════════════════════════════
exports.exportReport = async (req, res) => {
  try {
    const scope = await scopeFilter(req);
    const { reportType, format, dateRange, customFrom, customTo } = req.body;
    if (!reportType) return res.status(400).json({ message: 'Report type is required' });

    const dateFilter = buildDateFilter(dateRange, customFrom, customTo);
    const dateRangeLabel = getDateRangeLabel(dateRange, customFrom, customTo);
    const userFilter = withActivityDateRange({ ...scope }, dateFilter);
    const dateSuffix = new Date().toISOString().split('T')[0];
    const meta = await enrichReportMeta(req, reportMeta(dateRange, customFrom, customTo));

    // ═══════ PDF FORMAT ═══════
    if (format === 'pdf') {
      const doc = createPDFDoc();
      let filename = 'report';
      switch (reportType) {
        case 'recruitment-summary': filename = 'Recruitment_Summary'; await recruitmentSummaryPDF(doc, scope, dateFilter, dateRangeLabel, meta); break;
        case 'source-performance': filename = 'Source_Performance'; await sourcePerformancePDF(doc, scope, dateFilter, dateRangeLabel, meta); break;
        case 'position-report': filename = 'Position_Report'; await positionWisePDF(doc, scope, dateFilter, dateRangeLabel, meta); break;
        case 'client-report': filename = 'Client_Report'; await clientReportPDF(doc, scope, dateFilter, dateRangeLabel, meta); break;
        case 'pipeline-status': filename = 'Pipeline_Status'; await pipelineStatusPDF(doc, scope, dateFilter, dateRangeLabel, meta); break;
        default: return res.status(400).json({ message: 'Invalid report type' });
      }
      addPDFFooter(doc, meta.orgName);
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
      case 'recruitment-summary': filename = 'Recruitment_Summary'; await recruitmentSummaryReport(wb, scope, dateFilter); break;
      case 'source-performance': filename = 'Source_Performance'; await sourcePerformanceReport(wb, scope, dateFilter); break;
      case 'position-report': filename = 'Position_Report'; await positionWiseReport(wb, scope, dateFilter); break;
      case 'client-report': filename = 'Client_Report'; await clientReport(wb, scope, dateFilter); break;
      case 'pipeline-status': {
        filename = 'Pipeline_Status';
        const candidates = await Candidate.find(userFilter).sort({ status: 1, createdAt: -1 }).lean();
        const ws = wb.addWorksheet('Pipeline Status');
        ws.columns = [{ header: 'Name', key: 'name', width: 22 }, { header: 'Position', key: 'position', width: 22 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Source', key: 'source', width: 14 }, { header: 'Client', key: 'client', width: 18 }, { header: 'Location', key: 'location', width: 16 }, { header: 'Experience', key: 'experience', width: 12 }, { header: 'CTC', key: 'ctc', width: 12 }, { header: 'Added On', key: 'createdAt', width: 14 }];
        candidates.forEach(c => { ws.addRow({ name: c.name, position: c.position, status: c.status, source: c.source, client: c.client, location: c.location, experience: c.experience, ctc: c.ctc, createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '' }); });
        styleHeaderRow(ws);
        polishDataRows(ws);
        ws.getColumn(2).width = 32;
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
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    const status = err.statusCode || 500;
    if (status < 500) return res.status(status).json({ message: err.message });
    console.error('Export error:', err);
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
};

// Share report with team members (workspace users + directory contacts)
exports.shareReport = async (req, res) => {
  try {
    const {
      reportType,
      dateRange,
      customFrom,
      customTo,
      selectedMembers,
      message,
      format = 'pdf',
    } = req.body;
    const userId = req.user.id;
    const orgId = req.user.organizationId;

    if (!Array.isArray(selectedMembers) || selectedMembers.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one team member' });
    }

    const User = mongoose.model('User');
    const TeamMember = mongoose.model('TeamMember');

    const sender = await User.findById(userId).select('name email organizationId').lean();
    if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

    const dateFilter = buildDateFilter(dateRange, customFrom, customTo);
    const candidateFilter = withActivityDateRange(await scopeFilter(req), dateFilter);
    const candidateCount = await Candidate.countDocuments(candidateFilter);

    const REPORT_LABELS = {
      'recruitment-summary': 'Recruitment Summary',
      'source-performance': 'Source Performance',
      'position-report': 'Position-wise Report',
      'client-report': 'Client Report',
      'pipeline-status': 'Pipeline Status',
    };
    const reportLabel = REPORT_LABELS[reportType] || 'Analytics Report';
    const dateLabel = getDateRangeLabel(dateRange, customFrom, customTo);
    const formatLabel = format === 'xlsx' ? 'Excel' : 'PDF';
    const senderName = sender.name || sender.email || 'A teammate';
    const note = String(message || '').trim();

    const {
      wrapBrandedEmailHtml,
      brandButtonHtml,
      infoPanelHtml,
      escapeHtml,
      publicSiteBase,
      loadOrgEmailBrand,
    } = require('../services/emailBrandLayout');
    const { sendEmail } = require('../services/emailService');

    const baseUrl = (typeof publicSiteBase === 'function' ? publicSiteBase() : '') || process.env.FRONTEND_URL || 'https://www.peopleconnecthr.com';
    const scopeEmployee = String(req.body.userId || '').trim();
    const linkPath = `/analytics?tab=export&period=${encodeURIComponent(dateRange || 'month')}${
      dateRange === 'custom' && customFrom && customTo
        ? `&from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`
        : ''
    }${reportType ? `&report=${encodeURIComponent(reportType)}` : ''}&format=${encodeURIComponent(format === 'xlsx' ? 'xlsx' : 'pdf')}${
      scopeEmployee ? `&employee=${encodeURIComponent(scopeEmployee)}` : ''
    }`;
    const analyticsUrl = `${String(baseUrl).replace(/\/$/, '')}${linkPath}`;

    const ids = [...new Set(selectedMembers.map((id) => String(id || '').trim()).filter(Boolean))];
    const recipients = [];
    const seenEmails = new Set();

    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) continue;

      let userDoc = await User.findById(id).select('name email organizationId').lean();
      let contactDoc = null;

      if (userDoc) {
        if (orgId && userDoc.organizationId && String(userDoc.organizationId) !== String(orgId)) {
          continue;
        }
      } else {
        contactDoc = await TeamMember.findById(id).select('name email organizationId').lean();
        if (!contactDoc) continue;
        if (orgId && contactDoc.organizationId && String(contactDoc.organizationId) !== String(orgId)) {
          continue;
        }
        userDoc = await User.findOne({
          email: String(contactDoc.email || '').toLowerCase(),
          ...(orgId ? { organizationId: orgId } : {}),
        }).select('_id name email').lean();
      }

      const email = String(userDoc?.email || contactDoc?.email || '').toLowerCase().trim();
      if (!email || seenEmails.has(email)) continue;
      if (email === String(sender.email || '').toLowerCase()) continue;
      seenEmails.add(email);

      recipients.push({
        email,
        name: userDoc?.name || contactDoc?.name || email.split('@')[0],
        userId: userDoc?._id || null,
      });
    }

    if (!recipients.length) {
      return res.status(400).json({
        success: false,
        message: 'No valid recipients found. Choose teammates with a valid email address.',
      });
    }

    let brand = { name: '', logoUrl: '', brandColor: '#0d9488', wordmark: false };
    try {
      if (orgId) brand = await loadOrgEmailBrand(orgId) || brand;
    } catch {
      /* brand optional */
    }

    const detailsHtml = infoPanelHtml([
      { label: 'Report', value: reportLabel },
      { label: 'Period', value: dateLabel },
      { label: 'Format', value: formatLabel },
      { label: 'Candidates', value: String(candidateCount.toLocaleString()) },
      { label: 'Shared by', value: senderName },
      ...(note ? [{ label: 'Note', value: note }] : []),
    ], brand.brandColor || '#0d9488');

    const bodyHtml = `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">
        <strong>${escapeHtml(senderName)}</strong> shared an analytics report with you.
      </p>
      ${detailsHtml}
      <p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#475569;">
        Open Analytics to preview or download the full ${escapeHtml(formatLabel)} report.
      </p>
      ${brandButtonHtml({ href: analyticsUrl, label: 'Open report in Analytics', brandColor: brand.brandColor || '#0d9488' })}
    `;

    const subject = `${senderName} shared ${reportLabel} (${dateLabel})`;
    const textBody = [
      `${senderName} shared an analytics report with you.`,
      `Report: ${reportLabel}`,
      `Period: ${dateLabel}`,
      `Format: ${formatLabel}`,
      `Candidates: ${candidateCount}`,
      note ? `Note: ${note}` : null,
      `Open: ${analyticsUrl}`,
    ].filter(Boolean).join('\n');

    const html = wrapBrandedEmailHtml({
      title: 'Report shared with you',
      eyebrow: 'Analytics',
      category: 'report',
      orgName: brand.name,
      logoUrl: brand.logoUrl,
      brandColor: brand.brandColor,
      wordmark: brand.wordmark,
      bodyHtml,
    });

    let emailed = 0;
    const emailErrors = [];
    let notified = 0;

    const inAppUserIds = recipients.map((r) => r.userId).filter(Boolean);
    if (inAppUserIds.length) {
      const { notifyMany } = require('../utils/reportingScope');
      const created = await notifyMany(inAppUserIds, {
        type: 'report_shared',
        title: `Report shared: ${reportLabel}`,
        message: note
          ? `${senderName} shared ${reportLabel} (${dateLabel}, ${candidateCount.toLocaleString()} candidates).\n\nNote: ${note}`
          : `${senderName} shared ${reportLabel} for ${dateLabel} · ${candidateCount.toLocaleString()} candidates · ${formatLabel}.`,
        senderId: userId,
        senderName,
        priority: 'high',
        linkUrl: linkPath,
        relatedEmail: sender.email || '',
        candidatePosition: `${reportLabel} · ${dateLabel} · ${formatLabel}`,
      }, { skipPrefs: false });
      notified = Array.isArray(created) ? created.length : 0;
    }

    for (const recipient of recipients) {
      try {
        await sendEmail(recipient.email, subject, html, textBody, {
          userId,
          organizationId: orgId,
          senderName,
          system: true,
        });
        emailed += 1;
      } catch (mailErr) {
        emailErrors.push({ email: recipient.email, error: mailErr.message || 'send failed' });
      }
    }

    if (emailed === 0 && notified === 0) {
      return res.status(502).json({
        success: false,
        message: emailErrors[0]?.error?.includes('EMAIL_NOT_CONFIGURED')
          ? 'Email is not configured. Set up Email Settings, then try again.'
          : 'Could not deliver the report. Check email settings and try again.',
      });
    }

    const parts = [];
    if (emailed) parts.push(`emailed ${emailed}`);
    if (notified) parts.push(`notified ${notified} in-app`);
    res.json({
      success: true,
      emailed,
      notified,
      skipped: emailErrors.length,
      message: `Report shared (${parts.join(', ') || 'done'})`,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status < 500) return res.status(status).json({ success: false, message: err.message });
    console.error('Share report error:', err);
    res.status(500).json({ success: false, message: 'Failed to share report' });
  }
};

/**
 * Download a shared report exactly as the sender previewed/exported it
 * (same desk scope + period), not the recipient's own desk.
 */
exports.downloadSharedReport = async (req, res) => {
  try {
    const notificationId = req.body?.notificationId || req.params?.id;
    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ success: false, message: 'Notification id is required' });
    }

    const Notification = mongoose.model('Notification');
    const notif = await Notification.findOne({
      _id: notificationId,
      userId: req.user.id,
      type: 'report_shared',
      isDismissed: { $ne: true },
    }).lean();

    if (!notif) {
      return res.status(404).json({ success: false, message: 'Shared report not found' });
    }
    if (!notif.senderId) {
      return res.status(400).json({ success: false, message: 'Shared report is missing sender details' });
    }

    const sender = await User.findById(notif.senderId)
      .select('_id name email role organizationId isActive')
      .lean();
    if (!sender || sender.isActive === false) {
      return res.status(404).json({ success: false, message: 'Report owner is no longer available' });
    }
    if (
      req.user.organizationId
      && sender.organizationId
      && String(sender.organizationId) !== String(req.user.organizationId)
    ) {
      return res.status(403).json({ success: false, message: 'Not allowed to download this report' });
    }

    let period = 'month';
    let from = '';
    let to = '';
    let reportType = 'recruitment-summary';
    let format = 'pdf';
    let employee = '';
    try {
      const u = new URL(String(notif.linkUrl || '/analytics?tab=export'), 'https://app.local');
      period = u.searchParams.get('period') || 'month';
      from = u.searchParams.get('from') || '';
      to = u.searchParams.get('to') || '';
      reportType = u.searchParams.get('report') || 'recruitment-summary';
      format = u.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'pdf';
      employee = u.searchParams.get('employee') || '';
    } catch {
      /* defaults above */
    }

    const originalUser = req.user;
    const originalBody = req.body;
    req.user = {
      id: String(sender._id),
      _id: sender._id,
      organizationId: sender.organizationId,
      role: sender.role,
      email: sender.email,
      name: sender.name,
    };
    req.body = {
      reportType,
      format,
      dateRange: period,
      customFrom: from || undefined,
      customTo: to || undefined,
      userId: employee || undefined,
    };

    try {
      await exports.exportReport(req, res);
    } finally {
      req.user = originalUser;
      req.body = originalBody;
    }
  } catch (err) {
    if (res.headersSent) return;
    const status = err.statusCode || 500;
    if (status < 500) return res.status(status).json({ success: false, message: err.message });
    console.error('Download shared report error:', err);
    res.status(500).json({ success: false, message: 'Failed to download shared report' });
  }
};
