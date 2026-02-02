import * as Minio from "minio";
import { DownloadOptions, DownloadResult, Logger } from "../types";
import { defaultLogger } from "./client";
import { BucketManager } from "./bucket";

/**
 * Service for downloading files from the datalake
 */
export class DownloadService {
  constructor(
    private client: Minio.Client,
    private bucketManager: BucketManager,
    private logger: Logger = defaultLogger,
  ) {}

  /**
   * Downloads a file from the datalake as a Buffer
   * @param bucket - Bucket name
   * @param fileName - Name of the file to download
   * @param options - Download options
   * @returns Download result with buffer
   */
  async downloadToBuffer(
    bucket: string,
    fileName: string,
    options: DownloadOptions = {},
  ): Promise<DownloadResult> {
    try {
      // Check if file exists
      const existsCheck = await this.bucketManager.checkFileExists(
        bucket,
        fileName,
      );

      if (!existsCheck.exists) {
        return {
          success: false,
          message: existsCheck.message,
        };
      }

      this.logger.info(`Downloading file ${fileName} from bucket ${bucket}`);

      // Get the object as a stream
      const stream = await this.client.getObject(bucket, fileName);

      // Collect stream chunks into a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      // Get object metadata
      const stats = await this.client.statObject(bucket, fileName);
      const metadata: Record<string, string> = {};
      if (stats.metaData) {
        for (const [key, value] of Object.entries(stats.metaData)) {
          metadata[key] = String(value);
        }
      }

      const successMessage = `File ${fileName} downloaded from bucket ${bucket}`;
      this.logger.info(successMessage);

      return {
        success: true,
        message: successMessage,
        buffer,
        metadata,
        size: stats.size,
        lastModified: stats.lastModified,
        etag: stats.etag,
      };
    } catch (error) {
      const errorMessage = `Error downloading file: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Downloads a file from the datalake to a local path
   * @param bucket - Bucket name
   * @param fileName - Name of the file to download
   * @param destPath - Destination path on local filesystem
   * @param options - Download options
   * @returns Download result
   */
  async downloadToPath(
    bucket: string,
    fileName: string,
    destPath: string,
    options: DownloadOptions = {},
  ): Promise<DownloadResult> {
    try {
      // Check if file exists
      const existsCheck = await this.bucketManager.checkFileExists(
        bucket,
        fileName,
      );

      if (!existsCheck.exists) {
        return {
          success: false,
          message: existsCheck.message,
        };
      }

      this.logger.info(
        `Downloading file ${fileName} from bucket ${bucket} to ${destPath}`,
      );

      // Download to file
      await this.client.fGetObject(bucket, fileName, destPath);

      // Get object metadata
      const stats = await this.client.statObject(bucket, fileName);
      const metadata: Record<string, string> = {};
      if (stats.metaData) {
        for (const [key, value] of Object.entries(stats.metaData)) {
          metadata[key] = String(value);
        }
      }

      const successMessage = `File ${fileName} downloaded from bucket ${bucket} to ${destPath}`;
      this.logger.info(successMessage);

      return {
        success: true,
        message: successMessage,
        destPath,
        metadata,
        size: stats.size,
        lastModified: stats.lastModified,
        etag: stats.etag,
      };
    } catch (error) {
      const errorMessage = `Error downloading file: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Gets a presigned URL for downloading a file
   * @param bucket - Bucket name
   * @param fileName - Name of the file
   * @param expirySeconds - URL expiry time in seconds (default: 7 days)
   * @returns Presigned URL or null on error
   */
  async getPresignedUrl(
    bucket: string,
    fileName: string,
    expirySeconds: number = 7 * 24 * 60 * 60,
  ): Promise<string | null> {
    try {
      const url = await this.client.presignedGetObject(
        bucket,
        fileName,
        expirySeconds,
      );
      this.logger.debug(`Generated presigned URL for ${fileName}`);
      return url;
    } catch (error) {
      this.logger.error(
        `Error generating presigned URL: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
