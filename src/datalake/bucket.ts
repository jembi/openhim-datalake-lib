import * as Minio from "minio";
import { FileExistsResult, Logger } from "../types";
import { BucketDoesNotExistError, defaultLogger } from "./client";

/**
 * Manages bucket operations for the datalake
 */
export class BucketManager {
  private registeredBuckets: Set<string> = new Set();

  constructor(
    private client: Minio.Client,
    private logger: Logger = defaultLogger,
  ) {}

  /**
   * Ensures a bucket exists, optionally creating it if it doesn't
   * @param bucket - Bucket name
   * @param createIfNotExists - Whether to create the bucket if it doesn't exist
   * @throws BucketDoesNotExistError if bucket doesn't exist and createIfNotExists is false
   */
  async ensureExists(bucket: string, createIfNotExists = false): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucket);

      if (!exists && createIfNotExists) {
        await this.client.makeBucket(bucket);
        this.logger.info(`Bucket ${bucket} created`);
      }

      if (!exists && !createIfNotExists) {
        throw new BucketDoesNotExistError(bucket);
      }

      this.registeredBuckets.add(bucket);
    } catch (error) {
      this.logger.error(`Error ensuring bucket ${bucket} exists: ${error}`);
      throw error;
    }
  }

  /**
   * Checks if a file exists in the specified bucket
   * @param bucket - Bucket name
   * @param fileName - Name of the file to check
   * @param expectedMimeType - Optional expected MIME type
   * @returns FileExistsResult with existence status and message
   */
  async checkFileExists(
    bucket: string,
    fileName: string,
    expectedMimeType?: string,
  ): Promise<FileExistsResult> {
    try {
      const bucketExists = await this.client.bucketExists(bucket);
      if (!bucketExists) {
        return {
          exists: false,
          success: false,
          message: `Bucket ${bucket} does not exist`,
        };
      }

      const stats = await this.client.statObject(bucket, fileName);
      const mimeTypeMatches = expectedMimeType
        ? stats.metaData?.["content-type"] === expectedMimeType
        : true;

      if (!mimeTypeMatches) {
        return {
          exists: false,
          success: true,
          message: `File ${fileName} exists in bucket ${bucket} but has different MIME type (expected: ${expectedMimeType}, actual: ${stats.metaData?.["content-type"]})`,
        };
      }

      return {
        exists: true,
        success: true,
        message: `File ${fileName} exists in bucket ${bucket}`,
      };
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === "NotFound") {
        return {
          exists: false,
          success: true,
          message: `File ${fileName} not found in bucket ${bucket}`,
        };
      }

      this.logger.error("Error checking file existence:", error);
      return {
        exists: false,
        success: false,
        message: `Error checking file existence: ${error.message}`,
      };
    }
  }

  /**
   * Gets the set of registered buckets
   */
  getRegisteredBuckets(): Set<string> {
    return new Set(this.registeredBuckets);
  }

  /**
   * Validates a bucket name according to S3/MinIO naming rules
   * @param name - Bucket name to validate
   * @returns true if the name is valid
   */
  static validateName(name: string): boolean {
    if (!name || name.length < 3 || name.length > 63) {
      return false;
    }

    // Must start with lowercase letter or number
    if (!/^[a-z0-9]/.test(name)) {
      return false;
    }

    // Must end with lowercase letter or number
    if (!/[a-z0-9]$/.test(name)) {
      return false;
    }

    // Can only contain lowercase letters, numbers, dots, and hyphens
    if (!/^[a-z0-9.-]+$/.test(name)) {
      return false;
    }

    // Must not start with xn--
    if (name.startsWith("xn--")) {
      return false;
    }

    // Must not end with -s3alias
    if (name.endsWith("-s3alias")) {
      return false;
    }

    // Must not contain consecutive dots
    if (name.includes("..")) {
      return false;
    }

    return true;
  }

  /**
   * Sanitizes a string to create a valid bucket name
   * @param name - String to sanitize
   * @returns Valid bucket name
   */
  static sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+|-+$/g, "")
      .replace(/\.{2,}/g, ".")
      .substring(0, 63);
  }
}
