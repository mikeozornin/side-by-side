import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

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
  checkAuthMode: () => Promise<{ authMode: 'anonymous' | 'magic-links'; isAnonymous: boolean }>;
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
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    // Восстанавливаем accessToken из localStorage при инициализации
    return localStorage.getItem('accessToken');
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [authMode, setAuthMode] = useState<'anonymous' | 'magic-links'>('magic-links');
  const hasInitialized = useRef(false);

  // Функция для проверки режима аутентификации
  const checkAuthMode = async (): Promise<{ authMode: 'anonymous' | 'magic-links'; isAnonymous: boolean }> => {
    try {
      const response = await fetch('/api/auth/mode');
      if (response.ok) {
        const data = await response.json();
        setAuthMode(data.authMode);
        setIsAnonymous(data.isAnonymous);
        return { authMode: data.authMode, isAnonymous: data.isAnonymous };
      }
    } catch (error) {
      console.error('Error checking auth mode:', error);
    }
    // По умолчанию возвращаем magic-links режим
    return { authMode: 'magic-links', isAnonymous: false };
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
        // Сохраняем обновленный токен в localStorage
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
      } else {
        // Не очищаем состояние и localStorage — дадим шанс fallback-логике
        return false;
      }
    } catch (error) {
      // На сетевых ошибках также не трогаем текущее состояние — пусть сработает fallback
      return false;
    }
  };

  // Утилиты для работы с hash-параметрами (HashRouter)
  const getHashQueryParam = (name: string): string | null => {
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return null;
    const params = new URLSearchParams(hash.substring(qIndex + 1));
    return params.get(name);
  };

  const setHashPath = (path: string) => {
    const value = path.startsWith('#') ? path.slice(1) : path;
    window.location.hash = value || '/';
  };

  // Функция входа
  const login = (newAccessToken: string, newUser: User) => {
    setAccessToken(newAccessToken);
    setUser(newUser);
    // Сохраняем токен в localStorage для восстановления после перезагрузки
    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('user', JSON.stringify(newUser));
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
      
      // Очищаем данные из localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      
      // Принудительно обновляем состояние через setTimeout
      setTimeout(() => {
        setUser(null);
        setAccessToken(null);
      }, 0);
    }
  };

  // Функция для обработки magic link callback
  const handleMagicLinkCallback = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.accessToken);
        setUser(data.user);
        
        // Перенаправляем на главную страницу или returnTo (берем из hash)
        const returnToParam = getHashQueryParam('returnTo');
        const decoded = returnToParam ? decodeURIComponent(returnToParam) : null;
        if (decoded) {
          setHashPath(decoded);
        } else {
          setHashPath('/');
        }
        return true;
      } else {
        console.error('Invalid magic link token');
        return false;
      }
    } catch (error) {
      console.error('Error verifying magic link token:', error);
      return false;
    }
  };

  // Проверяем авторизацию при загрузке приложения
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      
      // Сначала получаем режим аутентификации (без гонок со state)
      const mode = await checkAuthMode();
      
      // Проверяем, есть ли magic link token в hash (HashRouter)
      const token = getHashQueryParam('token');
      
      if (token) {
        // Обрабатываем magic link callback
        const success = await handleMagicLinkCallback(token);
        if (success) {
          setIsLoading(false);
          return;
        }
      }
      
      // Если анонимный режим, устанавливаем анонимного пользователя
      if (mode.isAnonymous) {
        setUser({
          id: 'anonymous',
          email: 'anonymous@side-by-side.com',
          created_at: new Date().toISOString()
        });
        setAccessToken('anonymous-token');
        setIsLoading(false);
        return;
      }
      
      // В режиме magic-links сначала пытаемся обновить токен через refresh
      // Это работает как для AUTO_APPROVE_SESSIONS=true, так и для обычных сессий
      const refreshSuccess = await refreshToken();
      
      if (!refreshSuccess) {
        // Если refresh не удался, используем сохраненные данные локально без немедленной валидации
        const savedAccessToken = localStorage.getItem('accessToken');
        const savedUser = localStorage.getItem('user');
        if (savedAccessToken && savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            setAccessToken(savedAccessToken);
            setUser(userData);
            // Попробуем обновить в фоне, но ошибки игнорируем
            refreshToken().catch(() => {});
          } catch {
            // Некорректные данные — убираем их
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          }
        }
      }
      
      setIsLoading(false);
    };

    if (hasInitialized.current) return;
    hasInitialized.current = true;
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
