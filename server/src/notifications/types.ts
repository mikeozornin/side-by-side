export interface NotificationConfig {
  enabled: boolean;
  webhookUrl?: string;
  [key: string]: any;
}

export interface NotificationData {
  title: string;
  votingId: string;
  votingUrl: string;
  createdAt: string;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  provider: string;
}
