import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  returnTo?: string;
}

export function ProtectedRoute({ children, returnTo }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  React.useEffect(() => {
    if (!isLoading && !user && returnTo) {
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [isLoading, user, returnTo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (returnTo) {
      return (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          returnTo={returnTo}
        />
      );
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
