export interface UploadTarget {
  storageKey: string;
  uploadUrl?: string;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}

export interface StorageService {
  /**
   * Generates a constrained, server-determined storage key and upload instructions.
   * Key pattern: gyms/{gymId}/freezes/{freezeId}/{uuid}
   */
  createUploadTarget(
    gymId: string,
    freezeId: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<UploadTarget>;

  /**
   * Saves or uploads file content, computing the SHA-256 hash server-side.
   */
  saveFile(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ sha256: string; sizeBytes: number }>;

  /**
   * Deletes a stored file by its server-generated storage key.
   */
  delete(storageKey: string): Promise<boolean>;

  /**
   * Generates a short-lived download URL or path.
   */
  getDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
