import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnTo?: string;
}

export function AuthModal({ isOpen, onClose, returnTo }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { login, isAnonymous } = useAuth();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          returnTo: returnTo || window.location.hash,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // В dev режиме автоматически входим
        if (data.accessToken && data.user) {
          login(data.accessToken, data.user);
          onClose();
          
          // Перенаправляем на нужную страницу
          if (data.returnTo) {
            window.location.hash = data.returnTo;
          }
          return;
        }
        
        setMessage(t('auth.modal.checkEmail'));
      } else {
        const error = await response.json();
        setMessage(error.error || t('auth.modal.errorGeneric'));
      }
    } catch (error) {
      console.error('Error sending magic link:', error);
      setMessage(t('auth.modal.errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkCallback = async (token: string) => {
    setIsLoading(true);
    setMessage('');

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
        login(data.accessToken, data.user);
        onClose();
        
        // Перенаправляем на нужную страницу
        if (returnTo) {
          window.location.hash = returnTo;
        }
      } else {
        const error = await response.json();
        setMessage(error.error || t('auth.modal.errorInvalidToken'));
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      setMessage(t('auth.modal.errorLogin'));
    } finally {
      setIsLoading(false);
    }
  };

  // Обработка magic link из URL
  React.useEffect(() => {
    if (!isOpen) return;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      handleMagicLinkCallback(token);
    }
  }, [isOpen]);

  // Установка фокуса на поле ввода email при открытии модального окна
  useEffect(() => {
    if (isOpen && emailInputRef.current) {
      // Небольшая задержка для корректной работы фокуса
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // В анонимном режиме не показываем модальное окно
  if (isAnonymous) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>{t('auth.modal.title')}</CardTitle>
          <CardDescription>
            {t('auth.modal.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                ref={emailInputRef}
                type="email"
                placeholder={t('auth.modal.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            {message && (
              <div className={`text-sm p-3 rounded-md ${
                message.includes(t('auth.modal.checkEmail')) 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isLoading || !email}
                className="flex-shrink-0"
              >
                {isLoading ? t('auth.modal.sending') : t('auth.modal.sendLink')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
