# Notification System

The notification system allows sending messages to chats when new side-by-sides are created.

## Supported Providers

- **Mattermost** - via webhook (implemented)
- **Telegram** - placeholder for future

## Configuration

### 1. ENV Variables

Copy `env.example` to `.env.development` (or `.env`) and configure variables:

**ENV file loading priority:**
1. `.env.development`
2. `.env.local` 
3. `.env`
4. `.env.production`

```bash
# URL for voting links (client side)
VOTING_BASE_URL=http://localhost:5173

# Chat notifications
# Notification localization (ru/en)
NOTIFICATIONS_LOCALE=ru

# Mattermost
MATTERMOST_ENABLED=true
MATTERMOST_WEBHOOK_URL=https://your-mattermost-server.com/hooks/your-webhook-id

# Telegram (for future)
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### 2. Mattermost Webhook Setup

1. In Mattermost go to **System Console** → **Integrations** → **Custom Integrations**
2. Enable **Enable Incoming Webhooks**
3. Create a new webhook:
   - Select channel for notifications
   - Copy webhook URL
   - Paste into `MATTERMOST_WEBHOOK_URL`

## Testing

Run the testing command:

```bash
npm run test:notifications
```

The command will send a test message to all active providers and show results.

### Localization Testing

```bash
npm run test:locale
```

The command will show current locale and test translations in different languages.

### Problem Diagnostics

```bash
npm run check:env
```

The command will check all ENV variables and show their values. Useful for diagnosing configuration issues.

**Common issues:**
- `.env` file not found or not loading
- `MATTERMOST_ENABLED` not set to `true` (strict comparison)
- `MATTERMOST_WEBHOOK_URL` not set or has invalid format

## Architecture

```
server/src/notifications/
├── types.ts                    # Interfaces and types
├── i18n.ts                     # Localization system
├── notificationService.ts      # Main service
├── locales/
│   ├── ru.json                # Russian translations
│   └── en.json                # English translations
├── providers/
│   ├── base.ts                # Base provider class
│   ├── mattermost.ts          # Mattermost provider
│   └── telegram.ts            # Telegram placeholder
└── index.ts                   # Exports
```

## Adding New Provider

1. Create a new class inheriting from `NotificationProvider`
2. Implement `send()`, `validate()`, `name` methods
3. Add provider to `NotificationService.initializeProviders()`
4. Add corresponding ENV variables

## Message Format

Messages are sent in format:

```
**New side-by-side for voting!**

[Voting Title](link)
```

## Logging

All operations are logged through the existing logging system:
- Successful sends: `INFO` level
- Errors: `ERROR` level  
- Warnings: `WARN` level

**Note:** Logs are written in English for universality.

## Localization

The system supports localization through files in `locales/`:
- `ru.json` - Russian translations (default)
- `en.json` - English translations

### Locale Configuration

**Via ENV variable (recommended):**
```bash
NOTIFICATIONS_LOCALE=en  # or ru
```

**Programmatically:**
```typescript
import { i18n } from './notifications/i18n.js';
i18n.setLocale('en'); // or 'ru'
```

### Supported Languages

- `ru` - Russian (default)
- `en` - English

When `NOTIFICATIONS_LOCALE` has an invalid value, the system automatically uses Russian language and outputs a warning to the log.

### Features

- All user messages (in console, notifications) are localized
- Logs remain in English for universality
- System automatically initializes with locale from ENV on startup
