import * as Minio from "minio";

/**
 * Configuration for connecting to a datalake (MinIO/S3)
 */
export interface DatalakeConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region?: string;
}

/**
 * Configuration for OpenHIM integration
 */
export interface OpenHIMConfig {
  apiURL: string;
  username: string;
  password: string;
  trustSelfSigned?: boolean;
  mediatorUrn: string;
}

/**
 * Combined configuration for the datalake library
 */
export interface DatalakeLibConfig {
  datalake: DatalakeConfig;
  openhim?: OpenHIMConfig;
  logger?: Logger;
}

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Options for file upload operations
 */
export interface UploadOptions {
  bucket: string;
  createBucketIfNotExists?: boolean;
  registerWithOpenHIM?: boolean;
  customMetadata?: Record<string, string>;
}

/**
 * Result of an upload operation
 */
export interface UploadResult {
  success: boolean;
  message: string;
  objectName?: string;
  bucket?: string;
}

/**
 * Result of a file existence check
 */
export interface FileExistsResult {
  exists: boolean;
  success: boolean;
  message: string;
}

/**
 * Event emitted when a file is uploaded
 */
export interface UploadEvent {
  bucket: string;
  file: string;
  mimeType: string;
  metadata: Record<string, string>;
  timestamp: Date;
  source?: string;
}

/**
 * Event emitted when a bucket notification is received
 */
export interface BucketNotificationEvent {
  bucket: string;
  file: string;
  eventType: string;
}

/**
 * Context passed to file processors
 */
export interface ProcessorContext {
  bucket: string;
  file: string;
  buffer: Buffer;
  mimeType: string;
  metadata: Record<string, string>;
}

/**
 * Interface for file processors that handle bucket notifications
 */
export interface FileProcessor {
  /** Return true if this processor can handle the file */
  canProcess(file: string, mimeType: string): boolean;
  /** Process the file */
  process(context: ProcessorContext): Promise<void>;
}

/**
 * Bucket configuration from OpenHIM mediator config
 */
export interface BucketRegistryEntry {
  bucket: string;
  region?: string;
  url?: string;
  fileName?: string;
  authToken?: string;
}

/**
 * OpenHIM Mediator configuration structure
 */
export interface MediatorConfig {
  urn: string;
  version: string;
  name: string;
  description: string;
  defaultChannelConfig: any[];
  endpoints?: any[];
  configDefs?: any[];
  config?: {
    minio_buckets_registry?: BucketRegistryEntry[];
  };
}
