# Notification System

The notification system allows sending messages to chats when new side-by-sides are created.

## Supported Providers

- **Mattermost** - via webhook (simpler, no attachments) or API (better, with attachments)
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
# Method: "webhook" (simpler, no attachments) or "api" (better, with attachments, default)
MATTERMOST_SEND_METHOD=api
# For webhook method:
MATTERMOST_WEBHOOK_URL=https://your-mattermost-server.com/hooks/your-webhook-id
# For API method:
MATTERMOST_SERVER_URL=https://your-mattermost-server.com
MATTERMOST_API_TOKEN=your-api-token
MATTERMOST_CHANNEL_ID=your-channel-id

# Telegram (for future)
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### 2. Mattermost Setup

#### Webhook Method (Simpler, No Attachments)

1. In Mattermost go to **System Console** → **Integrations** → **Custom Integrations**
2. Enable **Enable Incoming Webhooks**
3. Create a new webhook:
   - Select channel for notifications
   - Copy webhook URL
   - Paste into `MATTERMOST_WEBHOOK_URL`
4. Set `MATTERMOST_SEND_METHOD=webhook`

**Limitations:**
- Cannot attach files (preview images)
- Only text messages

#### API Method (Better, With Attachments)

1. In Mattermost go to **Account Settings** → **Security** → **Personal Access Tokens**
2. Create a new token with permissions:
   - `post:write` - to send messages
   - `upload:write` - to upload files
3. Copy the token and paste into `MATTERMOST_API_TOKEN`
4. Get channel ID:
   - Open Mattermost in browser
   - Go to the channel where you want notifications
   - Channel ID is in the URL: `.../channels/{channel-id}`
   - Or use Mattermost API: `GET /api/v4/channels` to list channels
5. Set:
   - `MATTERMOST_SEND_METHOD=api` (or leave default)
   - `MATTERMOST_SERVER_URL` - your Mattermost server URL
   - `MATTERMOST_API_TOKEN` - your personal access token
   - `MATTERMOST_CHANNEL_ID` - target channel ID

**Advantages:**
- Can attach preview images
- More control over message format
- Better error handling

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
- For webhook: `MATTERMOST_WEBHOOK_URL` not set or has invalid format
- For API: Missing `MATTERMOST_SERVER_URL`, `MATTERMOST_API_TOKEN`, or `MATTERMOST_CHANNEL_ID`
- Invalid API token or insufficient permissions
- Channel ID not found or incorrect

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

### Preview Images

When using API method (`MATTERMOST_SEND_METHOD=api`), the system automatically:
1. Generates a preview image from voting options (diagonal split composition)
2. Uploads the preview to Mattermost
3. Attaches it to the notification message

Preview generation only happens when:
- `MATTERMOST_SEND_METHOD=api`
- `MATTERMOST_ENABLED=true`
- Voting has image options

If preview generation fails, the message is sent without attachment (fallback).

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
