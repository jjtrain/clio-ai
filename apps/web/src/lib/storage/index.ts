/**
 * Pluggable file storage interface.
 * Swap backend by changing the implementation — UI code never touches storage directly.
 */

export interface StorageResult {
  url: string;
  thumbnailUrl?: string;
  key: string;
  size: number;
}

export interface StorageProvider {
  upload(file: Buffer, filename: string, mimeType: string, path: string): Promise<StorageResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

/**
 * Local/mock storage — stores files as data URIs.
 * Replace with S3, Supabase Storage, or Vercel Blob in production.
 */
class LocalStorageProvider implements StorageProvider {
  async upload(file: Buffer, filename: string, mimeType: string, path: string): Promise<StorageResult> {
    // In production: upload to S3/Supabase/Vercel Blob
    // For now: return a placeholder URL
    const key = `${path}/${Date.now()}-${filename}`;
    const url = `/api/files/${encodeURIComponent(key)}`;
    const isImage = mimeType.startsWith("image/");
    return {
      url,
      thumbnailUrl: isImage ? `${url}?w=200&h=200` : undefined,
      key,
      size: file.length,
    };
  }

  async delete(key: string): Promise<void> {
    // In production: delete from storage backend
    console.log(`[Storage] Delete: ${key}`);
  }

  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return `/api/files/${encodeURIComponent(key)}`;
  }
}

// Export singleton — swap this class to change storage backend
export const storage: StorageProvider = new LocalStorageProvider();
