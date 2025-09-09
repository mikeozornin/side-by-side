# Testing Guide

This project uses testing for both server and client components to ensure code quality and reliability.

## 🏗️ Test Structure

### Server Tests (Bun + Hono)
- **Location**: `server/tests/`
- **Framework**: Bun Test
- **Database**: SQLite in-memory for testing
- **Coverage**: 53 tests covering all major functionality

### Client Tests (React + TypeScript)
- **Location**: `client/src/test/`
- **Framework**: Vitest + React Testing Library
- **Environment**: jsdom for DOM simulation
- **Coverage**: Component and hook testing

## 🚀 Running Tests

### Server Tests
```bash
cd server

# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/utils/auth.test.ts
```

### Client Tests
```bash
cd client

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test src/test/simple.test.tsx -- --run

# Run with coverage
npm test -- --coverage
```

## 📁 Test Organization

### Server Test Structure
```
server/tests/
├── setup.ts                 # Global test setup and mocks
├── utils/
│   └── auth.test.ts         # Authentication utilities
├── db/
│   └── queries.test.ts      # Database operations
└── routes/
    ├── auth.test.ts         # Authentication API routes
    └── votings.test.ts      # Voting API routes
```

### Client Test Structure
```
client/src/test/
├── setup.ts                 # Test environment setup
├── components/
│   ├── AuthButton.test.tsx  # Component tests
│   └── ui/
│       └── Button.test.tsx  # UI component tests
├── contexts/
│   └── AuthContext.test.tsx # Context provider tests
└── hooks/
    └── useWebPush.test.ts   # Custom hook tests
```

## 🧪 Test Types

### 1. Unit Tests
- **Purpose**: Test individual functions and components in isolation
- **Examples**: Auth utilities, database queries, React components
- **Location**: `tests/utils/`, `src/test/components/`

### 2. Integration Tests
- **Purpose**: Test API endpoints and database interactions
- **Examples**: Authentication flows, voting operations
- **Location**: `tests/routes/`, `tests/db/`

### 3. Component Tests
- **Purpose**: Test React components with user interactions
- **Examples**: Button clicks, form submissions, state changes
- **Location**: `src/test/components/`

## 🔧 Test Configuration

### Server (Bun Test)
```toml
# server/bunfig.toml
[test]
runner = "bun"
setup = "./tests/setup.ts"
```

### Client (Vitest)
```typescript
// client/vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

## 🎯 Test Examples

### Server Test Example
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { generateMagicToken } from '../../src/utils/auth.js';

describe('Auth Utils', () => {
  it('should generate a 64-character hex string', () => {
    const token = generateMagicToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });
});
```

### Client Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/button';

describe('Button Component', () => {
  it('should render with default props', () => {
    render(<Button>Test Button</Button>);
    expect(screen.getByText('Test Button')).toBeInTheDocument();
  });
});
```

## 🛠️ Mocking Strategy

### Server Mocks
- **Database**: In-memory SQLite for isolation
- **External APIs**: Mocked fetch calls
- **Email**: Dummy SMTP configuration
- **Environment**: Test-specific variables

### Client Mocks
- **APIs**: Mocked fetch responses
- **Router**: Mocked navigation
- **i18n**: Mocked translation functions
- **Web APIs**: Mocked browser APIs (Service Worker, Notifications)

## 📊 Coverage Reports

### Server Coverage
- **Location**: `server/coverage/`
- **Format**: HTML, LCOV, text
- **Target**: >80% coverage for critical paths

### Client Coverage
- **Location**: `client/coverage/`
- **Format**: HTML, JSON, text
- **Target**: >70% coverage for components

## 🚨 Common Issues & Solutions

### Server Issues
1. **Database conflicts**: Each test uses fresh in-memory database
2. **Email sending**: Tests use dummy SMTP configuration
3. **Rate limiting**: Tests reset rate limiters between runs

### Client Issues
1. **JSX in .ts files**: Use `React.createElement` or rename to `.tsx`
2. **Missing mocks**: Ensure all external dependencies are mocked
3. **Async operations**: Use `waitFor` for state updates

## 📝 Writing New Tests

### Server Test Template
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { initDatabase } from '../../src/db/init.js';

describe('Feature Name', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  it('should do something', async () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Client Test Template
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock external dependencies
vi.mock('path/to/dependency');

describe('Component Name', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## 🎯 Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Use descriptive test names and assertions
3. **Coverage**: Aim for meaningful coverage, not just high numbers
4. **Maintenance**: Keep tests simple and maintainable
5. **Documentation**: Comment complex test logic

## 🔍 Debugging Tests

### Server Debugging
```bash
# Run with verbose output
bun test --verbose

# Run specific test with debug info
bun test tests/utils/auth.test.ts --verbose
```

### Client Debugging
```bash
# Run with UI mode
npm test -- --ui

# Run with debug output
npm test -- --reporter=verbose
```