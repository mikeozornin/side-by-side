import { NotificationConfig, NotificationData, NotificationResult } from '../types.js';

export abstract class NotificationProvider {
  protected config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  abstract send(data: NotificationData): Promise<NotificationResult>;
  abstract validate(): boolean;
  abstract get name(): string;

  get isEnabled(): boolean {
    return this.config.enabled;
  }
}
