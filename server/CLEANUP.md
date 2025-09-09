# Expired Data Cleanup System

## Overview

The cleanup system automatically removes expired authentication data to maintain database cleanliness and prevent accumulation of outdated information.

## What Gets Cleaned

### 1. Sessions (sessions)
- **Condition**: `expires_at <= datetime('now')`
- **Description**: Removes sessions with expired validity period

### 2. Magic Tokens (magic_tokens)
- **Condition**: `expires_at <= datetime('now')` OR `used_at <= datetime('now', '-1 hour')`
- **Description**: Removes expired tokens and used tokens older than 1 hour

### 3. Figma Auth Codes (figma_auth_codes)
- **Condition**: `expires_at <= datetime('now')` OR `used_at <= datetime('now', '-1 hour')`
- **Description**: Removes expired codes and used codes older than 1 hour

## When Cleanup Runs

### Automatic Cleanup
- **On server startup**: Immediate comprehensive cleanup of all data
- **Periodically**: Every 24 hours (configurable in `CLEANUP_INTERVAL_HOURS`)
- **On session creation**: Cleanup of old user sessions (keeps last 5)

### Manual Cleanup
Via API endpoints (requires authorization):

```bash
# Comprehensive cleanup of all data
POST /api/auth/cleanup

# Cleanup Figma codes only
POST /api/auth/cleanup-figma-codes

# Check scheduler status
GET /api/auth/cleanup/status
```

## Configuration

### Environment Variables
```bash
# Automatic cleanup interval (hours)
CLEANUP_INTERVAL_HOURS=24

# Maximum number of sessions per user
USER_SESSION_CLEANUP_LIMIT=5
```

### Interval Configuration
Change the constant in `src/utils/cleanup-scheduler.ts`:
```typescript
const CLEANUP_INTERVAL_HOURS = 24; // Change to desired value
```

## Monitoring

### Logs
The system logs information about each cleanup:
```
🧹 Performing initial cleanup of expired authentication data...
🗑️  Cleaned on startup: 15 records
Cleaned expired sessions: 5
Cleaned magic tokens: 8 (expired: 6, used: 2)
Cleaned Figma codes: 2 (expired: 1, used: 1)
```

### API Status
```json
{
  "cleanupScheduler": {
    "isRunning": true,
    "nextCleanup": "2024-01-15T14:30:00.000Z"
  },
  "lastCleanup": "2024-01-14T14:30:00.000Z"
}
```

## Security

- **Atomic operations**: All cleanups are performed within database transactions
- **Race condition protection**: Prevents simultaneous execution of multiple cleanups
- **Logging**: All operations are logged for audit
- **Graceful shutdown**: Scheduler properly stops on server termination

## Performance

- **Batch processing**: Cleanup is performed in batches to minimize load
- **Indexes**: Uses existing indexes on `expires_at` fields
- **Background work**: Cleanup doesn't block the main application thread

## Debugging

### Manual Run
```bash
# In server code
import { runManualCleanup } from './utils/cleanup-scheduler.js';
const result = await runManualCleanup();
console.log('Cleanup result:', result);
```

### Status Check
```bash
# Get scheduler status
GET /api/auth/cleanup/status
```

## Extension

To add a new data category for cleanup:

1. **Create cleanup function** in `src/db/auth-queries.ts`
2. **Add call** in `cleanupExpiredAuthData()`
3. **Update types** for return values
4. **Add logging** for new category

Example:
```typescript
export function cleanupExpiredTable(): number {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM your_table
    WHERE expires_at <= datetime('now')
  `).run();
  return result.changes;
}
```
