import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebPush } from '../../hooks/useWebPush';

// Мокаем useAuth
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    accessToken: 'test-token',
    isLoading: false
  })
}));

// Мокаем Service Worker API
const mockServiceWorker = {
  register: vi.fn(),
  ready: Promise.resolve({
    pushManager: {
      subscribe: vi.fn(),
      getSubscription: vi.fn(),
      unsubscribe: vi.fn()
    }
  })
};

// Мокаем Push API
const mockPushManager = {
  subscribe: vi.fn(),
  getSubscription: vi.fn(),
  unsubscribe: vi.fn()
};

// Мокаем Notification API
const mockNotification = {
  requestPermission: vi.fn(),
  permission: 'default'
};

// Мокаем fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Мокаем navigator
Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true
});

Object.defineProperty(window, 'Notification', {
  value: mockNotification,
  writable: true
});

Object.defineProperty(navigator, 'permissions', {
  value: {
    query: vi.fn(() => Promise.resolve({
      state: 'granted',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  },
  writable: true
});

describe('useWebPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Сбрасываем моки к значениям по умолчанию
    mockNotification.permission = 'default';
    mockNotification.requestPermission.mockResolvedValue('default');
    mockPushManager.getSubscription.mockResolvedValue(null);
    mockPushManager.subscribe.mockResolvedValue({
      endpoint: 'https://example.com/push',
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key'
      }
    });
    mockPushManager.unsubscribe.mockResolvedValue(true);
    
    // Мокаем успешный ответ API
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWebPush());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should check subscription status on mount', async () => {
    mockPushManager.getSubscription.mockResolvedValue({
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' }
    });

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isSubscribed).toBe(true);
  });

  it('should handle subscription request', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');
    mockPushManager.subscribe.mockResolvedValue({
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' }
    });

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(mockNotification.requestPermission).toHaveBeenCalled();
    expect(mockPushManager.subscribe).toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(true);
  });

  it('should handle subscription denial', async () => {
    mockNotification.requestPermission.mockResolvedValue('denied');

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.error).toBe('Permission denied');
  });

  it('should handle subscription error', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');
    mockPushManager.subscribe.mockRejectedValue(new Error('Subscription failed'));

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.error).toBe('Subscription failed');
  });

  it('should handle unsubscribe', async () => {
    // Начинаем с подписки
    mockPushManager.getSubscription.mockResolvedValue({
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' }
    });

    const { result } = renderHook(() => useWebPush());

    // Ждем инициализации
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isSubscribed).toBe(true);

    // Отписываемся
    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(mockPushManager.unsubscribe).toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(false);
  });

  it('should handle unsubscribe error', async () => {
    mockPushManager.getSubscription.mockResolvedValue({
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' }
    });
    mockPushManager.unsubscribe.mockRejectedValue(new Error('Unsubscribe failed'));

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(result.current.error).toBe('Unsubscribe failed');
  });

  it('should handle API errors during subscription', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');
    mockPushManager.subscribe.mockResolvedValue({
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' }
    });
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'API error' })
    });

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.error).toBe('API error');
  });

  it('should set loading state during operations', async () => {
    let resolveSubscribe: (value: any) => void;
    const subscribePromise = new Promise(resolve => {
      resolveSubscribe = resolve;
    });
    mockPushManager.subscribe.mockReturnValue(subscribePromise);

    const { result } = renderHook(() => useWebPush());

    act(() => {
      result.current.subscribe();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSubscribe!({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'key', auth: 'auth' }
      });
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should clear error when starting new operation', async () => {
    const { result } = renderHook(() => useWebPush());

    // Устанавливаем ошибку
    act(() => {
      result.current.error = 'Previous error';
    });

    // Начинаем новую операцию
    act(() => {
      result.current.subscribe();
    });

    expect(result.current.error).toBeNull();
  });
});
