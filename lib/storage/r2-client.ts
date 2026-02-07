/**
 * Cloudflare R2 Storage Client
 * Compatible with AWS S3 API
 *
 * Features:
 * - Upload files to R2
 * - Generate public URLs
 * - Generate presigned URLs (for temporary access)
 * - Delete files
 * - List files
 */

// Load environment variables if not in production
if (process.env.NODE_ENV !== 'production' && !process.env.R2_ACCOUNT_ID) {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- dynamic conditional loading at runtime */
    const dotenv = require('dotenv');
    const path = require('path');
    /* eslint-enable @typescript-eslint/no-require-imports */
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  } catch {
    // dotenv not available, environment variables must be set externally
  }
}

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ===========================
// Configuration
// ===========================

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Optional

// Validate required environment variables (only when actually used, not during import)
const hasR2Config = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);

function validateR2Config() {
  if (!hasR2Config) {
    throw new Error('Missing R2 environment variables. Check .env.local for R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME');
  }
}

// S3 Client configured for R2 (lazy-initialized)
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  validateR2Config();

  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return r2Client;
}

// ===========================
// Types
// ===========================

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

// ===========================
// Upload Functions
// ===========================

/**
 * Upload a file to R2
 * @param key - The file key/path in R2 (e.g., "documents/1/uuid-file.pdf")
 * @param buffer - File content as Buffer
 * @param options - Upload options (contentType, cacheControl, metadata)
 * @returns Upload result with key and URL
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { contentType, cacheControl, metadata } = options;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: cacheControl || 'public, max-age=31536000', // 1 year default
    Metadata: metadata,
  });

  await getR2Client().send(command);

  return {
    key,
    url: getPublicR2Url(key),
    size: buffer.length,
  };
}

/**
 * Upload a file from a local path (server-side only)
 * Useful for migration scripts
 */
export async function uploadFileFromPath(
  key: string,
  filePath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const fs = await import('fs/promises');
  const buffer = await fs.readFile(filePath);
  return uploadToR2(key, buffer, options);
}

// ===========================
// URL Generation
// ===========================

/**
 * Get public URL for a file
 * Uses R2_PUBLIC_URL if set, otherwise generates default R2 URL
 * @param key - The file key in R2
 * @returns Public URL
 */
export function getPublicR2Url(key: string): string {
  if (R2_PUBLIC_URL) {
    // Use custom domain or public URL from env
    return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }

  // Default R2 public URL (requires public bucket or dev URL enabled)
  return `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;
}

/**
 * Generate a presigned URL for temporary access
 * Useful for:
 * - Private documents (enrollment-based access)
 * - Upload URLs (direct browser upload)
 * - Download URLs with expiration
 *
 * @param key - The file key in R2
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @param operation - 'GET' for download, 'PUT' for upload
 * @returns Presigned URL
 */
export async function getSignedR2Url(
  key: string,
  expiresIn: number = 3600,
  operation: 'GET' | 'PUT' = 'GET'
): Promise<string> {
  const command = operation === 'PUT'
    ? new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
    : new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });

  return await getSignedUrl(getR2Client(), command, { expiresIn });
}

/**
 * Generate a presigned upload URL
 * Allows browser to upload directly to R2 without going through server
 *
 * @param key - The file key in R2
 * @param expiresIn - Expiration time in seconds
 * @param contentType - MIME type of the file
 * @returns Presigned upload URL
 */
export async function generatePresignedUploadUrl(
  key: string,
  expiresIn: number = 3600,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(getR2Client(), command, { expiresIn });
}

// ===========================
// Download Functions
// ===========================

/**
 * Download a file from R2 as Buffer
 * @param key - The file key in R2
 * @returns File content as Buffer
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await getR2Client().send(command);

  if (!response.Body) {
    throw new Error(`File not found: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Check if a file exists in R2
 * @param key - The file key in R2
 * @returns true if exists, false otherwise
 */
export async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await getR2Client().send(command);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

// ===========================
// Delete Functions
// ===========================

/**
 * Delete a file from R2
 * @param key - The file key in R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await getR2Client().send(command);
}

/**
 * Delete multiple files from R2
 * @param keys - Array of file keys
 */
export async function deleteMultipleFromR2(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => deleteFromR2(key)));
}

// ===========================
// List Functions
// ===========================

/**
 * List files in R2 by prefix
 * @param prefix - Prefix to filter files (e.g., "documents/1/")
 * @param maxKeys - Maximum number of keys to return (default: 1000)
 * @returns Array of file keys
 */
export async function listR2Files(
  prefix: string = '',
  maxKeys: number = 1000
): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await getR2Client().send(command);
  return response.Contents?.map(item => item.Key!) || [];
}

/**
 * List files with metadata
 */
export async function listR2FilesWithMetadata(
  prefix: string = '',
  maxKeys: number = 1000
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await getR2Client().send(command);

  return response.Contents?.map(item => ({
    key: item.Key!,
    size: item.Size || 0,
    lastModified: item.LastModified || new Date(),
  })) || [];
}

// ===========================
// Copy/Move Functions
// ===========================

/**
 * Copy a file within R2
 * Useful for creating backups or versioning
 * @param sourceKey - Source file key
 * @param destinationKey - Destination file key
 */
export async function copyR2File(
  sourceKey: string,
  destinationKey: string
): Promise<void> {
  const command = new CopyObjectCommand({
    Bucket: R2_BUCKET_NAME,
    CopySource: `${R2_BUCKET_NAME}/${sourceKey}`,
    Key: destinationKey,
  });

  await getR2Client().send(command);
}

/**
 * Move a file within R2 (copy + delete)
 * @param sourceKey - Source file key
 * @param destinationKey - Destination file key
 */
export async function moveR2File(
  sourceKey: string,
  destinationKey: string
): Promise<void> {
  await copyR2File(sourceKey, destinationKey);
  await deleteFromR2(sourceKey);
}

// ===========================
// Utility Functions
// ===========================

/**
 * Generate a structured R2 key for documents
 * @param courseId - Course ID
 * @param fileName - Original file name
 * @param uniqueId - Unique identifier (UUID)
 * @returns Structured key (e.g., "documents/1/uuid-filename.pdf")
 */
export function generateDocumentKey(
  courseId: string,
  fileName: string,
  uniqueId: string
): string {
  // Sanitize filename
  const sanitized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-');

  return `documents/${courseId}/${uniqueId}-${sanitized}`;
}

/**
 * Get file extension from key
 */
export function getFileExtension(key: string): string {
  return key.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    txt: 'text/plain',
    html: 'text/html',
    json: 'application/json',
  };

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

// ===========================
// Export
// ===========================

const r2Module = {
  // Upload
  uploadToR2,
  uploadFileFromPath,

  // URLs
  getPublicR2Url,
  getSignedR2Url,
  generatePresignedUploadUrl,

  // Download
  downloadFromR2,
  fileExistsInR2,

  // Delete
  deleteFromR2,
  deleteMultipleFromR2,

  // List
  listR2Files,
  listR2FilesWithMetadata,

  // Copy/Move
  copyR2File,
  moveR2File,

  // Utilities
  generateDocumentKey,
  getFileExtension,
  getMimeType,
};
export default r2Module;
