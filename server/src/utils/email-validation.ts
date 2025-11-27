/**
 * Извлекает домен из email адреса
 * @param email Email адрес
 * @returns Домен email (часть после @)
 */
export function extractDomain(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) {
    throw new Error('Invalid email format');
  }
  return parts[1].toLowerCase();
}

/**
 * Проверяет, разрешен ли домен email согласно белому списку
 * Поддерживает поддомены: если разрешен example.com, то разрешены и mail.example.com, subdomain.example.com и т.д.
 * Проверка регистронезависимая (case-insensitive)
 * 
 * @param email Email адрес для проверки
 * @param allowedDomains Массив разрешенных доменов
 * @returns true если домен разрешен, false если нет
 */
export function isEmailDomainAllowed(email: string, allowedDomains: string[]): boolean {
  // Если список пустой, разрешаем все домены
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  const emailDomain = extractDomain(email);

  // Проверяем каждый разрешенный домен
  for (const allowedDomain of allowedDomains) {
    const allowedDomainLower = allowedDomain.toLowerCase().trim();
    
    // Точное совпадение (case-insensitive)
    if (emailDomain === allowedDomainLower) {
      return true;
    }
    
    // Проверка поддоменов: домен email должен заканчиваться на .example.com
    // Например, если разрешен example.com, то mail.example.com тоже разрешен
    if (emailDomain.endsWith('.' + allowedDomainLower)) {
      return true;
    }
  }

  return false;
}

