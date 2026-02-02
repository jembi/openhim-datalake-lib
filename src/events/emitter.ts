import { EventEmitter } from "events";
import { BucketNotificationEvent, UploadEvent } from "../types";

/**
 * Event emitter for cross-mediator communication
 * Extends Node's EventEmitter with typed events
 */
export class MediatorEventEmitter extends EventEmitter {
  /**
   * Emits an upload event when a file is uploaded
   * @param event - Upload event details
   */
  emitUpload(event: UploadEvent): void {
    this.emit("file:uploaded", event);
  }

  /**
   * Emits a bucket notification event
   * @param event - Bucket notification details
   */
  emitNotification(event: BucketNotificationEvent): void {
    this.emit("bucket:notification", event);
  }

  /**
   * Registers a listener for upload events
   * @param listener - Callback function for upload events
   */
  onUpload(listener: (event: UploadEvent) => void): this {
    return this.on("file:uploaded", listener);
  }

  /**
   * Registers a listener for bucket notification events
   * @param listener - Callback function for notification events
   */
  onNotification(listener: (event: BucketNotificationEvent) => void): this {
    return this.on("bucket:notification", listener);
  }
}

/**
 * Singleton event emitter instance for cross-mediator communication
 * All mediators using this library share the same event bus
 */
export const mediatorEvents = new MediatorEventEmitter();
