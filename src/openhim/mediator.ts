import axios, { AxiosError } from "axios";
import https from "https";
import {
  activateHeartbeat,
  fetchConfig,
  registerMediator,
} from "openhim-mediator-utils";
import {
  BucketRegistryEntry,
  Logger,
  MediatorConfig,
  OpenHIMConfig,
} from "../types";
import { defaultLogger } from "../datalake/client";

interface RequestOptions {
  username: string;
  password: string;
  apiURL: string;
  trustSelfSigned: boolean;
  urn: string;
}

/**
 * Service for interacting with OpenHIM
 */
export class OpenHIMService {
  private config: RequestOptions;
  private openhimConfig: BucketRegistryEntry[] = [];

  constructor(
    config: OpenHIMConfig,
    private logger: Logger = defaultLogger,
  ) {
    this.config = {
      username: config.username,
      password: config.password,
      apiURL: config.apiURL,
      trustSelfSigned: config.trustSelfSigned ?? true,
      urn: config.mediatorUrn,
    };
  }

  /**
   * Registers the mediator with OpenHIM and sets up heartbeat
   * @param mediatorConfig - Mediator configuration
   * @returns Promise that resolves when registration is complete
   */
  async setupMediator(mediatorConfig: MediatorConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      registerMediator(this.config, mediatorConfig, (error: Error) => {
        if (error) {
          this.logger.error(
            `Failed to register mediator: ${JSON.stringify(error)}`,
          );
          reject(error);
          return;
        }

        this.logger.info("Successfully registered mediator!");

        fetchConfig(this.config, (err: Error) => {
          if (err) {
            this.logger.error(
              `Failed to fetch initial config: ${JSON.stringify(err)}`,
            );
            reject(err);
            return;
          }

          const emitter = activateHeartbeat(this.config);

          emitter.on("error", (err: Error) => {
            this.logger.error(`Heartbeat failed: ${JSON.stringify(err)}`);
          });

          emitter.on("config", async (config: any) => {
            this.logger.debug("Received new configs from OpenHIM");
            this.openhimConfig = config.minio_buckets_registry || [];
          });

          resolve();
        });
      });
    });
  }

  /**
   * Gets the mediator configuration from OpenHIM
   * @returns Mediator configuration or null if not found
   */
  async getMediatorConfig(): Promise<MediatorConfig | null> {
    try {
      const response = await axios.get(
        `${this.config.apiURL}/mediators/${this.config.urn}`,
        {
          auth: {
            username: this.config.username,
            password: this.config.password,
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: !this.config.trustSelfSigned,
          }),
        },
      );

      return response.data;
    } catch (e) {
      const error = e as AxiosError;

      switch (error.response?.status) {
        case 401:
          this.logger.error(
            "Failed to authenticate with OpenHIM, check your credentials",
          );
          break;
        case 404:
          this.logger.debug("Mediator config not found in OpenHIM");
          break;
        default:
          this.logger.error(
            `Failed to fetch mediator config: ${error.message}`,
          );
          break;
      }
      return null;
    }
  }

  /**
   * Registers a bucket in the OpenHIM mediator configuration
   * @param bucket - Bucket name to register
   * @returns true if registration was successful
   */
  async registerBucket(bucket: string): Promise<boolean> {
    const mediatorConfig = await this.getMediatorConfig();

    if (!mediatorConfig) {
      this.logger.error(
        "Mediator config not found in OpenHIM, unable to register bucket",
      );
      return false;
    }

    const newBucket: BucketRegistryEntry = { bucket };
    const existingConfig = mediatorConfig.config;

    if (!existingConfig) {
      this.logger.info(
        "Mediator config does not have a config section, creating new config",
      );
      mediatorConfig.config = {
        minio_buckets_registry: [newBucket],
      };
      await this.putMediatorConfig([newBucket]);
    } else {
      const existingBucket = existingConfig.minio_buckets_registry?.find(
        (b) => b.bucket === bucket,
      );
      if (existingBucket) {
        this.logger.debug(`Bucket ${bucket} already exists in the config`);
        return false;
      }

      this.logger.info(`Adding bucket ${bucket} to OpenHIM config`);
      existingConfig.minio_buckets_registry =
        existingConfig.minio_buckets_registry || [];
      existingConfig.minio_buckets_registry.push(newBucket);
      await this.putMediatorConfig(existingConfig.minio_buckets_registry);
    }

    return true;
  }

  /**
   * Removes buckets from the OpenHIM mediator configuration
   * @param buckets - Bucket names to remove
   * @returns true if removal was successful
   */
  async removeBucket(buckets: string[]): Promise<boolean> {
    const mediatorConfig = await this.getMediatorConfig();

    if (!mediatorConfig?.config) {
      this.logger.error("Mediator config not found or has no config section");
      return false;
    }

    const updatedConfig = (
      mediatorConfig.config.minio_buckets_registry || []
    ).filter((b) => !buckets.includes(b.bucket));

    await this.putMediatorConfig(updatedConfig);
    return true;
  }

  /**
   * Gets the current OpenHIM bucket configuration
   */
  getOpenhimConfig(): BucketRegistryEntry[] {
    return [...this.openhimConfig];
  }

  /**
   * Updates the mediator configuration in OpenHIM
   */
  private async putMediatorConfig(
    buckets: BucketRegistryEntry[],
  ): Promise<void> {
    try {
      await axios.put(
        `${this.config.apiURL}/mediators/${this.config.urn}/config`,
        { minio_buckets_registry: buckets },
        {
          auth: {
            username: this.config.username,
            password: this.config.password,
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: !this.config.trustSelfSigned,
          }),
        },
      );
      this.logger.info("Successfully updated mediator config in OpenHIM");
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to update mediator config: ${axiosError.message}`,
      );
      throw error;
    }
  }
}
