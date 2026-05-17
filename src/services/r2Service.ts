import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

const IMAGE_MAX = 10 * 1024 * 1024;  // 10MB
const VIDEO_MAX = 60 * 1024 * 1024;  // 60MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export function validateFile(mimeType: string, fileSize: number): string | null {
  const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);

  if (!isImage && !isVideo) {
    return 'Only images (JPEG, PNG, WebP, GIF) and videos (MP4, WebM, MOV) are allowed.';
  }
  if (isImage && fileSize > IMAGE_MAX) {
    return `Image too large. Maximum size is 10MB. Your file is ${(fileSize / 1024 / 1024).toFixed(1)}MB.`;
  }
  if (isVideo && fileSize > VIDEO_MAX) {
    return `Video too large. Maximum size is 60MB. Your file is ${(fileSize / 1024 / 1024).toFixed(1)}MB.`;
  }
  return null;
}

export async function generatePresignedUrl(mimeType: string, fileSize: number) {
  const ext = mimeType.split('/')[1].replace('quicktime', 'mov');
  const key = `uploads/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
  const publicUrl = `${PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}

export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
