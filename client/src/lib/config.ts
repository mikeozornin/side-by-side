// Конфигурация клиентского приложения

declare const __API_URL__: string;
declare const __CLIENT_URL__: string;

export interface ClientConfig {
  apiUrl: string;
  clientUrl: string;
  mode: 'development' | 'production';
}

class ConfigManager {
  private config: ClientConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ClientConfig {
    // В dev режиме используем переменные из Vite
    // В prod режиме определяем по URL
    const isDev = import.meta.env.DEV;
    
    if (isDev) {
      return {
        apiUrl: __API_URL__ || 'http://localhost:3000/api',
        clientUrl: __CLIENT_URL__ || 'http://localhost:5173',
        mode: 'development'
      };
    } else {
      // В продакшне API и клиент на одном домене
      const baseUrl = window.location.origin;
      return {
        apiUrl: `${baseUrl}/api`,
        clientUrl: baseUrl,
        mode: 'production'
      };
    }
  }

  // Получить текущую конфигурацию
  getConfig(): ClientConfig {
    return { ...this.config };
  }

  // Получить URL для API запросов
  getApiUrl(): string {
    return this.config.apiUrl;
  }

  // Получить URL для клиентской части
  getClientUrl(): string {
    return this.config.clientUrl;
  }

  // Сформировать полный URL для голосования
  getVotingUrl(votingId: string): string {
    return `${this.config.clientUrl}/#/voting/${votingId}`;
  }

  // Проверить, является ли режим разработки
  isDevelopment(): boolean {
    return this.config.mode === 'development';
  }

  // Проверить, является ли режим продакшн
  isProduction(): boolean {
    return this.config.mode === 'production';
  }
}

// Экспортируем глобальный экземпляр
export const configManager = new ConfigManager();
