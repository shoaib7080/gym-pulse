import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StorageService, UploadTarget } from './storage.interface';

export const ALLOWED_PROOF_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly baseDir: string;

  constructor() {
    // Local directory for file storage during development and local testing
    this.baseDir = path.resolve(process.cwd(), '.storage');
  }

  /**
   * Generates a constrained, server-determined storage key.
   * Pattern: gyms/{gymId}/freezes/{freezeId}/{uuid}.{ext}
   * Disallows client-supplied keys to prevent path traversal and cross-tenant pollution.
   */
  async createUploadTarget(
    gymId: string,
    freezeId: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<UploadTarget> {
    if (!ALLOWED_PROOF_MIMES.has(mimeType)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `MIME type '${mimeType}' is not permitted. Allowed types: application/pdf, image/jpeg, image/png`,
      });
    }

    if (sizeBytes > MAX_PROOF_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds the 5 MB maximum limit (${sizeBytes} bytes provided)`,
      });
    }

    const ext = MIME_EXTENSION_MAP[mimeType] || '';
    const fileUuid = randomUUID();
    const storageKey = `gyms/${gymId}/freezes/${freezeId}/${fileUuid}${ext}`;

    // TODO: In production with UAE Region Private Object Storage (AWS S3 me-central-1 or GCS me-central1):
    // Generate a presigned PUT URL using AWS SDK v3 S3Client / @aws-sdk/s3-request-presigner
    // with exact Content-Type, Content-Length, and ServerSideEncryption: 'AES256'.

    return {
      storageKey,
      uploadUrl: `/v1/uploads/${storageKey}`,
      maxSizeBytes: MAX_PROOF_SIZE_BYTES,
      allowedMimeTypes: Array.from(ALLOWED_PROOF_MIMES),
    };
  }

  /**
   * Saves buffer to local disk and returns server-computed SHA-256 hash
   */
  async saveFile(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ sha256: string; sizeBytes: number }> {
    if (!ALLOWED_PROOF_MIMES.has(mimeType)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `MIME type '${mimeType}' is not allowed`,
      });
    }

    if (buffer.length > MAX_PROOF_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds 5 MB limit',
      });
    }

    const sha256 = createHash('sha256').update(buffer).digest('hex');

    // Secure local path resolution
    const sanitizedKey = storageKey.replace(/\\/g, '/');
    const fullPath = path.join(this.baseDir, sanitizedKey);

    // Prevent directory traversal
    if (!fullPath.startsWith(this.baseDir)) {
      throw new BadRequestException({
        code: 'INVALID_STORAGE_KEY',
        message: 'Invalid storage key path',
      });
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return {
      sha256,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Deletes physical file from storage
   */
  async delete(storageKey: string): Promise<boolean> {
    try {
      const sanitizedKey = storageKey.replace(/\\/g, '/');
      const fullPath = path.join(this.baseDir, sanitizedKey);

      if (!fullPath.startsWith(this.baseDir)) {
        return false;
      }

      await fs.unlink(fullPath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // File already deleted or doesn't exist
        return true;
      }
      this.logger.warn(`Failed to delete file at storage key '${storageKey}': ${err.message}`);
      return false;
    }
  }

  /**
   * Generates a short-lived download URL or path
   */
  async getDownloadUrl(storageKey: string, expiresInSeconds = 300): Promise<string> {
    // TODO: In cloud bucket implementation, return S3 presigned GET URL with expires in 300s
    return `/v1/storage/download?key=${encodeURIComponent(storageKey)}&expires=${Date.now() + expiresInSeconds * 1000}`;
  }
}
