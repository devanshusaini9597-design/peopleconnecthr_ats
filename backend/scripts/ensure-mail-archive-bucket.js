/**
 * Ensure the dedicated mail-archive S3 bucket exists (private + default encryption).
 *
 * Usage:
 *   node scripts/ensure-mail-archive-bucket.js
 *
 * Env:
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION
 *   S3_EMAIL_BUCKET (preferred) or S3_BUCKET_NAME (fallback prefix mail-archive/)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketEncryptionCommand,
  PutPublicAccessBlockCommand,
  PutBucketOwnershipControlsCommand,
} = require('@aws-sdk/client-s3');

function env(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

async function main() {
  const accessKeyId = env('AWS_ACCESS_KEY_ID') || env('S3_ACCESS_KEY_ID');
  const secretAccessKey = env('AWS_SECRET_ACCESS_KEY') || env('S3_SECRET_ACCESS_KEY');
  const region = env('AWS_REGION') || env('S3_REGION') || 'ap-south-1';
  const dedicated = env('S3_EMAIL_BUCKET');
  const fallback = env('S3_BUCKET_NAME');
  const bucket = dedicated || fallback;

  if (!accessKeyId || !secretAccessKey || !bucket) {
    console.error(JSON.stringify({
      ok: false,
      error: 'Missing AWS credentials or bucket. Set AWS_* and S3_EMAIL_BUCKET (or S3_BUCKET_NAME).',
    }, null, 2));
    process.exit(1);
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  let created = false;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode || err?.name;
    if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchBucket') {
      const params = { Bucket: bucket };
      if (region !== 'us-east-1') {
        params.CreateBucketConfiguration = { LocationConstraint: region };
      }
      await client.send(new CreateBucketCommand(params));
      created = true;
    } else {
      throw err;
    }
  }

  if (dedicated) {
    try {
      await client.send(new PutPublicAccessBlockCommand({
        Bucket: bucket,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      }));
    } catch (err) {
      console.warn('[mail-archive] public access block:', err.message);
    }
    try {
      await client.send(new PutBucketOwnershipControlsCommand({
        Bucket: bucket,
        OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] },
      }));
    } catch (err) {
      console.warn('[mail-archive] ownership controls:', err.message);
    }
    try {
      await client.send(new PutBucketEncryptionCommand({
        Bucket: bucket,
        ServerSideEncryptionConfiguration: {
          Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
        },
      }));
    } catch (err) {
      console.warn('[mail-archive] encryption:', err.message);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    bucket,
    region,
    created,
    mode: dedicated ? 'dedicated-bucket' : 'shared-bucket-prefix',
    prefix: env('S3_EMAIL_PREFIX', 'mail-archive'),
    hint: dedicated
      ? 'Set S3_EMAIL_BUCKET in Railway/production env.'
      : 'Using S3_BUCKET_NAME with mail-archive/ prefix. Prefer a dedicated S3_EMAIL_BUCKET for enterprise isolation.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
