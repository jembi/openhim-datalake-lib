declare module "openhim-mediator-utils" {
  export interface OpenHIMConfig {
    username?: string;
    password?: string;
    apiURL: string;
    trustSelfSigned: boolean;
    urn: string;
  }

  export interface MediatorConfig {
    urn: string;
    version: string;
    name: string;
    description: string;
    defaultChannelConfig: any[];
    [key: string]: any;
  }

  export function registerMediator(
    options: OpenHIMConfig,
    mediatorConfig: MediatorConfig,
    callback: (err: Error) => void,
  ): void;

  export function fetchConfig(
    options: OpenHIMConfig,
    callback: (err: Error, config: any) => void,
  ): void;

  export function activateHeartbeat(
    options: OpenHIMConfig,
  ): import("events").EventEmitter;
}
