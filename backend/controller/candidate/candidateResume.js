const path = require('path');
const fs = require('fs');
const Candidate = require('../../models/Candidate');
const logger = require('../../utils/logger');
const { orgOrOwnerScope } = require('./candidateValidation');
const { parseResume } = require('../../services/resumeParser');
const { parseResumeViaQueueOrInline, queuesEnabled } = require('../../jobs/queue');

async function checkEmail(req, res) {
    try {
        const existing = await Candidate.findOne({ email: req.params.email, createdBy: req.user.id });
        res.status(200).json({ exists: !!existing });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
}

async function getResume(req, res) {
    try {
        if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
        const candidate = await Candidate.findOne({ _id: req.params.id, ...orgOrOwnerScope(req) }).select('resume').lean();
        if (!candidate || !candidate.resume) {
            return res.status(404).json({ message: 'Resume not found' });
        }
        const resumeValue = String(candidate.resume).trim();
        const documentStorage = require('../../services/documentStorageService');
        const s3Service = require('../../services/s3Service');

        // Serve from BYOK customer bucket or platform S3
        if (documentStorage.isByokResume(resumeValue) || s3Service.isS3Resume(resumeValue)) {
            const result = await documentStorage.getResumeStream({
                organizationId: req.user.organizationId,
                resumeValue
            });
            if (result?.redirectUrl) {
                return res.redirect(result.redirectUrl);
            }
            if (result?.stream) {
                const isDownload = req.query.download === '1';
                const filename = path.basename(resumeValue.replace(/^\/+/, ''));
                const disposition = isDownload ? `attachment; filename="${filename}"` : 'inline';
                res.setHeader('Content-Disposition', disposition);
                res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
                result.stream.pipe(res);
                return;
            }
            logger.error('[Resume] Remote storage get failed for:', resumeValue);
            return res.status(404).json({ message: 'Resume file not found in storage. Try re-uploading.' });
        }

        // Local file: try uploads directory
        const rawPath = resumeValue.replace(/^\/+/, '').trim();
        const filename = path.basename(rawPath);
        const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
        const tries = [
            path.join(UPLOADS_DIR, filename),
            rawPath.includes(path.sep) ? path.join(__dirname, '..', '..', rawPath) : null,
            path.join(process.cwd(), 'uploads', filename),
            path.join(process.cwd(), '..', 'uploads', filename),
            path.join(__dirname, '..', '..', 'uploads', filename)
        ].filter(Boolean);

        let filePath = null;
        for (const p of tries) {
            if (fs.existsSync(p)) {
                filePath = p;
                break;
            }
        }

        if (!filePath) {
            logger.error('[Resume] File not found on server:', {
                candidateId: req.params.id,
                resumeField: candidate.resume,
                filename: filename,
                tried: tries,
                uploadsDir: UPLOADS_DIR,
                cwd: process.cwd(),
                message: 'File does not exist on this server. This may happen if: (1) File was uploaded to a different server instance, (2) Render\'s ephemeral storage was reset, or (3) Resume was never uploaded successfully.'
            });
            return res.status(404).json({ message: 'Resume file not found on this server. Try re-uploading the resume.' });
        }

        const ext = path.extname(filePath).toLowerCase();
        const disposition = req.query.download === '1' ? 'attachment' : 'inline';
        res.setHeader('Content-Disposition', disposition);

        if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx'].includes(ext)) {
            const mime = {
                '.pdf': 'application/pdf',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            };
            res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
        }
        res.sendFile(path.resolve(filePath));
    } catch (err) {
        logger.error('[Resume] Error serving resume:', err);
        res.status(500).json({ message: 'Server error while serving resume' });
    }
}

async function parseLogic(req, res) {
    try {
        if (!req.file) return res.status(400).json({ message: "File missing" });

        const mimetype = req.file.mimetype;
        // Disk storage: read file into buffer for the parser, then clean up
        const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        const filename = req.file.originalname || '';

        if (!buffer) {
            return res.status(400).json({ message: 'Could not read uploaded file' });
        }

        logger.info(`🔍 Parsing resume: ${filename} (${mimetype})${queuesEnabled ? ' [queue]' : ' [inline]'}`);

        const parsed = await parseResumeViaQueueOrInline({
            buffer,
            mimetype,
            filename,
            parseResume,
        });

        // Enhanced response with confidence scores and metadata
        const response = {
            success: true,
            name: parsed.name,
            email: parsed.email,
            contact: parsed.contact,
            position: parsed.position,
            company: parsed.company,
            experience: parsed.experience,
            location: parsed.location,
            skills: parsed.skills,
            education: parsed.education,
            parsed: parsed,
            confidence: parsed.confidence,
            metadata: {
                filename,
                mimetype,
                parsedAt: new Date().toISOString(),
                viaQueue: queuesEnabled,
                extractedFields: Object.keys(parsed).filter(k => parsed[k] && k !== 'confidence'),
                averageConfidence: parsed.confidence ? Object.values(parsed.confidence).reduce((a, b) => a + b, 0) / Object.keys(parsed.confidence).length : 0
            }
        };

        logger.info(`✅ Resume parsed successfully: ${response.metadata.extractedFields.length} fields extracted`);
        res.json(response);

    } catch (err) {
        // Enterprise-grade error logging with more details
        const errorLog = `${new Date().toISOString()} - ${req.file?.originalname || 'unknown'} - ${err.stack}\n`;
        fs.appendFile('backend/resume_parse_errors.log', errorLog, () => {});

        logger.error('❌ Resume parsing error:', {
            filename: req.file?.originalname,
            mimetype: req.file?.mimetype,
            error: err.message
        });

        // Use the parser's error message directly if it's user-friendly
        const isUserFriendly = err.message.includes('scanned') || err.message.includes('image') || err.message.includes('text-based');
        res.status(500).json({
            error: isUserFriendly ? err.message : 'Resume parsing failed',
            details: err.message,
            filename: req.file?.originalname,
            suggestion: isUserFriendly
              ? 'Upload a text-based PDF or DOCX resume for best results'
              : 'Try uploading a PDF, DOC, DOCX, TXT, or RTF file with clear text content'
        });
    } finally {
        if (req.file?.path) {
            fs.unlink(req.file.path, () => {});
        }
    }
}

module.exports = { checkEmail, getResume, parseLogic };
