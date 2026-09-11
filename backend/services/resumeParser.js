// Enterprise-grade Resume Parser Service with Advanced AI-like Extraction
// Multi-Strategy Pipeline: text extract → pdfjs-dist → OCR (tesseract.js)
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

// Strategy 2: pdfjs-dist for robust text extraction
let pdfjsLib;
try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
  logger.info('✅ pdfjs-dist loaded for advanced PDF text extraction');
} catch (e) {
  pdfjsLib = null;
  logger.warn('⚠️ pdfjs-dist not available:', e.message);
}

// Strategy 3: tesseract.js OCR for image-based documents
let Tesseract;
try {
  Tesseract = require('tesseract.js');
  logger.info('✅ tesseract.js loaded for OCR capability');
} catch (e) {
  Tesseract = null;
  logger.warn('⚠️ tesseract.js not available:', e.message);
}

// Optional: textract for DOCX/DOC/RTF
let textract;
let extractText;
try {
  textract = require('textract');
  const { promisify } = require('util');
  extractText = promisify(textract.fromBufferWithMime);
} catch (e) {
  logger.warn('⚠️ textract not available:', e.message);
  textract = null;
  extractText = null;
}

// ─── Enterprise PDF Text Extraction via pdfjs-dist ───
async function extractTextWithPdfJs(buffer) {
  if (!pdfjsLib) return '';
  try {
    const uint8 = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText.trim();
  } catch (err) {
    logger.warn('⚠️ pdfjs-dist extraction failed:', err.message);
    return '';
  }
}

// ─── PDF to Image rendering via @napi-rs/canvas + pdfjs-dist ───
let napiCanvas;
try {
  napiCanvas = require('@napi-rs/canvas');
  logger.info('✅ @napi-rs/canvas loaded for PDF page rendering');
} catch (e) {
  napiCanvas = null;
  logger.warn('⚠️ @napi-rs/canvas not available:', e.message);
}

// Custom CanvasFactory for pdfjs-dist rendering with @napi-rs/canvas
class NodeCanvasFactory {
  create(width, height) {
    const canvas = napiCanvas.createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/** Resolve a pdf.js page image object by name. */
function getPageImageObject(page, name) {
  return new Promise((resolve) => {
    try {
      page.objs.get(name, (img) => resolve(img || null));
    } catch {
      resolve(null);
    }
  });
}

/** Convert pdf.js image data (RGB/RGBA/Gray) into a PNG buffer via napi canvas. */
function pdfImageToPngBuffer(img) {
  if (!napiCanvas || !img?.data || !img.width || !img.height) return null;
  const w = img.width;
  const h = img.height;
  const src = img.data;
  const canvas = napiCanvas.createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  const rgba = imageData.data;
  const expectRGB = w * h * 3;
  const expectRGBA = w * h * 4;
  const expectGray = w * h;

  if (src.length === expectRGBA || img.kind === 3) {
    rgba.set(src.length === expectRGBA ? src : src.subarray(0, expectRGBA));
  } else if (src.length === expectRGB || img.kind === 2) {
    for (let i = 0, j = 0; i < expectRGB; i += 3, j += 4) {
      rgba[j] = src[i];
      rgba[j + 1] = src[i + 1];
      rgba[j + 2] = src[i + 2];
      rgba[j + 3] = 255;
    }
  } else if (src.length === expectGray || img.kind === 1) {
    for (let i = 0, j = 0; i < expectGray; i += 1, j += 4) {
      const v = src[i];
      rgba[j] = v;
      rgba[j + 1] = v;
      rgba[j + 2] = v;
      rgba[j + 3] = 255;
    }
  } else {
    logger.warn(`⚠️ Unsupported PDF image layout: kind=${img.kind} len=${src.length} ${w}x${h}`);
    return null;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

/**
 * Upscale + optional binarize — enterprise OCR accuracy depends on this more
 * than on Tesseract settings. Scanned resumes often need 2x+ and thresholding
 * so emails/names aren't mangled into garbage like "@Emateany".
 */
async function preprocessPngForOcr(pngBuffer, opts = {}) {
  if (!napiCanvas || !pngBuffer) return pngBuffer;
  const scale = opts.scale ?? 2;
  const threshold = opts.threshold; // undefined = no binarize
  try {
    const img = await napiCanvas.loadImage(pngBuffer);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = napiCanvas.createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    if (Number.isFinite(threshold)) {
      const out = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < out.data.length; i += 4) {
        const g = 0.299 * out.data[i] + 0.587 * out.data[i + 1] + 0.114 * out.data[i + 2];
        const v = g < threshold ? 0 : 255;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
        out.data[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    }
    return canvas.toBuffer('image/png');
  } catch (err) {
    logger.warn('⚠️ OCR preprocess failed:', err.message);
    return pngBuffer;
  }
}

/** Crop a relative region of a PNG (x/y/w/h as 0–1 fractions), then preprocess. */
async function cropPngRegionForOcr(pngBuffer, crop, opts = {}) {
  if (!napiCanvas || !pngBuffer) return null;
  try {
    const img = await napiCanvas.loadImage(pngBuffer);
    const sx = Math.max(0, Math.floor(crop.x * img.width));
    const sy = Math.max(0, Math.floor(crop.y * img.height));
    const sw = Math.max(1, Math.min(img.width - sx, Math.floor(crop.w * img.width)));
    const sh = Math.max(1, Math.min(img.height - sy, Math.floor(crop.h * img.height)));
    const scale = opts.scale ?? 2.5;
    const cw = Math.round(sw * scale);
    const ch = Math.round(sh * scale);
    const canvas = napiCanvas.createCanvas(cw, ch);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    const threshold = opts.threshold ?? 150;
    if (Number.isFinite(threshold)) {
      const out = ctx.getImageData(0, 0, cw, ch);
      for (let i = 0; i < out.data.length; i += 4) {
        const g = 0.299 * out.data[i] + 0.587 * out.data[i + 1] + 0.114 * out.data[i + 2];
        const v = g < threshold ? 0 : 255;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
        out.data[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    }
    return canvas.toBuffer('image/png');
  } catch (err) {
    logger.warn('⚠️ OCR crop failed:', err.message);
    return null;
  }
}

/**
 * Best path for scanned resumes: extract embedded page images (JPEG/DCT)
 * because pdf.js page.render often paints a blank canvas under @napi-rs/canvas.
 */
async function extractPdfPageImages(pdfDoc, pageNum) {
  if (!pdfjsLib || !napiCanvas) return [];
  try {
    const page = await pdfDoc.getPage(pageNum);
    const ops = await page.getOperatorList();
    const OPS = pdfjsLib.OPS || {};
    const paintOps = new Set([
      OPS.paintImageXObject,
      OPS.paintInlineImageXObject,
      OPS.paintImageMaskXObject,
      OPS.paintJpegXObject,
    ].filter(Boolean));

    const pngs = [];
    const seen = new Set();
    for (let i = 0; i < ops.fnArray.length; i += 1) {
      if (!paintOps.has(ops.fnArray[i])) continue;
      const args = ops.argsArray[i] || [];
      const name = args[0];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const img = await getPageImageObject(page, name);
      const png = pdfImageToPngBuffer(img);
      if (png && png.length > 2000) {
        pngs.push(png);
        logger.info(`   📸 Page ${pageNum} embedded image “${name}”: ${png.length} bytes PNG (${img.width}x${img.height})`);
      }
    }
    return pngs;
  } catch (err) {
    logger.warn(`⚠️ Failed extracting images from PDF page ${pageNum}:`, err.message);
    return [];
  }
}

async function renderPdfPageToImage(pdfDoc, pageNum, scale = 2.0) {
  if (!napiCanvas) return null;
  try {
    // Prefer embedded scan images — reliable OCR source for image-only PDFs
    const embedded = await extractPdfPageImages(pdfDoc, pageNum);
    if (embedded.length) {
      // Largest image is usually the full-page scan
      return embedded.sort((a, b) => b.length - a.length)[0];
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = napiCanvas.createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvasFactory: new NodeCanvasFactory(),
      intent: 'display',
    }).promise;

    const pngBuffer = canvas.toBuffer('image/png');
    logger.info(`   📸 Page ${pageNum} canvas render: ${pngBuffer.length} bytes PNG (${Math.round(viewport.width)}x${Math.round(viewport.height)})`);
    return pngBuffer;
  } catch (err) {
    logger.warn(`⚠️ Failed to render PDF page ${pageNum}:`, err.message);
    return null;
  }
}

function ocrEnabled() {
  // Default ON — enterprise parsing must handle scanned resumes in production too.
  // Set RESUME_OCR_ENABLED=false to disable (e.g. very constrained hosts).
  const flag = String(process.env.RESUME_OCR_ENABLED || 'true').toLowerCase();
  return flag !== '0' && flag !== 'false' && flag !== 'off' && flag !== 'no';
}

function ocrMaxPages() {
  const n = parseInt(process.env.RESUME_OCR_MAX_PAGES || '2', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5) : 2;
}

function ocrTimeoutMs() {
  const n = parseInt(process.env.RESUME_OCR_TIMEOUT_MS || '90000', 10);
  return Number.isFinite(n) && n >= 15000 ? n : 90000;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── Enterprise OCR Pipeline via tesseract.js ───
async function ocrPdfBuffer(buffer) {
  if (!Tesseract) {
    logger.warn('⚠️ OCR not available (tesseract.js not installed)');
    return '';
  }
  if (!ocrEnabled()) {
    logger.warn('⚠️ OCR disabled via RESUME_OCR_ENABLED');
    return '';
  }
  try {
    const header = buffer.slice(0, 5).toString('ascii');

    // For PDF files: render pages to images first, then OCR each image
    if (header.startsWith('%PDF')) {
      if (!pdfjsLib || !napiCanvas) {
        logger.warn('⚠️ Cannot OCR scanned PDF: requires pdfjs-dist + @napi-rs/canvas');
        return '';
      }

      logger.info('🔍 Rendering PDF pages to images for OCR...');
      const uint8 = new Uint8Array(buffer);
      const pdfDoc = await pdfjsLib.getDocument({
        data: uint8,
        canvasFactory: napiCanvas ? new NodeCanvasFactory() : undefined
      }).promise;
      const numPages = Math.min(pdfDoc.numPages, ocrMaxPages());
      let allText = '';

      const worker = await Tesseract.createWorker('eng', 1, {
        errorHandler: (err) => {
          logger.warn('⚠️ Tesseract worker error (handled):', err?.message || err);
        }
      });

      try {
        // Sparse-text / column layouts (Indian resume sidebars) OCR better with PSM 4/6
        await worker.setParameters({ tessedit_pageseg_mode: '6' }).catch(() => {});

        for (let i = 1; i <= numPages; i++) {
          logger.info(`📄 OCR page ${i}/${numPages}...`);
          const imgBuffer = await renderPdfPageToImage(pdfDoc, i, 1.5);
          if (!imgBuffer) continue;

          // Full-page pass: upscale + binarize (raw scans often lose email/@ otherwise)
          const fullPre = await preprocessPngForOcr(imgBuffer, { scale: 2, threshold: 155 });
          const { data: fullData } = await worker.recognize(fullPre);
          let pageText = fullData.text || '';

          // Page 1 contact/name regions — enterprise pattern: zoom the sidebar + header
          if (i === 1) {
            const regions = [
              { label: 'header', crop: { x: 0, y: 0, w: 1, h: 0.14 }, scale: 2.5, threshold: 160, psm: '6' },
              // Left personal-details column (phone / email)
              { label: 'left-contact', crop: { x: 0, y: 0.18, w: 0.45, h: 0.42 }, scale: 2.5, threshold: 150, psm: '4' },
              // Right top (alternate layout)
              { label: 'right-contact', crop: { x: 0.55, y: 0.05, w: 0.45, h: 0.35 }, scale: 2.5, threshold: 150, psm: '6' },
            ];
            let regionText = '';
            for (const region of regions) {
              const cropped = await cropPngRegionForOcr(imgBuffer, region.crop, {
                scale: region.scale,
                threshold: region.threshold,
              });
              if (!cropped) continue;
              try {
                await worker.setParameters({ tessedit_pageseg_mode: region.psm }).catch(() => {});
                const { data: rData } = await worker.recognize(cropped);
                const t = (rData.text || '').trim();
                if (t.length >= 3) {
                  regionText += `\n${t}\n`;
                  logger.info(`   → Region ${region.label}: ${t.length} chars`);
                }
              } catch (regErr) {
                logger.warn(`   ⚠️ Region ${region.label} OCR failed:`, regErr.message);
              }
            }
            await worker.setParameters({ tessedit_pageseg_mode: '6' }).catch(() => {});
            // Put high-zoom contact text FIRST so email/name regex hit the clean copy
            pageText = `${regionText}\n${pageText}`;
          }

          allText += `${pageText}\n`;
          logger.info(`   → Page ${i}: ${pageText.length} chars (incl. regions)`);

          const hasRealEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(pageText);
          const hasPhone = /(?<!\d)[6-9]\d{9}(?!\d)/.test(pageText) || /\+91/.test(pageText);
          if (i === 1 && hasRealEmail && hasPhone && numPages > 1) {
            logger.info('   → Page 1 has email + phone; skipping remaining pages for speed');
            break;
          }
        }
      } finally {
        await worker.terminate().catch(() => {});
      }

      logger.info(`✅ OCR complete: extracted ${allText.length} characters from up to ${numPages} pages`);
      return allText.trim();
    }

    // For image buffers, run OCR directly
    logger.info('🔍 Starting OCR on image buffer...');
    const worker = await Tesseract.createWorker('eng', 1, {
      errorHandler: (err) => {
        logger.warn('⚠️ Tesseract worker error (handled):', err?.message || err);
      }
    });
    try {
      const pre = await preprocessPngForOcr(buffer, { scale: 2, threshold: 155 });
      const { data } = await worker.recognize(pre);
      logger.info(`✅ OCR complete: extracted ${(data.text || '').length} characters`);
      return data.text || '';
    } finally {
      await worker.terminate().catch(() => {});
    }
  } catch (err) {
    logger.warn('⚠️ OCR failed:', err.message);
    return '';
  }
}

// ─── Enterprise OCR for image files ───
async function ocrImageBuffer(buffer) {
  if (!Tesseract || !ocrEnabled()) return '';
  try {
    logger.info('🔍 Running OCR on image...');
    const worker = await Tesseract.createWorker('eng');
    try {
      const { data } = await worker.recognize(buffer);
      logger.info(`✅ Image OCR complete: ${(data.text || '').length} characters`);
      return data.text || '';
    } finally {
      await worker.terminate().catch(() => {});
    }
  } catch (err) {
    logger.warn('⚠️ Image OCR failed:', err.message);
    return '';
  }
}

// Enterprise-grade keyword databases
const JOB_TITLES = [
  // Technical Roles
  'software engineer', 'software developer', 'full stack developer', 'frontend developer', 'backend developer',
  'senior software engineer', 'lead developer', 'principal engineer', 'architect', 'tech lead',
  'devops engineer', 'site reliability engineer', 'system administrator', 'database administrator',
  'data scientist', 'data analyst', 'machine learning engineer', 'ai engineer', 'data engineer',
  'qa engineer', 'test engineer', 'automation engineer', 'security engineer', 'cloud engineer',
  'mobile developer', 'ios developer', 'android developer', 'react native developer',

  // Management Roles
  'project manager', 'product manager', 'program manager', 'engineering manager', 'technical manager',
  'team lead', 'scrum master', 'agile coach', 'delivery manager', 'it manager',

  // Business Roles
  'business analyst', 'system analyst', 'requirements analyst', 'functional analyst',
  'consultant', 'senior consultant', 'solution architect', 'enterprise architect',

  // Banking & Finance Roles
  'branch manager', 'assistant branch manager', 'relationship manager', 'credit analyst',
  'loan officer', 'investment banker', 'financial analyst', 'risk analyst', 'compliance officer',
  'assistant vice president', 'vice president', 'branch head', 'branch operations manager',
  'operations manager', 'area manager', 'regional manager', 'cluster manager',
  'portfolio manager', 'wealth manager', 'insurance advisor', 'underwriter',
  'audit manager', 'accounts manager', 'finance manager', 'treasury manager',

  // HR & Admin Roles
  'hr manager', 'hr executive', 'recruiter', 'talent acquisition', 'hr coordinator',
  'admin executive', 'office manager', 'executive assistant', 'receptionist',

  // Sales & Marketing Roles
  'sales manager', 'sales executive', 'marketing manager', 'marketing executive',
  'business development manager', 'business development executive', 'account manager',
  'key account manager', 'territory manager',

  // Support Roles
  'technical support', 'customer support', 'help desk', 'system support', 'application support'
];

const COMPANY_KEYWORDS = [
  'ltd', 'limited', 'inc', 'incorporated', 'corp', 'corporation', 'llc', 'llp',
  'pvt', 'private', 'technologies', 'solutions', 'systems', 'software', 'services',
  'consulting', 'labs', 'studios', 'group', 'holdings', 'enterprises', 'ventures',
  'bank', 'finance', 'capital', 'insurance', 'associates', 'partners', 'agency',
  'industries', 'international', 'global', 'infosys', 'wipro', 'tcs', 'hcl',
  'infotech', 'techno', 'infocom', 'infra', 'foundation', 'trust', 'company'
];

const LOCATION_KEYWORDS = {
  cities: [
    'mumbai', 'delhi', 'bangalore', 'chennai', 'hyderabad', 'pune', 'kolkata', 'ahmedabad',
    'jaipur', 'surat', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal',
    'visakhapatnam', 'pimpri-chinchwad', 'patna', 'vadodara', 'ghaziabad', 'ludhiana',
    'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan-dombivli', 'vasai-virar',
    'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi mumbai', 'allahabad',
    'ranchi', 'howrah', 'coimbatore', 'jabalpur', 'gwalior', 'vijayawada', 'jodhpur',
    'madurai', 'raipur', 'kota', 'guwahati', 'solapur', 'hubli-dharwad', 'bareilly',
    'moradabad', 'mysore', 'tiruchirappalli', 'tiruppur', 'salem', 'thiruvananthapuram',
    'bhiwandi', 'saharanpur', 'gorakhpur', 'guna', 'bikaner', 'amravati', 'noida',
    'jamshedpur', 'bhilai', 'cuttack', 'firozabad', 'kochi', 'nellore', 'bhavnagar',
    'dehradun', 'durgapur', 'asansol', 'rourkela', 'nanded', 'kolhapur', 'ajmer',
    'akola', 'gulbarga', 'jamnagar', 'ujjain', 'loni', 'siliguri', 'jhansi', 'ulhasnagar',
    'jammu', 'sangli-miraj', 'mangalore', 'ebbw vale', 'belgaum', 'ambattur', 'tirunelveli',
    'malegaon', 'gaya', 'jalgaon', 'udaipur', 'maheshtala', 'tirupati', 'davanagere',
    'kozhikode', 'akola', 'kurnool', 'rajpur sonarpur', 'bokaro', 'south dum dum',
    'bellary', 'patiala', 'gopalpur', 'agra', 'dhule', 'bhagalpur', 'muzaffarpur',
    'bhatpara', 'panihati', 'latur', 'dhule', 'rohtak', 'korba', 'bhilwara', 'berhampur',
    'muzaffarnagar', 'ahmednagar', 'mathura', 'kollam', 'avadi', 'kadapa', 'kamarhati',
    'sambalpur', 'bilaspur', 'shahjahanpur', 'satara', 'bijapur', 'rampur', 'shoranur',
    'aligarh', 'nadiad', 'secunderabad', 'puri', 'hosur', 'pondicherry', 'karur', 'erode', 'vellore'
  ],
  states: [
    'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa',
    'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala',
    'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
    'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura',
    'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'jammu and kashmir',
    'ladakh', 'puducherry', 'chandigarh', 'dadra and nagar haveli', 'daman and diu',
    'lakshadweep', 'andaman and nicobar islands'
  ]
};

const SKILL_KEYWORDS = [
  // Programming Languages
  'javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift',
  'kotlin', 'scala', 'r', 'matlab', 'perl', 'bash', 'powershell',

  // Web Technologies
  'html', 'css', 'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask',
  'spring', 'asp.net', 'jquery', 'bootstrap', 'sass', 'less', 'webpack', 'babel',

  // Databases
  'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sql server',
  'sqlite', 'cassandra', 'dynamodb', 'firebase',

  // Cloud Platforms
  'aws', 'azure', 'gcp', 'heroku', 'digitalocean', 'linode', 'docker', 'kubernetes',
  'terraform', 'ansible', 'jenkins', 'gitlab ci', 'github actions',

  // Tools & Frameworks
  'git', 'svn', 'jira', 'confluence', 'slack', 'postman', 'swagger', 'figma', 'sketch',
  'adobe xd', 'photoshop', 'illustrator', 'premiere', 'after effects',

  // Banking & Finance Skills
  'risk management', 'credit analysis', 'loan processing', 'compliance', 'aml',
  'kyc', 'financial analysis', 'portfolio management', 'wealth management',
  'banking operations', 'treasury', 'forex', 'mutual funds', 'insurance',
  'underwriting', 'audit', 'accounting', 'tally', 'sap', 'erp',
  'ms excel', 'excel', 'powerpoint', 'word', 'ms office',
  'communication', 'leadership', 'team management', 'customer service',
  'negotiation', 'presentation', 'problem solving', 'analytical skills'
];

// Advanced regex patterns with confidence scoring
const PATTERNS = {
  email: [
    { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, confidence: 95 },
    { regex: /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/g, confidence: 85 }
  ],
  phone: [
    { regex: /(\+91[-.\s]?)?[6-9]\d{9}/g, confidence: 95 },
    { regex: /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, confidence: 90 },
    { regex: /(\+\d{1,3}[-.\s]?)?\d{10,13}/g, confidence: 80 },
    { regex: /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g, confidence: 85 }
  ],
  experience: [
    { regex: /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i, confidence: 95 },
    { regex: /(?:experience|exp)\s*(?:of\s*|:\s*)?(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i, confidence: 90 },
    { regex: /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:work|professional|industry|IT|total)/i, confidence: 85 },
    { regex: /(?:total|overall)\s*(?:experience|exp)\s*(?:of\s*|:\s*)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i, confidence: 92 }
  ]
};

// ─── Smart Text Segmenter ───
// PDF text often comes as one big blob. This function intelligently splits
// it into logical segments using section headers and formatting cues.
function smartSegment(text) {
  // Common resume section headers
  const sectionHeaders = [
    'ABOUT ME', 'ABOUT', 'SUMMARY', 'OBJECTIVE', 'PROFILE', 'PROFESSIONAL SUMMARY',
    'EDUCATION', 'ACADEMIC', 'QUALIFICATION', 'QUALIFICATIONS',
    'SKILLS', 'TECHNICAL SKILLS', 'KEY SKILLS', 'CORE COMPETENCIES', 'COMPETENCIES',
    'EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT',
    'PROJECTS', 'PROJECT DETAILS', 'KEY PROJECTS',
    'CERTIFICATION', 'CERTIFICATIONS', 'CERTIFICATES',
    'CONTACT', 'CONTACT DETAILS', 'CONTACT INFORMATION', 'PERSONAL DETAILS',
    'ACHIEVEMENTS', 'AWARDS', 'HOBBIES', 'INTERESTS', 'LANGUAGES',
    'DECLARATION', 'REFERENCES'
  ];

  // Build regex to split on section headers
  const headerPattern = new RegExp(
    '(?=\\b(' + sectionHeaders.map(h => h.replace(/\s+/g, '\\s+')).join('|') + ')\\b)',
    'gi'
  );

  // Split text into sections
  const sections = {};
  const parts = text.split(headerPattern).filter(p => p && p.trim().length > 0);

  let currentSection = 'HEADER'; // Everything before first section header
  sections['HEADER'] = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const upperPart = part.toUpperCase().trim();

    // Check if this part is a section header
    const isHeader = sectionHeaders.some(h =>
      upperPart === h || upperPart.replace(/\s+/g, ' ') === h
    );

    if (isHeader) {
      currentSection = upperPart.replace(/\s+/g, ' ');
      if (!sections[currentSection]) sections[currentSection] = '';
    } else {
      sections[currentSection] = ((sections[currentSection] || '') + ' ' + part).trim();
    }
  }

  return sections;
}

// ─── OCR Text Cleanup ───
// OCR often produces concatenated words like "SUBODHJHA" or "DateOfBirth".
// This function tries to add spaces at camelCase/PascalCase boundaries.
function cleanOcrText(text) {
  let cleaned = text;
  // Split camelCase/PascalCase: "DateOfBirth" → "Date Of Birth"
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Split when lowercase is followed by uppercase run: "fromBASTAR" → "from BASTAR"
  cleaned = cleaned.replace(/([a-z])([A-Z]{2,})/g, '$1 $2');
  // Split when uppercase run is followed by uppercase+lowercase: "SUBODHJha" → "SUBODH Jha"
  cleaned = cleaned.replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
  // Split concatenated all-caps words using known keywords as boundary hints
  const KNOWN_WORDS = ['UNIVERSITY', 'COLLEGE', 'INSTITUTE', 'SCHOOL', 'EDUCATION', 'EXPERIENCE',
    'SKILLS', 'CONTACT', 'SUMMARY', 'OBJECTIVE', 'CERTIFICATION', 'ACHIEVEMENT',
    'DEPARTMENT', 'MANAGEMENT', 'DEVELOPMENT', 'ENGINEERING', 'TECHNOLOGY',
    'BACHELOR', 'MASTER', 'DIPLOMA', 'DEGREE', 'COMMERCE', 'SCIENCE', 'ARTS',
    'PERSONAL', 'DETAILS', 'ADDRESS', 'PHONE', 'EMAIL', 'GENDER', 'CAREER'];
  for (const word of KNOWN_WORDS) {
    // Add space before known word if preceded by other letters without space
    const regex = new RegExp(`([A-Za-z])${word}`, 'g');
    cleaned = cleaned.replace(regex, `$1 ${word}`);
    // Add space after known word if followed by other letters  
    const regex2 = new RegExp(`${word}([A-Za-z])`, 'g');
    cleaned = cleaned.replace(regex2, `${word} $1`);
  }
  // Repair spaced OCR emails: "name @ gmail . com" → "name@gmail.com"
  cleaned = cleaned.replace(
    /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/g,
    '$1@$2.$3'
  );
  // Fix common OCR artifacts: multiple spaces, stray punctuation
  cleaned = cleaned.replace(/\s{3,}/g, '  ');
  return cleaned;
}

/** Title-case a name token; keep single-letter initials as "P". */
function titleCaseNamePart(w) {
  if (!w) return '';
  if (w.length === 1) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * OCR often glues an initial onto the surname: "KARTHIKP" → "Karthik P".
 * Also strips short garbage prefixes ("Ca", "f", "Po") from header OCR noise.
 */
function normalizeOcrNameCandidate(raw, emailLocal = '') {
  if (!raw) return '';
  let s = String(raw).replace(/[^A-Za-z.\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';

  // Drop tiny OCR junk tokens at the start
  let parts = s.split(/\s+/).filter(Boolean);
  while (parts.length && (parts[0].length <= 2 && !/^[A-Z]\.?$/i.test(parts[0]))) {
    parts.shift();
  }
  if (!parts.length) return '';

  // Split glued ALLCAPS + trailing initial: KARTHIKP / RAJKUMARS
  parts = parts.flatMap((p) => {
    if (/^[A-Z]{5,}[A-Z]$/.test(p)) {
      return [p.slice(0, -1), p.slice(-1)];
    }
    // Also: KarthikP
    if (/^[A-Z][a-z]{3,}[A-Z]$/.test(p)) {
      return [p.slice(0, -1), p.slice(-1)];
    }
    return [p];
  });

  // If still one long ALLCAPS token and email has a matching first name, split using email
  if (parts.length === 1 && emailLocal) {
    const word = parts[0];
    const emailBits = emailLocal.replace(/[0-9_]+/g, '').toLowerCase().split(/[.\-_]+/).filter((b) => b.length >= 3);
    const lower = word.toLowerCase();
    for (const bit of emailBits) {
      const idx = lower.indexOf(bit);
      if (idx === 0 && bit.length >= 4 && word.length > bit.length + 0) {
        const rest = word.slice(bit.length);
        if (rest.length === 1 || (rest.length >= 2 && rest.length <= 12)) {
          parts = rest.length === 1 ? [bit, rest] : [bit, rest];
          break;
        }
      }
      // bit appears as whole word match inside: karthik in KARTHIKP
      if (lower.startsWith(bit) && word.length === bit.length + 1) {
        parts = [bit, word.slice(-1)];
        break;
      }
    }
  }

  let cleaned = parts
    .filter((p) => /^[A-Za-z][A-Za-z.'-]*$/.test(p) && (p.length >= 2 || /^[A-Za-z]\.?$/.test(p)))
    .slice(0, 4)
    .map(titleCaseNamePart);

  // Drop leading OCR junk initial when the next token is the real given name
  // e.g. "A Karthik P" (from "A KARTHIKP") → "Karthik P"
  if (cleaned.length >= 2 && cleaned[0].length === 1 && cleaned[1].length >= 4) {
    const emailBits = String(emailLocal || '')
      .replace(/[0-9_]+/g, '')
      .toLowerCase()
      .split(/[.\-_]+/)
      .filter((b) => b.length >= 3);
    const second = cleaned[1].toLowerCase();
    const secondMatchesEmail = emailBits.some((b) => b.includes(second) || second.includes(b));
    if (secondMatchesEmail || cleaned.length >= 3) {
      cleaned = cleaned.slice(1);
    }
  }

  if (cleaned.length === 0) return '';
  return cleaned.join(' ');
}

// ─── Enterprise-Grade Field Extraction ───
function extractFields(text) {
  // Apply OCR text cleanup before processing
  text = cleanOcrText(text);
  const rawText = text;
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into real lines (preserve original line breaks from PDF)
  const rawLines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Also create a single-line version for regex matching
  const flatText = cleanText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // Smart section segmentation
  const sections = smartSegment(flatText);

  logger.info('📋 Detected sections:', Object.keys(sections).filter(k => sections[k].length > 0));

  const result = {
    name: { value: '', confidence: 0 },
    email: { value: '', confidence: 0 },
    contact: { value: '', confidence: 0 },
    position: { value: '', confidence: 0 },
    company: { value: '', confidence: 0 },
    experience: { value: '', confidence: 0 },
    location: { value: '', confidence: 0 },
    skills: { value: '', confidence: 0 },
    education: { value: '', confidence: 0 }
  };

  // ════════════════════════════════════════
  // 1. EMAIL EXTRACTION (highest accuracy)
  // ════════════════════════════════════════
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let emailMatches = flatText.match(emailRegex) || [];

  // Label-aware: "Email" / "E-mail" line often has the address on the next line (OCR layouts)
  if (!emailMatches.length) {
    for (let i = 0; i < rawLines.length; i++) {
      if (/^e-?mails?\b/i.test(rawLines[i]) || /\be-?mail\s*[:\-]/i.test(rawLines[i])) {
        const same = rawLines[i].match(emailRegex);
        const next = rawLines[i + 1] ? rawLines[i + 1].match(emailRegex) : null;
        if (same?.length) emailMatches = same;
        else if (next?.length) emailMatches = next;
        if (emailMatches.length) break;
      }
    }
  }

  if (emailMatches.length > 0) {
    // Pick the most likely personal email (not info@, hr@, etc.)
    const personalEmail = emailMatches.find(e => !/^(info|hr|admin|support|contact|careers|jobs|noreply)@/i.test(e)) || emailMatches[0];
    result.email = { value: personalEmail.toLowerCase(), confidence: 100 };
  }

  // ════════════════════════════════════════
  // 2. PHONE/CONTACT EXTRACTION
  // ════════════════════════════════════════
  // First try to find full number with country code from the text
  const fullPhonePatterns = [
    /\+91[-. ]?[6-9]\d{4}[-. ]?\d{5}/g,
    /\+91[-. ]?[6-9]\d{9}/g,
    /\+\d{1,3}[-. ]?\d{4,5}[-. ]?\d{4,6}/g
  ];
  const barePhonePatterns = [
    /(?<!\d)[6-9]\d{9}(?!\d)/g,
    /\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g
  ];

  // Priority: numbers with country code
  for (const pattern of fullPhonePatterns) {
    const matches = flatText.match(pattern);
    if (matches) {
      result.contact = { value: matches[0].trim(), confidence: 100 };
      break;
    }
  }

  // Fallback: bare 10-digit numbers (add +91 if Indian context)
  if (result.contact.confidence < 80) {
    for (const pattern of barePhonePatterns) {
      const matches = flatText.match(pattern);
      if (matches) {
        const phone = matches[0].trim();
        // Check if +91 appears anywhere in the text (Indian resume context)
        const hasIndianPrefix = /\+91/i.test(flatText);
        result.contact = {
          value: hasIndianPrefix ? '+91-' + phone : phone,
          confidence: 90
        };
        break;
      }
    }
  }

  // ════════════════════════════════════════
  // 3. NAME EXTRACTION (multi-strategy)
  // ════════════════════════════════════════
  const emailLocal = result.email.value ? result.email.value.split('@')[0] : '';

  // Strategy A: First line(s) of resume are usually the name
  // Look in the HEADER section or the first few raw lines
  const headerText = sections['HEADER'] || '';

  // Job-title stop words — if we hit one of these, the name has ended
  const TITLE_STOP_WORDS = new Set([
    'full', 'stack', 'software', 'senior', 'junior', 'lead', 'principal', 'chief',
    'developer', 'engineer', 'manager', 'analyst', 'designer', 'architect', 'consultant',
    'marketer', 'specialist', 'coordinator', 'executive', 'officer', 'director',
    'devops', 'frontend', 'backend', 'mobile', 'web', 'data', 'cloud', 'qa', 'test',
    'digital', 'marketing', 'product', 'project', 'program', 'business', 'system',
    'ui', 'ux', 'intern', 'trainee', 'associate', 'assistant', 'head', 'vp',
    'about', 'summary', 'objective', 'profile', 'education', 'skills', 'experience',
    'contact', 'certification', 'resume', 'curriculum', 'vitae', 'declaration'
  ]);

  // Non-name words — words that are never part of a person's name
  const NON_NAME_WORDS = new Set([
    'date', 'birth', 'dateofbirth', 'dob', 'gender', 'male', 'female', 'nationality',
    'address', 'phone', 'email', 'mobile', 'tel', 'fax', 'website', 'linkedin',
    'github', 'portfolio', 'objective', 'summary', 'career', 'page', 'resume', 'cv',
    'age', 'marital', 'status', 'father', 'mother', 'passport', 'visa', 'religion',
    'present', 'permanent', 'current', 'pincode', 'zip', 'country', 'state', 'city',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr',
    'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ]);

  // Helper: Check if a word could be part of a person's name
  function isNameWord(w) {
    const lower = w.toLowerCase().replace(/\.$/, '');
    if (TITLE_STOP_WORDS.has(lower)) return false;
    if (NON_NAME_WORDS.has(lower)) return false;
    if (/\d/.test(w)) return false; // Names don't contain digits
    // Allow single-letter initials ("P", "K.")
    if (/^[A-Za-z]\.?$/.test(w)) return true;
    if (w.length < 2) return false;
    if (w.length > 15) return false;
    return true;
  }

  // Strategy A0: OCR-noisy header lines — normalize "Ca KARTHIKP" → "Karthik P"
  if (result.name.confidence < 90) {
    for (let i = 0; i < Math.min(12, rawLines.length); i++) {
      const normalized = normalizeOcrNameCandidate(rawLines[i], emailLocal);
      if (!normalized) continue;
      const words = normalized.split(/\s+/);
      const valid = words.every(isNameWord);
      if (!valid) continue;
      if (words.length >= 2 && words.length <= 4 && normalized.length <= 45) {
        // Prefer candidates that overlap email local-part when available
        let conf = 88;
        if (emailLocal) {
          const emailBits = emailLocal.replace(/[0-9_]+/g, '').toLowerCase();
          const nameFlat = normalized.replace(/\s+/g, '').toLowerCase();
          if (emailBits.includes(nameFlat.slice(0, Math.min(6, nameFlat.length))) ||
              nameFlat.includes(emailBits.split(/[.\-_]/)[0] || '') ||
              emailBits.split(/[.\-_]/).some((b) => b.length >= 4 && nameFlat.includes(b))) {
            conf = 96;
          }
        }
        if (conf >= result.name.confidence) {
          result.name = { value: normalized, confidence: conf };
          if (conf >= 96) break;
        }
      }
    }
  }

  // Strategy A1: Grab consecutive capitalized words from start, stop at title/section/non-name words
  const startWords = flatText.match(/^([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)*)/);
  if (startWords && result.name.confidence < 95) {
    const allWords = startWords[1].split(/\s+/);
    const nameWords = [];
    for (const w of allWords) {
      if (!isNameWord(w)) break;
      nameWords.push(w);
    }
    if (nameWords.length >= 2 && nameWords.length <= 4) {
      const candidate = nameWords.join(' ');
      if (candidate.length >= 3 && candidate.length <= 45) {
        const titleCased = normalizeOcrNameCandidate(candidate, emailLocal) || (
          /^[A-Z\s.'-]+$/.test(candidate)
            ? candidate.split(/\s+/).map(titleCaseNamePart).join(' ')
            : candidate
        );
        result.name = { value: titleCased, confidence: 95 };
      }
    }
  }

  // Strategy A2: All-caps name at start (e.g., "RAJU KUMAR")
  if (result.name.confidence < 90) {
    const allCaps = flatText.match(/^([A-Z]{2,}(?:\s+[A-Z]{2,})*)/);
    if (allCaps) {
      const normalized = normalizeOcrNameCandidate(allCaps[1], emailLocal);
      const nameWords = (normalized || allCaps[1]).split(/\s+/).filter(isNameWord);
      if (nameWords.length >= 2 && nameWords.length <= 4) {
        result.name = { value: nameWords.map(titleCaseNamePart).join(' '), confidence: 95 };
      } else if (nameWords.length === 1 && nameWords[0].length >= 4) {
        // Single token after OCR split attempt still only one word — keep if email confirms
        const one = normalizeOcrNameCandidate(nameWords[0], emailLocal);
        if (one && one.includes(' ')) {
          result.name = { value: one, confidence: 92 };
        }
      }
    }
  }

  // Strategy A2b: Single all-caps name at start — only if email confirms it
  if (result.name.confidence < 90 && emailLocal) {
    const allCaps = flatText.match(/^([A-Z]{2,})/);
    if (allCaps) {
      const word = allCaps[1];
      if (isNameWord(word) && word.length >= 3) {
        const normalized = normalizeOcrNameCandidate(word, emailLocal);
        if (normalized && normalized.includes(' ')) {
          result.name = { value: normalized, confidence: 90 };
        } else {
          // Try to split concatenated name using email hint: "SUBODHJHA" + email "subodh36garh@"
          const emailName = emailLocal.replace(/[0-9_]+/g, '').toLowerCase();
          const lowerWord = word.toLowerCase();
          let bestSplit = null;
          for (let splitPos = 2; splitPos < lowerWord.length - 1; splitPos++) {
            const firstPart = lowerWord.substring(0, splitPos);
            if (emailName.startsWith(firstPart) && firstPart.length >= 3) {
              bestSplit = splitPos;
            }
          }
          if (bestSplit) {
            const first = word.substring(0, bestSplit);
            const last = word.substring(bestSplit);
            const titleCased = [first, last].map(titleCaseNamePart).join(' ');
            result.name = { value: titleCased, confidence: 85 };
          }
        }
      }
    }
  }

  // Strategy A3: Look in first 5 raw lines for a name-like pattern
  if (result.name.confidence < 80) {
    for (let i = 0; i < Math.min(8, rawLines.length); i++) {
      const line = rawLines[i].trim();
      const normalized = normalizeOcrNameCandidate(line, emailLocal);
      if (normalized && normalized.split(/\s+/).length >= 2) {
        result.name = { value: normalized, confidence: 90 };
        break;
      }
      // Name: 2-4 words, each starting with uppercase, no numbers, no special chars except hyphen
      if (/^[A-Z][a-zA-Z'-]+(\s+[A-Z][a-zA-Z'-]+){1,3}$/.test(line) && line.length <= 40) {
        const words = line.split(/\s+/);
        const validWords = words.filter(w => isNameWord(w));
        if (validWords.length >= 2 && validWords.length === words.length) {
          const lowerLine = line.toLowerCase();
          const isSection = ['about me', 'summary', 'education', 'skills', 'experience', 'contact'].includes(lowerLine);
          const isJobTitle = JOB_TITLES.some(t => lowerLine === t);
          if (!isSection && !isJobTitle) {
            result.name = { value: line, confidence: 90 };
            break;
          }
        }
      }
    }
  }

  // Strategy A4: Infer from email if we still don't have a name
  if (result.name.confidence < 70 && emailLocal) {
    const cleanLocal = emailLocal.replace(/[0-9_]+/g, '').replace(/[.]/g, ' ').trim();
    if (cleanLocal.length >= 3) {
      const nameParts = cleanLocal.split(/\s+/).map(titleCaseNamePart);
      if (nameParts.length >= 1 && nameParts.join(' ').length >= 3) {
        result.name = { value: nameParts.join(' '), confidence: 60 };
      }
    }
  }

  // Strategy A5: Cross-validate name with email — if name doesn't match email at all, try email-based name
  if (result.name.confidence > 0 && emailLocal) {
    const emailName = emailLocal.replace(/[0-9_@.]+/g, '').toLowerCase();
    const extractedNameLower = result.name.value.replace(/\s+/g, '').toLowerCase();
    // If extracted name doesn't overlap with email at all, email-based name might be better
    const emailBits = emailLocal.replace(/[0-9_]+/g, '').toLowerCase().split(/[.\-_]+/).filter((b) => b.length >= 3);
    const emailInName = emailBits.some((b) => extractedNameLower.includes(b)) ||
      (emailName.length >= 3 && (extractedNameLower.includes(emailName.substring(0, 3)) || emailName.includes(extractedNameLower.substring(0, 3))));
    if (!emailInName && result.name.confidence <= 85) {
      // Prefer better OCR name if we can recover from raw lines with email hint
      let recovered = '';
      for (let i = 0; i < Math.min(12, rawLines.length); i++) {
        const n = normalizeOcrNameCandidate(rawLines[i], emailLocal);
        if (n && n.split(/\s+/).length >= 2) {
          const flat = n.replace(/\s+/g, '').toLowerCase();
          if (emailBits.some((b) => flat.includes(b))) {
            recovered = n;
            break;
          }
        }
      }
      if (recovered) {
        result.name = { value: recovered, confidence: 90 };
      } else {
        const cleanLocal = emailLocal.replace(/[0-9_]+/g, '').replace(/[.]/g, ' ').trim();
        if (cleanLocal.length >= 3) {
          const nameParts = cleanLocal.split(/\s+/).map(titleCaseNamePart);
          if (nameParts.length >= 1) {
            result.name = { value: nameParts.join(' '), confidence: 70 };
          }
        }
      }
    }
  }

  // ════════════════════════════════════════
  // 4. POSITION/JOB TITLE EXTRACTION
  // ════════════════════════════════════════
  // Strategy: Find job title keywords and extract ONLY the title, not the surrounding text

  // Build search area: prefer text after the name; OCR names may be spaced differently
  // ("Karthik P" vs "KARTHIKP"), so also fall back to a wide head/body window.
  let positionSearchArea = '';
  if (result.name.value) {
    const nameLower = result.name.value.toLowerCase();
    const nameCompact = nameLower.replace(/\s+/g, '');
    let nameIdx = flatText.toLowerCase().indexOf(nameLower);
    if (nameIdx === -1 && nameCompact.length >= 4) {
      nameIdx = flatText.toLowerCase().replace(/\s+/g, '').indexOf(nameCompact);
      // Can't map compact index back easily — use full-text title scan instead
      if (nameIdx !== -1) nameIdx = -1;
    }
    if (nameIdx !== -1) {
      positionSearchArea = flatText.substring(nameIdx + result.name.value.length, nameIdx + result.name.value.length + 500).trim();
    }
  }
  // Always include a large body window — region OCR is prepended (contact-first),
  // so titles often sit past the first 300 chars on scanned resumes.
  const bodyWindow = flatText.length > 400
    ? flatText.substring(0, Math.min(flatText.length, 1800))
    : flatText;
  if (!positionSearchArea) {
    positionSearchArea = bodyWindow;
  } else {
    positionSearchArea = `${positionSearchArea} ${bodyWindow}`;
  }

  // Prefer explicit "Title | Company" lines from work experience (common on Indian resumes)
  const pipeTitle = flatText.match(
    /\b((?:Relationship|Branch Sales|Sales|Area|Regional|Cluster|Portfolio|Wealth|Operations|Project|Product|Program|Engineering|Account|Business Development)\s+Manager|[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\s+(?:Manager|Executive|Specialist|Officer|Analyst|Engineer|Developer))\s*[|–—-]\s*[A-Z][A-Za-z0-9&.\s]{2,40}/
  );
  if (pipeTitle) {
    const titleOnly = pipeTitle[1].replace(/\s+/g, ' ').trim();
    if (titleOnly.length >= 5 && titleOnly.length <= 60) {
      result.position = { value: titleOnly, confidence: 96 };
    }
  }

  // Build a sorted list (longest first to match "senior software engineer" before "software engineer")
  const sortedTitles = [...JOB_TITLES].sort((a, b) => b.length - a.length);
  const lowerSearchArea = positionSearchArea.toLowerCase();

  if (result.position.confidence < 90) {
  for (const title of sortedTitles) {
    const idx = lowerSearchArea.indexOf(title);
    if (idx !== -1) {
      // Extract ONLY the title portion with proper casing from original
      let extracted = positionSearchArea.substring(idx, idx + title.length).trim();

      // Try to expand for compound titles: "Full Stack Developer | Digital Marketer"
      const afterTitle = positionSearchArea.substring(idx + title.length, idx + title.length + 80);
      const continuation = afterTitle.match(/^\s*[|\/&]\s*([A-Za-z][A-Za-z\s]{2,30}?)(?=\s*[+\d@(]|\s{2,}|$)/i);
      if (continuation) {
        extracted = positionSearchArea.substring(idx, idx + title.length + continuation[0].length).trim();
      }

      // Clean: remove any emails, phones that may have snuck in
      extracted = extracted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '').trim();
      extracted = extracted.replace(/\+?\d{10,}/g, '').trim();
      extracted = extracted.replace(/[|,\/&\s]+$/g, '').trim(); // Trailing separators

      // Title-case if all caps or all lowercase
      if (/^[A-Z\s|\/&]+$/.test(extracted) || /^[a-z\s|\/&]+$/.test(extracted)) {
        extracted = extracted.split(/\s+/).map(w =>
          ['|', '/', '&'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
      }

      if (extracted.length >= 5 && extracted.length <= 80) {
        result.position = { value: extracted, confidence: idx < 30 ? 95 : 85 };
        break;
      }
    }
  }
  }

  // Fallback: Look for explicit "FULL STACK DEVELOPER | DIGITAL MARKETER" pattern after name
  if (result.position.confidence < 70) {
    const titleEndWords = 'DEVELOPER|ENGINEER|MANAGER|ANALYST|DESIGNER|ARCHITECT|CONSULTANT|LEAD|ADMINISTRATOR|MARKETER|SPECIALIST|COORDINATOR|EXECUTIVE|OFFICER|DIRECTOR|SCIENTIST|TESTER';
    const titleRegex = new RegExp('([A-Z][A-Za-z\\s|\\/&]+?(?:' + titleEndWords + ')(?:\\s*[|\\/&]\\s*[A-Za-z\\s]+?(?:' + titleEndWords + '))?)', 'i');
    const match = positionSearchArea.match(titleRegex);
    if (match) {
      let title = match[1].trim();
      // Title-case
      title = title.split(/\s+/).map(w =>
        ['|', '/', '&'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      if (title.length >= 5 && title.length <= 80) {
        result.position = { value: title, confidence: 75 };
      }
    }
  }

  // ════════════════════════════════════════
  // 5. SKILLS EXTRACTION (section-aware)
  // ════════════════════════════════════════
  // First try to find skills from SKILLS section
  const skillsSectionText = sections['SKILLS'] || sections['TECHNICAL SKILLS'] || sections['KEY SKILLS'] || sections['CORE COMPETENCIES'] || '';

  const foundSkills = new Set();

  // Search in skills section first (higher confidence), then full text
  const searchTexts = [
    { text: skillsSectionText.toLowerCase(), boost: 10 },
    { text: flatText.toLowerCase(), boost: 0 }
  ];

  for (const { text: searchText } of searchTexts) {
    if (!searchText) continue;
    for (const skill of SKILL_KEYWORDS) {
      // Word-boundary matching to avoid false positives (e.g., "react" in "reactive")
      const skillRegex = new RegExp('\\b' + skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[.\\s]*') + '\\b', 'i');
      if (skillRegex.test(searchText)) {
        // Capitalize skill name properly
        const properSkill = skill.split(/\s+/).map(w => {
          if (w.includes('.')) return w; // Keep node.js, asp.net, etc.
          if (w.length <= 3) return w.toUpperCase(); // CSS, PHP, SQL, etc.
          return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');
        foundSkills.add(properSkill);
      }
    }
  }

  // Also extract skills that aren't in our keyword list but appear in the skills section
  if (skillsSectionText) {
    // Clean the section content thoroughly
    const cleanedSkillSection = skillsSectionText
      .replace(/^\s*(SKILLS|TECHNICAL SKILLS|KEY SKILLS|CORE COMPETENCIES)\s*/i, '')
      .replace(/\b(Front\s*End|Back\s*End|Database|Programming|Languages?|Frameworks?|Tools?|Cloud|Web)\s*[-:–]\s*/gi, ', ') // Convert category labels to delimiters
      .replace(/\s*[-–]\s*/g, ', ') // Convert remaining dashes to commas
      .replace(/\s{2,}/g, ', ') // Convert large whitespace gaps to commas
      .trim();

    // Split on commas, semicolons, bullets, pipes
    const extraSkills = cleanedSkillSection
      .split(/[,;•|]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 25) // Tighter max length
      .filter(s => !/^\d+$/.test(s))
      .filter(s => !['and', 'or', 'the', 'with', 'for', 'in', 'of', 'on', 'to', 'from', 'end', 'front', 'back', 'skills', 'technical', 'key', 'core', 'competencies'].includes(s.toLowerCase()))
      .filter(s => s.split(/\s+/).length <= 3); // Max 3 words per skill

    for (const skill of extraSkills.slice(0, 20)) {
      foundSkills.add(skill);
    }
  }

  if (foundSkills.size > 0) {
    // Deduplicate: normalize to lowercase for comparison, keep the prettiest version
    const skillMap = new Map();
    for (const skill of foundSkills) {
      const key = skill.toLowerCase().replace(/[.\s]+/g, '');
      // If we already have this skill, keep the shorter/cleaner version
      if (!skillMap.has(key) || skill.length < skillMap.get(key).length) {
        skillMap.set(key, skill);
      }
    }
    const dedupedSkills = [...skillMap.values()];
    result.skills = {
      value: dedupedSkills.slice(0, 15).join(', '),
      confidence: Math.min(95, 65 + dedupedSkills.length * 2)
    };
  }

  // ════════════════════════════════════════
  // 6. EDUCATION EXTRACTION (comprehensive)
  // ════════════════════════════════════════
  const educationSection = sections['EDUCATION'] || sections['ACADEMIC'] || sections['QUALIFICATION'] || sections['QUALIFICATIONS'] || '';
  const eduSearchText = educationSection || flatText;

  const educationPatterns = [
    // Full degree with field: "Master Of Science In Physics", "Bachelor Of Science"
    { regex: /(?:Master(?:'s)?|Bachelor(?:'s)?)\s+(?:of|Of|in|In)\s+(?:Science|Arts|Commerce|Engineering|Technology|Computer|Information|Business|Education|Medicine|Law|Architecture|Pharmacy|Design|Management)(?:\s+(?:in|In)\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3})?/gi, confidence: 92 },

    // Short degree codes with optional specialization
    { regex: /\b(B\.?Tech|M\.?Tech|B\.?E\.?|M\.?E\.?|MBA|MCA|BCA|M\.?Sc|B\.?Sc|B\.?Com|M\.?Com|Ph\.?D\.?|MBBS|BBA|BDS|LLB|LLM)(?:\s+(?:in|In)\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3})?/gi, confidence: 88 },

    // Full degree names (longer form)
    { regex: /(?:Bachelor|Master|Doctorate|Diploma|Doctor)\s+(?:of|Of|in|In)\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,4}/gi, confidence: 90 },

    // "Degree from University" pattern
    { regex: /(?:B\.?Tech|M\.?Tech|B\.?E\.?|M\.?E\.?|MBA|MCA|BCA|B\.?Sc|M\.?Sc)[^,.\n]{0,50}(?:University|Institute|College|School)/gi, confidence: 85 }
  ];

  const allEducation = [];
  for (const { regex, confidence } of educationPatterns) {
    const matches = eduSearchText.match(regex);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.trim().replace(/\s+/g, ' ');
        if (cleaned.length >= 3 && cleaned.length <= 80) {
          allEducation.push({ value: cleaned, confidence });
        }
      }
    }
  }

  if (allEducation.length > 0) {
    // Deduplicate: use lowercase for comparison, keep the longest version
    const eduMap = new Map();
    for (const e of allEducation) {
      // Normalize key: remove trailing single letters, extra spaces
      const cleaned = e.value.replace(/\s+[A-Z]$/g, '').replace(/\s+/g, ' ').trim();
      const key = cleaned.toLowerCase();
      if (!eduMap.has(key) || cleaned.length > eduMap.get(key).value.length) {
        eduMap.set(key, { value: cleaned, confidence: e.confidence });
      }
    }
    const uniqueEdu = [...eduMap.values()];
    uniqueEdu.sort((a, b) => b.confidence - a.confidence);

    // Combine top 2-3 degrees
    const topDegrees = uniqueEdu.slice(0, 3).map(e => e.value);
    result.education = {
      value: topDegrees.join(' | '),
      confidence: uniqueEdu[0].confidence
    };
  }

  // ════════════════════════════════════════
  // 7. EXPERIENCE EXTRACTION
  // ════════════════════════════════════════

  // Priority 1: Check for "Fresher" keyword FIRST (overrides date calculations)
  if (/\bfresher\b/i.test(flatText) || /\bfresh graduate\b/i.test(flatText) || /\bentry[\s-]?level\b/i.test(flatText) || /\bdedicated fresher\b/i.test(flatText)) {
    result.experience = { value: 'Fresher', confidence: 90 };
  }

  // Priority 2: Explicit experience mentions like "5 years of experience"
  if (result.experience.confidence < 85) {
    for (const { regex, confidence } of PATTERNS.experience) {
      const matches = flatText.match(regex);
      if (matches) {
        const expValue = matches[1] || matches[0];
        const numericExp = parseFloat(expValue);
        if (!isNaN(numericExp) && numericExp >= 0 && numericExp <= 50) {
          result.experience = {
            value: numericExp + (numericExp === 1 ? ' Year' : ' Years'),
            confidence
          };
          break;
        }
      }
    }
  }

  // Priority 3: Calculate from WORK EXPERIENCE date ranges (NOT education dates)
  if (result.experience.confidence < 70) {
    // Only look in experience/employment sections, NOT education section
    const expSectionForDates = sections['EXPERIENCE'] || sections['WORK EXPERIENCE'] || sections['PROFESSIONAL EXPERIENCE'] || sections['EMPLOYMENT'] || '';
    if (expSectionForDates) {
      const dateRanges = expSectionForDates.match(/(\d{4})\s*[-–to]+\s*(present|\d{4})/gi);
      if (dateRanges && dateRanges.length > 0) {
        let earliestStart = 9999, latestEnd = 0;
        const currentYear = new Date().getFullYear();
        for (const range of dateRanges) {
          const years = range.match(/(\d{4})/g);
          if (years && years.length >= 1) {
            const start = parseInt(years[0]);
            const end = years[1] ? (range.toLowerCase().includes('present') ? currentYear : parseInt(years[1])) : currentYear;
            if (start >= 1970 && start <= currentYear + 1) earliestStart = Math.min(earliestStart, start);
            if (end >= 1970 && end <= currentYear + 5) latestEnd = Math.max(latestEnd, end);
          }
        }
        if (earliestStart < 9999 && latestEnd > 0 && latestEnd >= earliestStart) {
          const totalYears = latestEnd - earliestStart;
          if (totalYears > 0 && totalYears <= 50) {
            result.experience = {
              value: totalYears + (totalYears === 1 ? ' Year' : ' Years'),
              confidence: 65
            };
          }
        }
      }
    }
  }

  // ════════════════════════════════════════
  // 8. COMPANY EXTRACTION
  // ════════════════════════════════════════
  const experienceSection = sections['EXPERIENCE'] || sections['WORK EXPERIENCE'] || sections['PROFESSIONAL EXPERIENCE'] || sections['EMPLOYMENT'] || '';
  const companySearchText = experienceSection || flatText;

  // "Relationship Manager | DBS BANK" / "Branch Sales Manager | AXIS BANK"
  const titleCompanyPipe = flatText.match(
    /\b(?:Manager|Executive|Specialist|Officer|Analyst|Engineer|Developer|Lead)\s*[|–—]\s*([A-Z][A-Za-z0-9&.]*(?:\s+[A-Z][A-Za-z0-9&.]*){0,4})/
  );
  if (titleCompanyPipe) {
    let co = titleCompanyPipe[1].replace(/\s+/g, ' ').trim();
    co = co.replace(/\s*\(.*$/, '').trim(); // drop "(Coimbatore, Chennai)"
    if (co.length >= 2 && co.length <= 50 && !/^(PRESENT|ADDRESS|PHONE|EMAIL|GENDER)$/i.test(co)) {
      result.company = { value: co, confidence: 92 };
    }
  }

  // Strategy: Look for company name patterns with stricter validation
  // Words that indicate the match is part of a sentence, not a standalone company name
  const SENTENCE_CONTEXT_WORDS = ['with', 'using', 'like', 'such', 'including', 'experience', 'hands-on',
    'knowledge', 'proficient', 'skilled', 'expertise', 'familiar', 'working', 'worked',
    'used', 'utilize', 'utilizing', 'various', 'multiple', 'different', 'building', 'built',
    'develop', 'developing', 'developed', 'learn', 'learning', 'learned', 'trained'];
  
  const companyPatterns = [
    // "Company Name Pvt Ltd", "ABC Technologies", etc. — require company suffix
    /([A-Z][A-Za-z\s&.]+(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Inc\.?|Corp\.?|Corporation|LLC|LLP|Limited))/g,
    // "at/with CompanyName" — require company suffix
    /(?:at|@|with)\s+([A-Z][A-Za-z\s&.]{3,40}?(?:Pvt\.?\s*Ltd\.?|Inc\.?|Corp\.?|LLC|Limited))(?:\s|$|[.,;])/gi,
    // "CompanyName - Role" or "CompanyName | Role"
    /([A-Z][A-Za-z\s&.]{5,40})\s*[-|]\s*(?:software|developer|engineer|manager|analyst|designer|lead|senior|junior|branch|assistant|vice)/gi
  ];

  if (result.company.confidence < 85) {
  for (const pattern of companyPatterns) {
    const matches = companySearchText.match(pattern);
    if (matches) {
      for (const match of matches) {
        let cleaned = match.replace(/(?:at|@|with)\s+/i, '').replace(/\s*[-|]\s*\w.*$/, '').trim();
        // Must be at least 3 chars and contain at least one company keyword
        const lowerCleaned = cleaned.toLowerCase();
        const hasCompanyKeyword = ['ltd', 'limited', 'inc', 'corp', 'corporation', 'llc', 'llp', 'pvt', 'private']
          .some(kw => lowerCleaned.includes(kw));
        
        // Check if this match appears inside a running sentence (false positive)
        const matchIdx = companySearchText.toLowerCase().indexOf(lowerCleaned);
        if (matchIdx > 0) {
          const before = companySearchText.substring(Math.max(0, matchIdx - 30), matchIdx).toLowerCase().trim();
          const lastWordBefore = before.split(/\s+/).pop();
          if (SENTENCE_CONTEXT_WORDS.includes(lastWordBefore)) continue; // Skip — it's part of a sentence
        }
        
        if (cleaned.length >= 5 && cleaned.length <= 60 && (hasCompanyKeyword || cleaned.split(/\s+/).length >= 2)) {
          // Verify it's not the candidate name
          if (result.name.value && cleaned.toLowerCase() === result.name.value.toLowerCase()) continue;
          // Verify it's not a generic phrase
          if (['web development', 'software development', 'application development'].includes(lowerCleaned)) continue;
          result.company = { value: cleaned, confidence: hasCompanyKeyword ? 85 : 70 };
          break;
        }
      }
      if (result.company.confidence > 0) break;
    }
  }
  }

  // ════════════════════════════════════════
  // 9. LOCATION EXTRACTION
  // ════════════════════════════════════════
  const contactSection = sections['CONTACT'] || sections['CONTACT DETAILS'] || sections['PERSONAL DETAILS'] || '';
  // For location, prioritize header (near name) and contact sections over full text
  const locationSearchText = contactSection || headerText || flatText;
  const lowerLocText = locationSearchText.toLowerCase();

  // Check cities first (more specific) — require minimum city name length to avoid false matches
  for (const city of LOCATION_KEYWORDS.cities) {
    if (city.length < 3) continue; // Skip very short city names that could match random text
    const cityRegex = new RegExp('\\b' + city.replace(/[-]/g, '[-\\s]?') + '\\b', 'i');
    if (cityRegex.test(lowerLocText)) {
      // Prefer clean city (+ state) over OCR address fragments like "ai malai, Karur"
      const properCity = city.split(/[-\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      let location = properCity;
      const cityIdx = lowerLocText.search(cityRegex);
      const surrounding = locationSearchText.substring(Math.max(0, cityIdx - 5), cityIdx + city.length + 40).trim();
      const withState = surrounding.match(new RegExp(city.replace(/[-]/g, '[-\\s]?') + '\\s*[,\\-]?\\s*([A-Za-z][A-Za-z\\s]{3,20})', 'i'));
      if (withState) {
        const maybeState = withState[1].trim().toLowerCase();
        const matchedState = LOCATION_KEYWORDS.states.find((s) => maybeState.startsWith(s) || s.startsWith(maybeState.split(/\s+/)[0]));
        if (matchedState) {
          location = `${properCity}, ${matchedState.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
        }
      }

      if (location.length >= 3 && location.length <= 50) {
        result.location = { value: location, confidence: 90 };
        break;
      }
    }
  }

  // Check states if no city found
  if (result.location.confidence < 70) {
    for (const state of LOCATION_KEYWORDS.states) {
      const stateRegex = new RegExp('\\b' + state.replace(/\s+/g, '\\s+') + '\\b', 'i');
      if (stateRegex.test(lowerLocText) || stateRegex.test(flatText.toLowerCase())) {
        result.location = { value: state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), confidence: 80 };
        break;
      }
    }
  }

  // Full-text city fallback (scanned resumes often put city only in body OCR)
  if (result.location.confidence < 70) {
    const lowerFlat = flatText.toLowerCase();
    for (const city of LOCATION_KEYWORDS.cities) {
      if (city.length < 4) continue;
      const cityRegex = new RegExp('\\b' + city.replace(/[-]/g, '[-\\s]?') + '\\b', 'i');
      if (cityRegex.test(lowerFlat)) {
        result.location = {
          value: city.split(/[-\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          confidence: 75,
        };
        break;
      }
    }
  }

  // ════════════════════════════════════════
  // FINAL: Build clean response
  // ════════════════════════════════════════
  logger.info('🎯 Extraction results:');
  for (const [key, val] of Object.entries(result)) {
    if (val.value) logger.info(`   ${key}: "${val.value}" (${val.confidence}%)`);
    else logger.info(`   ${key}: [not found]`);
  }

  return {
    name: result.name.value,
    email: result.email.value,
    contact: result.contact.value,
    position: result.position.value,
    company: result.company.value,
    experience: result.experience.value,
    location: result.location.value,
    skills: result.skills.value,
    education: result.education.value,
    confidence: {
      name: result.name.confidence,
      email: result.email.confidence,
      contact: result.contact.confidence,
      position: result.position.confidence,
      company: result.company.confidence,
      experience: result.experience.confidence,
      location: result.location.confidence,
      skills: result.skills.confidence,
      education: result.education.confidence
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// Enterprise Multi-Strategy Resume Parser
// Pipeline: pdf-parse → pdfjs-dist → OCR (tesseract.js) → result
// ═══════════════════════════════════════════════════════════════════
async function parseResume(buffer, mimetype, filename = '') {
  let text = '';
  let extractionMethod = 'none';

  try {
    if (mimetype === 'application/pdf') {
      // ── Strategy 1: pdf-parse (fast, works for most text-based PDFs) ──
      logger.info('📄 [Strategy 1/3] Trying pdf-parse...');
      try {
        const data = await pdfParse(buffer);
        text = (data.text || '').trim();
        logger.info(`   → pdf-parse extracted ${text.length} chars`);
        if (text.length >= 20) {
          extractionMethod = 'pdf-parse';
        }
      } catch (e) {
        logger.info(`   → pdf-parse failed: ${e.message}`);
      }

      // ── Strategy 2: pdfjs-dist (handles PDFs that pdf-parse misses) ──
      if (text.length < 20 && pdfjsLib) {
        logger.info('📄 [Strategy 2/3] Trying pdfjs-dist direct extraction...');
        const pdfjsText = await extractTextWithPdfJs(buffer);
        logger.info(`   → pdfjs-dist extracted ${pdfjsText.length} chars`);
        if (pdfjsText.length > text.length) {
          text = pdfjsText;
          extractionMethod = 'pdfjs-dist';
        }
      }

      // ── Strategy 3: OCR via tesseract.js (for scanned/image-based PDFs) ──
      if (text.length < 20 && Tesseract && ocrEnabled()) {
        logger.info('📄 [Strategy 3/3] PDF appears image-based — running OCR (enterprise scanned-resume path)...');
        try {
          const ocrText = await withTimeout(ocrPdfBuffer(buffer), ocrTimeoutMs(), 'Resume OCR');
          logger.info(`   → OCR extracted ${ocrText.length} chars`);
          if (ocrText.length > text.length) {
            text = ocrText;
            extractionMethod = 'tesseract-ocr';
          }
        } catch (e) {
          logger.warn(`   → OCR skipped/failed: ${e.message}`);
        }
      } else if (text.length < 20 && Tesseract && !ocrEnabled()) {
        logger.info('📄 [Strategy 3/3] OCR disabled (RESUME_OCR_ENABLED=false). Scanned PDF will not be parsed.');
      }

      // ── textract as final fallback ──
      if (text.length < 20 && extractText) {
        logger.info('📄 [Fallback] Trying textract...');
        try {
          const txText = await extractText('application/pdf', buffer);
          if (txText && txText.length > text.length) {
            text = txText;
            extractionMethod = 'textract';
          }
        } catch (e) {
          logger.info(`   → textract failed: ${e.message}`);
        }
      }

    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      if (extractText) {
        text = await extractText(mimetype, buffer);
        extractionMethod = 'textract-docx';
      } else {
        throw new Error('DOCX/DOC parsing requires textract. Install it with: npm install textract');
      }

    } else if (mimetype === 'text/plain' || filename.toLowerCase().endsWith('.txt')) {
      text = buffer.toString('utf8');
      extractionMethod = 'plaintext';

    } else if (mimetype === 'application/rtf' || filename.toLowerCase().endsWith('.rtf')) {
      if (extractText) {
        text = await extractText('application/rtf', buffer);
        extractionMethod = 'textract-rtf';
      } else {
        throw new Error('RTF parsing requires textract. Install it with: npm install textract');
      }

    } else if (mimetype.startsWith('image/')) {
      // Direct image → OCR (JPG/PNG photo or scan of a resume)
      if (Tesseract && ocrEnabled()) {
        try {
          text = await withTimeout(ocrImageBuffer(buffer), ocrTimeoutMs(), 'Image OCR');
          extractionMethod = 'tesseract-image-ocr';
        } catch (e) {
          throw new Error(
            `Could not read this image resume (${e.message}). ` +
            'Try a clearer scan, or upload a PDF/DOCX instead.'
          );
        }
      } else {
        throw new Error(
          'Image resume OCR is disabled on this server. Upload a PDF or DOCX, or ask an admin to enable RESUME_OCR_ENABLED.'
        );
      }

    } else {
      throw new Error(`Unsupported file type: ${mimetype}. Supported: PDF, DOCX, DOC, TXT, RTF, Images`);
    }

    // ── Final validation ──
    const cleanText = (text || '').trim();
    logger.info(`\n══════════════════════════════════════════`);
    logger.info(`📊 Extraction Summary:`);
    logger.info(`   File: ${filename}`);
    logger.info(`   Method: ${extractionMethod}`);
    logger.info(`   Characters: ${cleanText.length}`);
    logger.info(`   Preview: "${cleanText.substring(0, 150)}..."`);
    logger.info(`══════════════════════════════════════════\n`);

    if (cleanText.length === 0) {
      const strategies = ['pdf-parse'];
      if (pdfjsLib) strategies.push('pdfjs-dist');
      if (Tesseract && ocrEnabled()) strategies.push('tesseract-ocr');
      if (extractText) strategies.push('textract');

      const ocrAttempted = Tesseract && ocrEnabled();
      const errorMsg = ocrAttempted
        ? 'Could not extract text from this resume even with OCR. The scan quality may be too low, or the file may be corrupted. ' +
          'Try a clearer scan, or a text-based PDF/DOCX.'
        : 'This resume appears to be a scanned/image-based PDF and OCR is not available on this server. ' +
          'Please upload a text-based PDF or DOCX, or enable RESUME_OCR_ENABLED.';

      throw new Error(errorMsg);
    }

    const parsed = extractFields(cleanText);

    // Log parsing results for debugging
    logger.info('Resume parsing completed:', {
      filename,
      extractedFields: Object.keys(parsed).filter(k => parsed[k] && k !== 'confidence'),
      confidence: parsed.confidence
    });

    return parsed;

  } catch (error) {
    logger.error('Resume parsing error:', error);
    throw new Error(`Resume parsing failed: ${error.message}`);
  }
}

module.exports = { parseResume };
