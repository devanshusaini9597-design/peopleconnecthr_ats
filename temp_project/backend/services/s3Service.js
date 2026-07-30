/**
 * S3 service for resume upload and download.
 * Resumes are stored under folder: S3_BUCKET_NAME / S3_RESUME_PREFIX (e.g. resumes/)
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, S3_RESUME_PREFIX
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

const BUCKET = process.env.S3_BUCKET_NAME || '';
const PREFIX = (process.env.S3_RESUME_PREFIX || 'resumes').replace(/^\/+|\/+$/g, '') || 'resumes';

function isS3Configured() {
    return !!(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_REGION &&
        BUCKET
    );
}

function getClient() {
    if (!isS3Configured()) return null;
    return new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });
}

/**
 * Upload a resume file to S3 under the "resumes/" folder.
 * @param {string} localFilePath - Full path to the file on disk (e.g. uploads/123.pdf)
 * @param {string} originalName - Original filename for extension
 * @returns {Promise<{ key: string } | null>} S3 key (e.g. resumes/123.pdf) or null on failure
 */
async function uploadResumeFromFile(localFilePath, originalName) {
    const client = getClient();
    if (!client) {
        console.log('[S3] Resume upload skipped — S3 not configured (set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME in .env)');
        return null;
    }
    const folder = PREFIX + '/';
    console.log('[S3] Uploading resume → bucket:', BUCKET, ', folder:', folder);
    try {
        if (!fs.existsSync(localFilePath)) {
            console.error('[S3] Local file not found:', localFilePath);
            return null;
        }
        const body = fs.readFileSync(localFilePath);
        const ext = path.extname(originalName) || path.extname(localFilePath) || '.pdf';
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        const key = `${PREFIX}/${uniqueName}`;

        await client.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: getContentType(ext)
        }));

        console.log('[S3] Resume saved in S3 — folder: "' + folder + '", full key:', key);
        return { key };
    } catch (err) {
        console.error('[S3] uploadResumeFromFile error:', err.message);
        if (err.name) console.error('[S3] Error name:', err.name);
        return null;
    }
}

function getContentType(ext) {
    const mime = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    };
    return mime[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Check if a resume value in DB is an S3 key (stored in resumes/ folder).
 * @param {string} resumeValue - Value from candidate.resume
 * @returns {boolean}
 */
function isS3Resume(resumeValue) {
    if (!resumeValue || typeof resumeValue !== 'string') return false;
    const s = resumeValue.replace(/^\/+/, '').trim();
    return s.startsWith(PREFIX + '/') || s.startsWith('resumes/');
}

/**
 * Get a read stream for a resume stored in S3. Used for view/download.
 * @param {string} s3Key - e.g. resumes/123.pdf
 * @returns {Promise<{ stream: Readable, contentType: string } | null>}
 */
async function getResumeStream(s3Key) {
    const client = getClient();
    if (!client) return null;
    const key = s3Key.replace(/^\/+/, '').trim();
    if (!key.startsWith(PREFIX + '/') && !key.startsWith('resumes/')) return null;
    try {
        const response = await client.send(new GetObjectCommand({
            Bucket: BUCKET,
            Key: key
        }));
        const stream = response.Body;
        const contentType = response.ContentType || getContentType(path.extname(key));
        return { stream, contentType };
    } catch (err) {
        console.error('[S3] getResumeStream error:', err.message);
        return null;
    }
}

module.exports = {
    isS3Configured,
    uploadResumeFromFile,
    isS3Resume,
    getResumeStream,
    S3_BUCKET: BUCKET,
    S3_RESUME_PREFIX: PREFIX
};
