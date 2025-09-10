import { useState } from 'react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';

interface AuthButtonProps {
  returnTo?: string;
  className?: string;
}

export function AuthButton({ returnTo, className }: AuthButtonProps) {
  const { user, isLoading, isAnonymous } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { t } = useTranslation();

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  if (isLoading) {
    return (
      <Button disabled size="sm" className={className}>
        {t('auth.loading')}
      </Button>
    );
  }

  // В анонимном режиме показываем кнопку профиля
  if (isAnonymous) {
    return (
      <Link to="/settings">
        <Button
          variant="outline"
          size="sm"
          className={className}
        >
          <User className="h-4 w-4" />
        </Button>
      </Link>
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
          <User className="h-4 w-4 md:hidden" />
          <span className="hidden md:inline">{user.email}</span>
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
        <User className="h-4 w-4 md:hidden" />
        <span className="hidden md:inline">{t('auth.login')}</span>
      </Button>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        returnTo={returnTo}
      />
    </>
  );
}
