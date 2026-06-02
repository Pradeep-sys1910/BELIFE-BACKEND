import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const IMAGE_MAX = 10 * 1024 * 1024;   // 10 MB
const VIDEO_MAX = 60 * 1024 * 1024;   // 60 MB
const DOC_MAX   = 25 * 1024 * 1024;   // 25 MB (PPT / Excel)

// Single source of truth for allowed types → file extension used in the storage key.
const EXT_BY_MIME: Record<string, string> = {
  // images
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
  // videos
  'video/mp4':       'mp4',
  'video/webm':      'webm',
  'video/quicktime': 'mov',
  // PowerPoint
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  // Excel
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_DOC_TYPES   = [
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(`Missing R2 credentials: ACCOUNT_ID=${!!accountId} ACCESS_KEY=${!!accessKeyId} SECRET=${!!secretAccessKey}`);
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function validateFile(mimeType: string, fileSize: number): string | null {
  const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);
  const isDoc   = ALLOWED_DOC_TYPES.includes(mimeType);

  if (!isImage && !isVideo && !isDoc) {
    return 'Only images, videos, PowerPoint, and Excel files are allowed.';
  }
  if (isImage && fileSize > IMAGE_MAX) {
    return `Image too large. Max is 10MB. Your file: ${(fileSize / 1024 / 1024).toFixed(1)}MB.`;
  }
  if (isVideo && fileSize > VIDEO_MAX) {
    return `Video too large. Max is 60MB. Your file: ${(fileSize / 1024 / 1024).toFixed(1)}MB.`;
  }
  if (isDoc && fileSize > DOC_MAX) {
    return `File too large. Max is 25MB. Your file: ${(fileSize / 1024 / 1024).toFixed(1)}MB.`;
  }
  return null;
}

export async function generatePresignedUrl(mimeType: string, fileSize: number) {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucket) throw new Error('R2_BUCKET_NAME env var is missing');
  if (!publicUrl) throw new Error('R2_PUBLIC_URL env var is missing');

  const ext = EXT_BY_MIME[mimeType] || 'bin';
  const key = `uploads/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  const s3 = getClient();
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const filePublicUrl = `${publicUrl}/${key}`;

  return { uploadUrl, publicUrl: filePublicUrl, key };
}

export async function deleteFile(key: string) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME env var is missing');
  const s3 = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
