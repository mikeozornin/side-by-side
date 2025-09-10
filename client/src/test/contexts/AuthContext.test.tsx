import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Мокаем fetch
const mockFetch = vi.fn();

// Мокаем configManager
vi.mock('../../lib/config', () => ({
  configManager: {
    getApiUrl: () => 'http://localhost:3001'
  }
}));

// Тестовый компонент для проверки контекста
function TestComponent() {
  const { user, isLoading, isAnonymous, authMode } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="is-anonymous">{isAnonymous ? 'true' : 'false'}</div>
      <div data-testid="auth-mode">{authMode}</div>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Мокаем успешный ответ для проверки режима аутентификации
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authMode: 'magic-links',
        isAnonymous: false
      })
    });
  });

  it('should provide auth context to children', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('user')).toBeInTheDocument();
    });

    expect(screen.getByTestId('is-anonymous')).toHaveTextContent('false');
    expect(screen.getByTestId('auth-mode')).toHaveTextContent('magic-links');
  });

  it('should handle anonymous mode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authMode: 'anonymous',
        isAnonymous: true
      })
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-anonymous')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('anonymous@side-by-side.com');
  });

  it('should restore user from localStorage', async () => {
    const mockUser = {
      id: 'test-user',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    // Мокаем неудачный refresh, чтобы использовались данные из localStorage
    mockFetch.mockResolvedValueOnce({
      ok: false
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('should handle magic link callback', async () => {
    // Мокаем проверку режима аутентификации
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authMode: 'magic-links',
        isAnonymous: false
      })
    });

    // Мокаем успешную верификацию токена
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: 'new-token',
        user: {
          id: 'new-user',
          email: 'new@example.com',
          created_at: new Date().toISOString()
        }
      })
    });

    // Симулируем hash с токеном
    Object.defineProperty(window, 'location', {
      value: {
        hash: '#/auth/callback?token=test-token&returnTo=/dashboard'
      },
      writable: true
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('new@example.com');
    });
  });

  it('should handle magic link callback error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authMode: 'magic-links',
        isAnonymous: false
      })
    });

    // Мокаем неудачную верификацию токена
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Invalid token'
      })
    });

    Object.defineProperty(window, 'location', {
      value: {
        hash: '#/auth/callback?token=invalid-token'
      },
      writable: true
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });
  });

  it('should handle network error during auth mode check', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-mode')).toHaveTextContent('magic-links');
    });
  });
});
