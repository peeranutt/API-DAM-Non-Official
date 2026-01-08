import * as path from 'path';
import * as fs from 'fs';

export enum StorageLocation {
  STORAGE1 = 'DAM_STORAGE1',
  STORAGE2 = 'DAM_STORAGE2',
}

export const DEFAULT_STORAGE = StorageLocation.STORAGE1;

export class StorageConfig {
  private static storageUsage = new Map<string, number>();

  /**
   * Get the base directory for a storage location
   */
  static getStorageDir(location: StorageLocation): string {
    return path.join(process.cwd(), location);
  }

  /**
   * Get the uploads directory within a storage location
   */
  static getUploadsDir(location: StorageLocation): string {
    return path.join(this.getStorageDir(location), 'uploads');
  }

  /**
   * Get the thumbnails directory within a storage location
   */
  static getThumbnailsDir(location: StorageLocation): string {
    return path.join(this.getUploadsDir(location), 'thumbnails');
  }

  /**
   * Ensure all necessary directories exist for a storage location
   */
  static async ensureDirectories(location: StorageLocation): Promise<void> {
    const dirs = [
      this.getStorageDir(location),
      this.getUploadsDir(location),
      this.getThumbnailsDir(location),
    ];

    for (const dir of dirs) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Get available storage space (mock implementation - you can enhance this)
   */
  static async getAvailableSpace(location: StorageLocation): Promise<number> {
    // This is a simplified implementation
    // You can enhance this to check actual disk space
    return this.storageUsage.get(location) || 0;
  }

  /**
   * Select storage location based on available space or manual selection
   */
  static async selectStorage(
    preferredLocation?: StorageLocation,
  ): Promise<StorageLocation> {
    if (preferredLocation) {
      await this.ensureDirectories(preferredLocation);
      return preferredLocation;
    }

    // Default to storage1
    const defaultLocation = DEFAULT_STORAGE;
    await this.ensureDirectories(defaultLocation);
    return defaultLocation;
  }

  /**
   * Get relative path from storage root
   */
  static getRelativePath(
    location: StorageLocation,
    fullPath: string,
  ): string {
    const storageDir = this.getStorageDir(location);
    return path.relative(storageDir, fullPath);
  }

  /**
   * Parse storage location from path
   */
  static parseStorageFromPath(filePath: string): StorageLocation | null {
    if (filePath.startsWith('DAM_STORAGE1/')) {
      return StorageLocation.STORAGE1;
    } else if (filePath.startsWith('DAM_STORAGE2/')) {
      return StorageLocation.STORAGE2;
    }
    return null;
  }

  /**
   * Get full path from stored relative path
   */
  static getFullPath(relativePath: string): string {
    return path.join(process.cwd(), relativePath);
  }
}