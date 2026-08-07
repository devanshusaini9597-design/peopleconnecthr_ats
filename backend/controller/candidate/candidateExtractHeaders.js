const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const logger = require('../../utils/logger');

async function extractHeaders(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const workbook = new ExcelJS.Workbook();
        const ext = path.extname(req.file.originalname || '').toLowerCase();
        if (ext === '.csv') {
            await workbook.csv.readFile(req.file.path);
        } else if (ext === '.xls') {
            return res.status(400).json({ success: false, message: "Old .xls format not supported. Please save as .xlsx or .csv." });
        } else {
            await workbook.xlsx.readFile(req.file.path);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            return res.status(400).json({ success: false, message: "No worksheet found" });
        }

        // Helper function to convert cell value to string
        const cellToString = (cell) => {
            if (cell === null || cell === undefined) return "";
            if (typeof cell === 'object') {
                if (cell.text) return String(cell.text).trim();
                if (cell.richText && Array.isArray(cell.richText)) return cell.richText.map(r => r.text || '').join('').trim();
                if (cell.result) return String(cell.result).trim();
                if (cell instanceof Date) return cell.toISOString().split('T')[0];
                return String(cell).trim();
            }
            return String(cell).trim();
        };

        // Detect header row (best match in first few rows)
        const detectHeaderRow = (sheet) => {
            const scores = {};
            for (let r = 1; r <= Math.min(8, sheet.rowCount); r++) {
                let score = 0;
                const row = sheet.getRow(r);
                row.eachCell((cell) => {
                    const text = cellToString(cell.value).toLowerCase();
                    if (!text) return;
                    if (text.includes('name') || text.includes('email') || text.includes('contact') || text.includes('position') || text.includes('company') || text.includes('ctc') || text.includes('client') || text.includes('experience') || text.includes('notice')) score++;
                });
                scores[r] = score;
            }
            let best = 1, bestScore = -1;
            for (const k of Object.keys(scores)) {
                if (scores[k] > bestScore) { best = Number(k); bestScore = scores[k]; }
            }
            return best;
        };

        // Extract headers from detected header row, including ALL columns (even if empty)
        const headers = [];
        const headerRowNum = detectHeaderRow(worksheet);
        const headerRow = worksheet.getRow(headerRowNum);

        // Determine last used column in header row (preserve gaps)
        let maxCol = 0;
        headerRow.eachCell((cell, colNumber) => {
            if (colNumber > maxCol) maxCol = colNumber;
        });
        maxCol = Math.max(maxCol, 20); // At least check 20 columns

        for (let col = 1; col <= maxCol; col++) {
            const cell = headerRow.getCell(col);
            const value = cellToString(cell.value);
            if (value) {
                headers.push(value);
            } else {
                headers.push(`Column ${col}`);
            }
        }

        // Trim trailing empty columns
        while (headers.length > 0 && headers[headers.length - 1].startsWith('Column')) {
            headers.pop();
        }

        logger.info("--- 📋 Extracted Headers:", headers);
        logger.info("--- 🧭 Header Row Detected:", headerRowNum);
        logger.info("--- 📊 Total columns detected:", headers.length);

        // Cleanup
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(200).json({ success: true, headers });
    } catch (err) {
        logger.error("Extract Headers Error:", err);
        res.status(500).json({ success: false, message: "Error reading file: " + err.message });
    }
}

module.exports = { extractHeaders };
