import '@testing-library/jest-dom';
import { beforeAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';

// Мокаем i18next для тестов
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() }
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children
}));

// Мокаем react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => 
    React.createElement('a', { href: to }, children),
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children
}));

// Мокаем Web APIs которых может не быть в jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Мокаем ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Мокаем fetch для тестов
global.fetch = vi.fn();

beforeAll(() => {
  // Настройка глобальных переменных окружения для тестов
  process.env.NODE_ENV = 'test';
});

// Очищаем DOM после каждого теста
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
