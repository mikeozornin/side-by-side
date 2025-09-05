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
  };
}

export class ConfigManager {
  private config: ServerConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ServerConfig {
    return {
      mode: (process.env.SERVER_MODE as 'development' | 'production') || 'development',
      port: parseInt(process.env.PORT || '3000'),
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      votingBaseUrl: process.env.VOTING_BASE_URL || 'http://localhost:5173',
      dataDir: process.env.DATA_DIR || './data',
      logDir: process.env.LOG_DIR || './logs',
      dbPath: process.env.DB_PATH || './app.db',
      rateLimit: {
        votingPerMinute: parseInt(process.env.RATE_LIMIT_VOTING_PER_MINUTE || '6'),
        votingPerHour: parseInt(process.env.RATE_LIMIT_VOTING_PER_HOUR || '60')
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

  // Сформировать полный URL для голосования
  getVotingUrl(votingId: string): string {
    if (this.isDevelopment()) {
      // В dev режиме используем клиентский URL с хешем
      return `${this.config.votingBaseUrl}/#/voting/${votingId}`;
    } else {
      // В prod режиме используем базовый URL с хешем
      return `${this.config.baseUrl}/#/voting/${votingId}`;
    }
  }

  // Получить CORS origins для текущего режима
  getCorsOrigins(): string[] {
    if (this.isDevelopment()) {
      return [
        'http://localhost:5173', // Vite dev server
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

  // Более безопасная функция для проверки CORS origin
  getCorsOriginFunction(): (origin: string, c?: any) => string | undefined {
    return (origin: string, c?: any) => {
      const allowedOrigins = this.getCorsOrigins();

      // Прямое совпадение с разрешенными origins
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Специальная обработка для null origin (Figma плагин)
      if (origin === 'null') {
        // Проверяем User-Agent для дополнительной защиты
        if (c?.req?.header) {
          const userAgent = c.req.header('User-Agent');
          const figmaPluginHeader = c.req.header('X-Figma-Plugin');

          // Проверяем, что User-Agent содержит "Figma" И есть кастомный заголовок
          const hasValidUserAgent = userAgent && userAgent.includes('Figma');
          const hasValidHeader = figmaPluginHeader === 'SideBySide/1.0';

          if (hasValidUserAgent && hasValidHeader) {
            console.log(`✅ Valid Figma plugin CORS request - UA: "${userAgent}", Header: "${figmaPluginHeader}"`);
            return 'null';
          }

          // Логируем подозрительный запрос
          console.warn(`Blocked CORS request with null origin:`, {
            userAgent: userAgent,
            figmaPluginHeader: figmaPluginHeader,
            hasValidUserAgent: hasValidUserAgent,
            hasValidHeader: hasValidHeader
          });
          return undefined;
        }

        // Если контекст недоступен, разрешаем для обратной совместимости
        // (но это менее безопасно)
        return 'null';
      }

      // Для всех остальных origins - запрет
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
}

// Экспортируем глобальный экземпляр
export const configManager = new ConfigManager();
