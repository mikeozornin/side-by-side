// Утилиты для работы с конфигурацией сервера

export interface ServerConfig {
  mode: 'development' | 'production';
  port: number;
  baseUrl: string;
  votingBaseUrl: string;
  dataDir: string;
  logDir: string;
  dbPath: string;
  rateLimit: {
    votingPerMinute: number;
    votingPerHour: number;
    authMagicLinkPerMinute: number;
    authVerifyTokenPerMinute: number;
  };
  webPush: {
    enabled: boolean;
    vapidPublicKey: string;
    vapidPrivateKey: string;
    vapidEmail: string;
  };
}

export class ConfigManager {
  private config: ServerConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ServerConfig {
    const mode = (process.env.SERVER_MODE as 'development' | 'production') || 'development';
    return {
      mode,
      port: parseInt(process.env.PORT || '3000'),
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      votingBaseUrl: process.env.VOTING_BASE_URL || 'https://localhost:5173',
      dataDir: process.env.DATA_DIR || './data',
      logDir: process.env.LOG_DIR || './logs',
      dbPath: process.env.DB_PATH || './app.db',
      rateLimit: {
        votingPerMinute: parseInt(process.env.RATE_LIMIT_VOTING_PER_MINUTE || (mode === 'development' ? '100' : '6')),
        votingPerHour: parseInt(process.env.RATE_LIMIT_VOTING_PER_HOUR || (mode === 'development' ? '1000' : '60')),
        authMagicLinkPerMinute: parseInt(process.env.RATE_LIMIT_AUTH_MAGIC_LINK_PER_MINUTE || '5'),
        authVerifyTokenPerMinute: parseInt(process.env.RATE_LIMIT_AUTH_VERIFY_TOKEN_PER_MINUTE || '5')
      },
      webPush: {
        enabled: process.env.WEB_PUSH_ENABLED === 'true',
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
        vapidEmail: process.env.VAPID_EMAIL || 'mailto:admin@side-by-side.com'
      }
    };
  }

  // Получить текущую конфигурацию
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  // Проверить, является ли сервер в dev режиме
  isDevelopment(): boolean {
    return this.config.mode === 'development';
  }

  // Проверить, является ли сервер в prod режиме
  isProduction(): boolean {
    return this.config.mode === 'production';
  }

  // Получить URL для API запросов
  getApiUrl(): string {
    return this.config.baseUrl;
  }

  // Получить URL для клиентской части
  getClientUrl(): string {
    return this.config.votingBaseUrl;
  }

  getVotingUrl(votingOrId: { slug?: string | null; id: string } | string): string {
    const identifier = typeof votingOrId === 'string' 
      ? votingOrId 
      : (votingOrId.slug || votingOrId.id);
    
    if (this.isDevelopment()) {
      // В dev режиме используем клиентский URL с хешем
      return `${this.config.votingBaseUrl}/#/v/${identifier}`;
    } else {
      // В prod режиме используем базовый URL с хешем
      return `${this.config.baseUrl}/#/v/${identifier}`;
    }
  }

  // Получить CORS origins для текущего режима
  getCorsOrigins(): string[] {
    if (this.isDevelopment()) {
      return [
        'https://localhost:5173', // Vite dev server (HTTPS)
        'http://localhost:3000', // Server
        'null' // Figma plugin
      ];
    } else {
      return [
        this.config.baseUrl,
        'null' // Figma plugin
      ];
    }
  }

  private normalizeOrigin(origin: string): string {
    if (!origin) return origin;
    return origin.replace(/\/+$/, '');
  }

  getCorsOriginFunction(): (origin: string, c?: any) => string | undefined {
    return (origin: string, c?: any) => {
      const allowedOrigins = this.getCorsOrigins();
      const normalizedOrigin = this.normalizeOrigin(origin);

      for (const allowedOrigin of allowedOrigins) {
        if (this.normalizeOrigin(allowedOrigin) === normalizedOrigin) {
          return origin;
        }
      }

      if (origin === 'null' || origin === '') {
        // Для origin 'null' (Figma plugin) разрешаем если есть заголовок X-Figma-Plugin
        // или если это preflight запрос (OPTIONS)
        if (c?.req) {
          const figmaPluginHeader = c.req.header('X-Figma-Plugin');
          const hasValidHeader = figmaPluginHeader === 'SideBySide/1.0';
          const isOptions = c.req.method === 'OPTIONS';

          // Разрешаем для OPTIONS (preflight) или если есть валидный заголовок
          if (hasValidHeader || isOptions) {
            return 'null';
          }
        }

        return undefined;
      }

      return undefined;
    };
  }

  // Получить настройки для статических файлов
  getStaticConfig() {
    if (this.isProduction()) {
      return {
        serveStatic: true,
        staticPath: '../frontend',
        fallbackPath: '../frontend/index.html'
      };
    } else {
      return {
        serveStatic: false
      };
    }
  }

  // Получить конфигурацию Web Push
  getWebPushConfig() {
    return this.config.webPush;
  }

  // Проверить, включены ли Web Push уведомления
  isWebPushEnabled(): boolean {
    return this.config.webPush.enabled && 
           !!this.config.webPush.vapidPublicKey && 
           !!this.config.webPush.vapidPrivateKey;
  }
}

// Экспортируем глобальный экземпляр
export const configManager = new ConfigManager();
