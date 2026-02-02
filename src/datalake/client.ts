import * as Minio from "minio";
import { DatalakeConfig, Logger } from "../types";

/**
 * Default console logger implementation
 */
const defaultLogger: Logger = {
  debug: (msg, ...args) => console.debug(msg, ...args),
  info: (msg, ...args) => console.info(msg, ...args),
  warn: (msg, ...args) => console.warn(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
};

/**
 * Creates a MinIO/S3 client with the provided configuration
 * @param config - Datalake connection configuration
 * @returns Configured MinIO client instance
 */
export function createDatalakeClient(config: DatalakeConfig): Minio.Client {
  return new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
}

/**
 * Error thrown when a bucket does not exist and auto-creation is disabled
 */
export class BucketDoesNotExistError extends Error {
  constructor(bucket: string) {
    super(`Bucket ${bucket} does not exist`);
    this.name = "BucketDoesNotExistError";
  }
}

export { defaultLogger };
