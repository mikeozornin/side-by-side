// Мок для mailer утилиты
export const mockSendMagicLink = () => Promise.resolve(true);

// Мок для NotificationService
export const mockNotificationService = () => ({
  sendVotingCreatedNotification: () => Promise.resolve(true)
});
