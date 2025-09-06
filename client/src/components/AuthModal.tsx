import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnTo?: string;
}

export function AuthModal({ isOpen, onClose, returnTo }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { login } = useAuth();

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
        
        setMessage('Проверьте почту! Мы отправили вам ссылку для входа.');
      } else {
        const error = await response.json();
        setMessage(error.error || 'Произошла ошибка. Попробуйте еще раз.');
      }
    } catch (error) {
      console.error('Error sending magic link:', error);
      setMessage('Произошла ошибка. Проверьте подключение к интернету.');
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
        setMessage(error.error || 'Неверная или просроченная ссылка.');
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      setMessage('Произошла ошибка при входе. Попробуйте еще раз.');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Вход в систему</CardTitle>
          <CardDescription>
            Введите адрес эл. почты и мы отправим вам ссылку для входа
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            {message && (
              <div className={`text-sm p-3 rounded-md ${
                message.includes('Проверьте почту') 
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
                className="flex-1"
              >
                {isLoading ? 'Отправляем...' : 'Отправить ссылку'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Отмена
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
