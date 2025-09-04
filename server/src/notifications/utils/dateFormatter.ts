/**
 * Форматирует дату в формат "До 9:36, 5 сен" без указания года
 */
export function formatExpirationDate(dateString: string): string {
  const date = new Date(dateString);
  
  // Проверяем валидность даты
  if (isNaN(date.getTime())) {
    return '';
  }
  
  const months = [
    'янв', 'фев', 'мар', 'апр', 'май', 'июн',
    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `До ${hours}:${minutes}, ${day} ${month}`;
}
