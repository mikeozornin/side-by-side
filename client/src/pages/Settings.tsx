import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, RefreshCw, LogOut, X } from 'lucide-react';

export function Settings() {
  const { t } = useTranslation();
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [figmaCode, setFigmaCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    await logout();
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const generateFigmaCode = async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/figma-code', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFigmaCode(data.code);
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('settings.figmaIntegration.errorGeneratingCode'));
      }
    } catch (error) {
      console.error('Error generating Figma code:', error);
      setError(t('settings.figmaIntegration.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!figmaCode) return;

    try {
      await navigator.clipboard.writeText(figmaCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  // Автоматически генерируем код при загрузке страницы
  useEffect(() => {
    if (accessToken && !figmaCode) {
      generateFigmaCode();
    }
  }, [accessToken]);

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{t('settings.loginRequired')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-3xl font-bold">{user.email}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Интеграция с Figma */}
        <div>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-3">{t('settings.figmaIntegration.howToConnect')}</h4>
              <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                <li>Open the Side-by-Side plugin in Figma</li>
                <li>Click the "{t('settings.figmaIntegration.connectAccount')}" button</li>
                <li>
                  <span>Enter the code: </span>
                  {figmaCode ? (
                    <>
                      <code className="px-2 py-1 bg-background border rounded font-mono text-sm h-8 w-32 inline-block" style={{verticalAlign: 'middle'}}>{figmaCode}</code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                        disabled={copied}
                        className="h-8 w-8 p-0 ml-2"
                        style={{verticalAlign: 'middle'}}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateFigmaCode}
                        disabled={isLoading}
                        className="h-8 w-8 p-0 ml-1"
                        style={{verticalAlign: 'middle'}}
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateFigmaCode}
                      disabled={isLoading}
                      className="ml-2 h-8"
                      style={{verticalAlign: 'middle'}}
                    >
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">{t('settings.figmaIntegration.refresh')}</span>
                    </Button>
                  )}
                </li>
                <li>Done!</li>
              </ol>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Кнопка выхода внизу страницы */}
      <div className="mt-12">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="ml-2">{t('settings.logout')}</span>
        </Button>
      </div>
    </div>
  );
}
