import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, RefreshCw, LogOut, X, AlertCircle, Sun, Moon, SunMoon } from 'lucide-react';
import { configManager } from '@/lib/config';
import { useWebPush } from '@/hooks/useWebPush';
import { useTheme } from '@/components/ThemeProvider';


export function Settings() {
  const { t, i18n } = useTranslation();
  const { user, accessToken, logout, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [figmaCode, setFigmaCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  
  // Web Push уведомления
  const {
    permission,
    isSupported,
    settings,
    isLoading: notificationsLoading,
    error: notificationsError,
    requestPermission,
    updateSettings,
  } = useWebPush();

  const handleLogout = async () => {
    await logout();
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const generateFigmaCode = async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${configManager.getApiUrl()}/auth/figma-code`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFigmaCode(data.code);
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('settings.figmaIntegration.errorGeneratingCode'));
      }
    } catch (error) {
      console.error('Error generating Figma code:', error);
      setError(t('settings.figmaIntegration.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!figmaCode) return;

    try {
      await navigator.clipboard.writeText(figmaCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  // Обработчики для уведомлений
  const handleNotificationPermission = async () => {
    await requestPermission();
  };

  const handleRefreshPermission = () => {
    // Принудительно обновляем состояние разрешений
    const permission = Notification.permission;
    console.log('Refreshed permission:', permission);
    // Перезагружаем страницу для обновления состояния
    window.location.reload();
  };

  const handleSettingChange = async (key: 'newVotings' | 'myVotingsComplete', value: boolean) => {
    await updateSettings({ [key]: value });
  };

  const handleLanguageChange = async (language: string) => {
    setCurrentLanguage(language);
    await i18n.changeLanguage(language);
    // Сохраняем в localStorage
    localStorage.setItem('i18nextLng', language);
  };

  const handleThemeChange = (newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme);
  };

  const getNotificationStatus = () => {
    if (!isSupported) {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        text: t('settings.notifications.notSupported'),
        color: 'text-muted-foreground',
        showButton: false,
      };
    }

    if (permission === 'denied') {
      return {
        icon: <X className="h-4 w-4" />,
        text: t('settings.notifications.permissionDenied'),
        color: 'text-red-600',
        showButton: true,
        buttonText: t('settings.notifications.configure'),
        buttonAction: () => {
          // Показываем инструкции для разных браузеров
          const userAgent = navigator.userAgent.toLowerCase();
          if (userAgent.includes('chrome')) {
            window.open('chrome://settings/content/notifications');
          } else if (userAgent.includes('safari')) {
            alert('Откройте Safari → Настройки → Сайты → Уведомления → localhost:5173 → Разрешить\n\nПосле изменения настроек нажмите "Обновить"');
          } else if (userAgent.includes('firefox')) {
            window.open('about:preferences#privacy');
          } else {
            alert('Откройте настройки браузера и разрешите уведомления для этого сайта');
          }
        },
        showRefreshButton: true,
        refreshButtonText: 'Обновить',
        refreshButtonAction: handleRefreshPermission,
      };
    }

    if (permission === 'granted') {
      return {
        icon: <Check className="h-4 w-4 text-green-600" />,
        text: t('settings.notifications.permissionGranted'),
        color: 'text-green-600',
        showButton: false,
      };
    }

    return {
      icon: null,
      text: t('settings.notifications.permissionRequired'),
      color: 'text-muted-foreground',
      showButton: true,
      buttonText: t('settings.notifications.allow'),
      buttonAction: handleNotificationPermission,
    };
  };


  // Проверяем авторизацию при изменении пользователя
  useEffect(() => {
    // Если загрузка завершена и пользователя нет - редиректим
    if (!authLoading && !user) {
      // Используем принудительный редирект
      window.location.href = '/';
      return;
    }
  }, [user, authLoading, navigate]);

  // Генерируем код при загрузке страницы
  useEffect(() => {
    if (accessToken && !figmaCode && user) {
      generateFigmaCode();
    }
  }, [accessToken, figmaCode, user]);

  // Синхронизируем состояние языка с i18n
  useEffect(() => {
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  // Показываем загрузку пока проверяется авторизация
  if (authLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{t('settings.loginRequired')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-3xl font-bold">{user.email}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoBack}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Интеграция с Figma */}
        <div>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-3">{t('settings.figmaIntegration.howToConnect')}</h4>
              <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                <li>{t('settings.figmaIntegration.step1')}</li>
                <li>{t('settings.figmaIntegration.step2')}</li>
                <li>
                  <span>{t('settings.figmaIntegration.step3')} </span>
                  {figmaCode ? (
                    <>
                      <code className="px-2 py-1 bg-background border rounded font-mono text-sm h-8 w-32 inline-block" style={{verticalAlign: 'middle'}}>{figmaCode}</code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                        disabled={copied}
                        className="h-8 w-8 p-0 ml-2"
                        style={{verticalAlign: 'middle'}}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateFigmaCode}
                        disabled={isLoading}
                        className="h-8 w-8 p-0 ml-1"
                        style={{verticalAlign: 'middle'}}
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateFigmaCode}
                      disabled={isLoading}
                      className="ml-2 h-8"
                      style={{verticalAlign: 'middle'}}
                    >
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">{t('settings.figmaIntegration.refresh')}</span>
                    </Button>
                  )}
                </li>
                <li>{t('settings.figmaIntegration.step4')}</li>
              </ol>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Уведомления */}
        <div>
          <div className="space-y-4">
            <h4 className="font-medium">{t('settings.notifications.title')}</h4>
            
            {/* Статус разрешений */}
            <div className="flex items-center gap-2 text-sm">
              {(() => {
                const status = getNotificationStatus();
                return (
                  <>
                    {status.icon}
                    <span className={status.color}>{status.text}</span>
                    {status.showButton && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={status.buttonAction}
                        className="h-7 px-3 ml-2"
                        disabled={notificationsLoading}
                      >
                        {status.buttonText}
                      </Button>
                    )}
                    {status.showRefreshButton && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={status.refreshButtonAction}
                        className="h-7 px-3 ml-2"
                        disabled={notificationsLoading}
                      >
                        {status.refreshButtonText}
                      </Button>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Switch'и для настроек */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="myVotingsComplete"
                  checked={settings.myVotingsComplete || false}
                  onCheckedChange={(value) => handleSettingChange('myVotingsComplete', value)}
                  disabled={permission !== 'granted' || notificationsLoading}
                />
                <Label 
                  htmlFor="myVotingsComplete"
                  className={`text-sm font-medium cursor-pointer ${
                    permission !== 'granted' || notificationsLoading 
                      ? 'text-muted-foreground cursor-not-allowed' 
                      : ''
                  }`}
                  onClick={() => {
                    if (permission === 'granted' && !notificationsLoading) {
                      handleSettingChange('myVotingsComplete', !(settings.myVotingsComplete || false));
                    }
                  }}
                >
                  {t('settings.notifications.myVotingsComplete.label')}
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="newVotings"
                  checked={settings.newVotings || false}
                  onCheckedChange={(value) => handleSettingChange('newVotings', value)}
                  disabled={permission !== 'granted' || notificationsLoading}
                />
                <Label 
                  htmlFor="newVotings"
                  className={`text-sm font-medium cursor-pointer ${
                    permission !== 'granted' || notificationsLoading 
                      ? 'text-muted-foreground cursor-not-allowed' 
                      : ''
                  }`}
                  onClick={() => {
                    if (permission === 'granted' && !notificationsLoading) {
                      handleSettingChange('newVotings', !(settings.newVotings || false));
                    }
                  }}
                >
                  {t('settings.notifications.newVotings.label')}
                </Label>
              </div>
            </div>

            {/* Ошибки уведомлений */}
            {notificationsError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{notificationsError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Настройки языка */}
        <div>
          <div className="space-y-4">
            <h4 className="font-medium">{t('settings.preferences.title')}</h4>
            
            <div className="space-y-2">
              <Label htmlFor="language-select" className="text-sm font-medium">
                {t('settings.preferences.language.label')}
              </Label>
              <Select value={currentLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger id="language-select" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">
                    {t('settings.preferences.language.options.en')}
                  </SelectItem>
                  <SelectItem value="ru">
                    {t('settings.preferences.language.options.ru')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme-select" className="text-sm font-medium">
                {t('settings.preferences.theme.label')}
              </Label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme-select" className="w-48">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {theme === 'system' && <SunMoon className="h-4 w-4" />}
                      {theme === 'light' && <Sun className="h-4 w-4" />}
                      {theme === 'dark' && <Moon className="h-4 w-4" />}
                      {theme === 'system' && t('settings.preferences.theme.options.system')}
                      {theme === 'light' && t('settings.preferences.theme.options.light')}
                      {theme === 'dark' && t('settings.preferences.theme.options.dark')}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <SunMoon className="h-4 w-4" />
                      {t('settings.preferences.theme.options.system')}
                    </div>
                  </SelectItem>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      {t('settings.preferences.theme.options.light')}
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      {t('settings.preferences.theme.options.dark')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        
      </div>

      {/* Кнопка выхода внизу страницы */}
      <div className="mt-12">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="ml-2">{t('settings.logout')}</span>
        </Button>
      </div>
    </div>
  );
}
