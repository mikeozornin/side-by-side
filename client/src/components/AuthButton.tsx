import { useState } from 'react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { Link } from 'react-router-dom';

interface AuthButtonProps {
  returnTo?: string;
  className?: string;
}

export function AuthButton({ returnTo, className }: AuthButtonProps) {
  const { user, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  if (isLoading) {
    return (
      <Button disabled size="sm" className={className}>
        Загрузка...
      </Button>
    );
  }

  if (user) {
    return (
      <Link to="/settings">
        <Button
          variant="outline"
          size="sm"
          className={className}
        >
          {user.email}
        </Button>
      </Link>
    );
  }

  return (
    <>
      <Button
        onClick={handleLogin}
        size="sm"
        className={className}
      >
        Логин
      </Button>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        returnTo={returnTo}
      />
    </>
  );
}
