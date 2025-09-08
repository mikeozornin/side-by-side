import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NotificationDemoProps {
  isSupported: boolean;
  permission: NotificationPermission;
  onRequestPermission: () => Promise<void>;
}

export function NotificationDemo({ 
  isSupported, 
  permission, 
  onRequestPermission 
}: NotificationDemoProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      await onRequestPermission();
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = () => {
    if (permission === 'granted') {
      new Notification('Тестовое уведомление', {
        body: 'Это тестовое уведомление от Side-by-Side',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'test-notification',
      });
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Уведомления не поддерживаются
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ваш браузер не поддерживает push-уведомления.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Тестирование уведомлений
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Статус: <span className="font-medium">
              {permission === 'granted' ? 'Разрешены' : 
               permission === 'denied' ? 'Заблокированы' : 'Не запрошены'}
            </span>
          </p>
          
          {permission !== 'granted' && (
            <Button 
              onClick={handleRequestPermission}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Запрашиваем...' : 'Разрешить уведомления'}
            </Button>
          )}
          
          {permission === 'granted' && (
            <Button 
              onClick={sendTestNotification}
              variant="outline"
              className="w-full"
            >
              Отправить тестовое уведомление
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
