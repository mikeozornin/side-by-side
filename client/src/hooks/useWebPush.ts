import { useState, useEffect, useCallback } from 'react';
import { configManager } from '@/lib/config';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationSettings {
  newVotings: boolean;
  myVotingsComplete: boolean;
}

export interface WebPushState {
  permission: NotificationPermission;
  isSupported: boolean;
  isSubscribed: boolean;
  settings: NotificationSettings;
  isLoading: boolean;
  error: string | null;
}

export function useWebPush() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<WebPushState>({
    permission: 'default',
    isSupported: false,
    isSubscribed: false,
    settings: {
      newVotings: false,
      myVotingsComplete: false,
    },
    isLoading: false,
    error: null,
  });

  // Проверяем поддержку уведомлений при инициализации
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      
      // Принудительно проверяем разрешения
      let permission: NotificationPermission = 'denied';
      if (isSupported) {
        permission = Notification.permission;
        console.log('Current notification permission:', permission);
      }
      
      setState(prev => ({
        ...prev,
        isSupported,
        permission,
      }));
    };

    checkSupport();
    
    // Добавляем слушатель изменений разрешений
    const handlePermissionChange = () => {
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      if (isSupported) {
        const newPermission = Notification.permission;
        console.log('Permission changed to:', newPermission);
        setState(prev => ({
          ...prev,
          permission: newPermission,
        }));
      }
    };
    
    // Слушаем изменения разрешений (если поддерживается)
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then(permission => {
        permission.addEventListener('change', handlePermissionChange);
      });
    }
    
    return () => {
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' as PermissionName }).then(permission => {
          permission.removeEventListener('change', handlePermissionChange);
        });
      }
    };
  }, []);

  // Загружаем настройки уведомлений
  const loadSettings = useCallback(async () => {
    if (!state.isSupported || !user || authLoading) {
      console.log('Skipping loadSettings:', { 
        isSupported: state.isSupported, 
        permission: state.permission, 
        user: !!user, 
        authLoading 
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers: Record<string, string> = {};
      
      // Добавляем токен авторизации если пользователь авторизован
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${configManager.getApiUrl()}/web-push/settings`, {
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Settings loaded from server:', data);
        setState(prev => ({
          ...prev,
          settings: data.settings || prev.settings,
          isSubscribed: data.isSubscribed || false,
        }));
      } else if (response.status === 401) {
        // Пользователь не авторизован - не загружаем настройки
        console.log('User not authorized - skipping settings load');
        setState(prev => ({ ...prev, isLoading: false }));
      } else if (response.status === 404) {
        // Серверная часть еще не реализована - это нормально
        console.log('Web push API not implemented yet - using default settings');
        setState(prev => ({ ...prev, isLoading: false }));
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      // Не показываем ошибку, если серверная часть не реализована
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('401'))) {
        console.log('Web push API not available - using default settings');
      } else {
        setState(prev => ({
          ...prev,
          error: 'Не удалось загрузить настройки уведомлений',
        }));
      }
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.isSupported, user, authLoading, accessToken]);

  // Подписываемся на веб-пуши
  const subscribeToWebPush = useCallback(async (permission?: string) => {
    const currentPermission = permission || state.permission;
    if (!state.isSupported || currentPermission !== 'granted') {
      console.log('Cannot subscribe: isSupported=', state.isSupported, 'permission=', currentPermission);
      return;
    }

    console.log('Starting web push subscription...');

    try {
      // Регистрируем service worker
      console.log('Registering service worker...');
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      console.log('Service worker registered and ready');

      // Получаем VAPID публичный ключ
      console.log('Getting VAPID public key...');
      const response = await fetch(`${configManager.getApiUrl()}/web-push/vapid-public-key`);
      console.log('VAPID response status:', response.status);
      const { publicKey } = await response.json();
      console.log('VAPID public key received:', publicKey);

      // Подписываемся на push-уведомления
      console.log('Subscribing to push manager...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });
      console.log('Push subscription created:', subscription);

      // Отправляем подписку на сервер
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Добавляем токен авторизации если пользователь авторизован
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      console.log('Sending subscription to server...');
      const serverResponse = await fetch(`${configManager.getApiUrl()}/web-push/subscribe`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(subscription),
      });

      if (serverResponse.ok) {
        console.log('Subscription saved to server successfully');
        setState(prev => ({ ...prev, isSubscribed: true }));
      } else {
        console.error('Failed to save subscription to server:', serverResponse.status);
        throw new Error(`Server error: ${serverResponse.status}`);
      }
    } catch (error) {
      console.error('Error subscribing to web push:', error);
      setState(prev => ({
        ...prev,
        error: 'Не удалось подписаться на уведомления',
      }));
    }
  }, [state.isSupported, state.permission, accessToken]);

  // Загружаем настройки при изменении разрешений или авторизации
  useEffect(() => {
    console.log('useEffect triggered:', { 
      permission: state.permission, 
      user: !!user, 
      authLoading,
      isSupported: state.isSupported
    });
    
    // Загружаем настройки для авторизованных пользователей независимо от разрешений
    if (user && !authLoading && state.isSupported) {
      console.log('Loading settings...');
      loadSettings();
    }
  }, [state.permission, user, authLoading, state.isSupported]);

  // Автоподписка: если разрешение уже выдано, поддержка есть, пользователь авторизован,
  // а подписки ещё нет — пробуем подписаться автоматически
  useEffect(() => {
    if (
      state.isSupported &&
      state.permission === 'granted' &&
      user &&
      !authLoading &&
      accessToken &&
      !state.isSubscribed
    ) {
      console.log('Auto-subscribe trigger: permission granted, has token, not subscribed');
      subscribeToWebPush(state.permission);
    }
  }, [state.isSupported, state.permission, state.isSubscribed, user, authLoading, accessToken, subscribeToWebPush]);

  // Запрашиваем разрешение на уведомления
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      console.log('Permission requested, result:', permission);
      setState(prev => ({ ...prev, permission, isLoading: false }));

      if (permission === 'granted') {
        console.log('Permission granted, subscribing to web push...');
        // Подписываемся на веб-пуши
        await subscribeToWebPush(permission);
      } else {
        console.log('Permission denied or dismissed:', permission);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setState(prev => ({
        ...prev,
        error: 'Не удалось запросить разрешение на уведомления',
        isLoading: false,
      }));
    }
  }, [state.isSupported, subscribeToWebPush]);

  // Обновляем настройки уведомлений
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    if (!state.isSupported || state.permission !== 'granted' || !user || authLoading) {
      console.log('Skipping updateSettings:', { 
        isSupported: state.isSupported, 
        permission: state.permission, 
        user: !!user, 
        authLoading 
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Добавляем токен авторизации если пользователь авторизован
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      console.log('Sending settings update:', newSettings);

      const response = await fetch(`${configManager.getApiUrl()}/web-push/settings`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...newSettings },
          isLoading: false,
        }));
      } else if (response.status === 401) {
        // Пользователь не авторизован - не обновляем настройки
        console.log('User not authorized - skipping settings update');
        setState(prev => ({ ...prev, isLoading: false }));
      } else if (response.status === 404) {
        // Серверная часть еще не реализована - обновляем только локально
        console.log('Web push API not implemented yet - updating local settings only');
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...newSettings },
          isLoading: false,
        }));
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      // Если серверная часть не реализована, обновляем локально
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('401'))) {
        console.log('Web push API not available - updating local settings only');
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...newSettings },
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Не удалось обновить настройки',
          isLoading: false,
        }));
      }
    }
  }, [state.isSupported, state.permission, user, authLoading]);

  // Отписываемся от уведомлений
  const unsubscribe = useCallback(async () => {
    if (!state.isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Добавляем токен авторизации если пользователь авторизован
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        await fetch(`${configManager.getApiUrl()}/web-push/unsubscribe`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ endpoint }),
        });
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        settings: {
          newVotings: false,
          myVotingsComplete: false,
        },
      }));
    } catch (error) {
      console.error('Error unsubscribing from web push:', error);
      setState(prev => ({
        ...prev,
        error: 'Не удалось отписаться от уведомлений',
      }));
    }
  }, [state.isSupported]);

  return {
    ...state,
    requestPermission,
    updateSettings,
    unsubscribe,
    loadSettings,
  };
}

// Утилита для конвертации VAPID ключа
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}
