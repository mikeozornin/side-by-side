import ru from './locales/ru.json' assert { type: 'json' };
import en from './locales/en.json' assert { type: 'json' };

const locales = {
  ru,
  en
};

type Locale = keyof typeof locales;
type LocaleKey = string;

class I18n {
  private currentLocale: Locale;

  constructor() {
    // Инициализируем локаль из ENV переменной
    const envLocale = process.env.NOTIFICATIONS_LOCALE as Locale;
    this.currentLocale = (envLocale && locales[envLocale]) ? envLocale : 'ru';
  }

  setLocale(locale: Locale): void {
    this.currentLocale = locale;
  }

  getLocale(): Locale {
    return this.currentLocale;
  }

  t(key: LocaleKey, params: Record<string, any> = {}): string {
    const keys = key.split('.');
    let value: any = locales[this.currentLocale];

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key "${key}" not found for locale "${this.currentLocale}"`);
      return key;
    }

    // Заменяем плейсхолдеры
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match;
    });
  }
}

export const i18n = new I18n();
export type { Locale, LocaleKey };
