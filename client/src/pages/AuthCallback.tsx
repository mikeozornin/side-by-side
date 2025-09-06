import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallback() {
  const { isLoading } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">
          {isLoading ? 'Обработка входа...' : 'Перенаправление...'}
        </p>
      </div>
    </div>
  );
}
