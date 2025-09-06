import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAnonymous: boolean;
  authMode: 'anonymous' | 'magic-links';
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  checkAuthMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [authMode, setAuthMode] = useState<'anonymous' | 'magic-links'>('magic-links');

  // Функция для проверки режима аутентификации
  const checkAuthMode = async () => {
    try {
      const response = await fetch('/api/auth/mode');
      if (response.ok) {
        const data = await response.json();
        setAuthMode(data.authMode);
        setIsAnonymous(data.isAnonymous);
      }
    } catch (error) {
      console.error('Error checking auth mode:', error);
    }
  };

  // Функция для обновления токена
  const refreshToken = async (): Promise<boolean> => {
    try {
      // В анонимном режиме не нужно обновлять токен
      if (isAnonymous) {
        return true;
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Важно для отправки HttpOnly cookie
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.accessToken);
        setUser(data.user);
        return true;
      } else {
        // Токен недействителен, очищаем состояние
        setAccessToken(null);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setAccessToken(null);
      setUser(null);
      return false;
    }
  };

  // Функция входа
  const login = (newAccessToken: string, newUser: User) => {
    setAccessToken(newAccessToken);
    setUser(newUser);
  };

  // Функция выхода
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      // Принудительно очищаем состояние
      setAccessToken(null);
      setUser(null);
      setIsAnonymous(false);
      setIsLoading(false);
      
      // Принудительно обновляем состояние через setTimeout
      setTimeout(() => {
        setUser(null);
        setAccessToken(null);
      }, 0);
    }
  };

  // Проверяем авторизацию при загрузке приложения
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      
      // Сначала проверяем режим аутентификации
      await checkAuthMode();
      
      // Если анонимный режим, устанавливаем анонимного пользователя
      if (isAnonymous) {
        setUser({
          id: 'anonymous',
          email: 'anonymous@side-by-side.com',
          created_at: new Date().toISOString()
        });
        setAccessToken('anonymous-token');
        setIsLoading(false);
        return;
      }
      
      // В режиме magic-links проверяем токен
      await refreshToken();
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Автоматическое обновление токена каждые 10 минут (только в режиме magic-links)
  useEffect(() => {
    if (!accessToken || isAnonymous) return;

    const interval = setInterval(async () => {
      await refreshToken();
    }, 10 * 60 * 1000); // 10 минут

    return () => clearInterval(interval);
  }, [accessToken, isAnonymous]);

  const value: AuthContextType = {
    user,
    accessToken,
    isLoading,
    isAnonymous,
    authMode,
    login,
    logout,
    refreshToken,
    checkAuthMode,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
