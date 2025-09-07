import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function AuthCallback() {
  const { isLoading, authError, authErrorCode, user, clearAuthError } = useAuth();
  const navigate = useNavigate();
  const [timeoutError, setTimeoutError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Таймаут для обработки случая, когда сервер не отвечает
    const timeout = setTimeout(() => {
      if (isLoading) {
        setTimeoutError(true);
      }
    }, 10000); // 10 секунд

    return () => clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    // Если загрузка завершилась и есть ошибка, или пользователь не авторизован, показываем ошибку
    if (!isLoading && (authError || authErrorCode || !user)) {
      // Ошибка уже установлена в контексте, ничего не делаем
    }
  }, [isLoading, authError, authErrorCode, user]);

  const handleRetry = () => {
    clearAuthError();
    navigate('/');
  };

  if (authError || authErrorCode || (!isLoading && !user) || timeoutError) {
    const getErrorMessage = () => {
      if (timeoutError) {
        return t('auth.callback.errorTimeout');
      }
      if (authErrorCode === 'invalid_token') {
        return t('auth.callback.errorInvalidLink');
      }
      if (authErrorCode === 'network_error') {
        return t('auth.callback.errorTimeout');
      }
      if (authError) {
        return authError; // Fallback для старых ошибок
      }
      return t('auth.callback.errorInvalidLink');
    };

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-foreground mb-4">{t('auth.callback.errorTitle')}</h2>
          <p className="text-muted-foreground mb-6">
            {getErrorMessage()}
          </p>
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {t('auth.callback.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">
          {isLoading ? t('auth.callback.processing') : t('auth.callback.redirecting')}
        </p>
      </div>
    </div>
  );
}
