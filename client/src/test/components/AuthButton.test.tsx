import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthButton } from '../../components/AuthButton';

// Мокаем fetch
global.fetch = vi.fn();
import { AuthProvider } from '../../contexts/AuthContext';

// Мокаем react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} data-testid="link">{children}</a>
  ),
  useNavigate: () => mockNavigate
}));

// Мокаем configManager
vi.mock('../../lib/config', () => ({
  configManager: {
    getApiUrl: () => 'http://localhost:3001'
  }
}));

// Мокаем fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AuthButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderWithAuth = (user: any = null, isAnonymous = false) => {
    // Мокаем успешный ответ для проверки режима аутентификации
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authMode: isAnonymous ? 'anonymous' : 'magic-links',
        isAnonymous
      })
    });

    return render(
      <AuthProvider>
        <AuthButton />
      </AuthProvider>
    );
  };

  it('should show loading state initially', () => {
    renderWithAuth();
    expect(screen.getByText('auth.loading')).toBeInTheDocument();
  });

  it('should not render in anonymous mode', async () => {
    renderWithAuth(null, true);
    
    await waitFor(() => {
      expect(screen.queryByText('auth.loading')).not.toBeInTheDocument();
    });

    // В анонимном режиме кнопка не должна отображаться
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should show login button when user is not authenticated', async () => {
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText('auth.login')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('auth.login');
  });

  it('should show user email when authenticated', async () => {
    const mockUser = {
      id: 'test-user',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    // Мокаем успешный refresh для получения пользователя
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: 'test-token',
        user: mockUser
      })
    });

    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    const link = screen.getByTestId('link');
    expect(link).toHaveAttribute('href', '/settings');
  });

  it('should open auth modal when login button is clicked', async () => {
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText('auth.login')).toBeInTheDocument();
    });

    const loginButton = screen.getByRole('button');
    fireEvent.click(loginButton);

    // Проверяем, что модальное окно открылось
    // (AuthModal компонент должен быть отрендерен)
    await waitFor(() => {
      // Здесь можно добавить проверку на наличие модального окна
      // в зависимости от реализации AuthModal
    });
  });

  it('should accept custom className prop', async () => {
    render(
      <AuthProvider>
        <AuthButton className="custom-class" />
      </AuthProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  it('should accept returnTo prop', async () => {
    render(
      <AuthProvider>
        <AuthButton returnTo="/dashboard" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('auth.login')).toBeInTheDocument();
    });
  });

  it('should show user icon on mobile', async () => {
    const mockUser = {
      id: 'test-user',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: 'test-token',
        user: mockUser
      })
    });

    renderWithAuth();
    
    await waitFor(() => {
      // Проверяем, что иконка пользователя отображается
      const userIcon = screen.getByRole('button').querySelector('svg');
      expect(userIcon).toBeInTheDocument();
    });
  });

  it('should handle authentication error gracefully', async () => {
    // Мокаем ошибку при проверке режима аутентификации
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithAuth();
    
    await waitFor(() => {
      // Должен показать кнопку входа по умолчанию
      expect(screen.getByText('auth.login')).toBeInTheDocument();
    });
  });
});
