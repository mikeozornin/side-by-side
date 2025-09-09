# Ansible Deployment for Side-by-Side Voting

This directory contains Ansible playbooks for deploying the Side-by-Side Voting web application to Ubuntu servers.

## Structure

- `bootstrap.yml` - initial server setup (system dependencies, systemd, nginx)
- `deploy.yml` - deployment of new application versions
- `inventory.ini` - list of servers for deployment
- `group_vars/all.yml` - configuration variables

## Requirements

### On the server
- Ubuntu 20.04+ 
- Root access
- Nginx installed
- Bun 1.0+ (installed automatically)

### On developer machine
- Ansible 2.9+
- SSH access to server
- Built artifacts (frontend and backend)

## Configuration

### 1. Inventory setup

Edit `inventory.ini`:

```ini
[web]
target ansible_host=your-server-ip ansible_user=root
```

### 2. Variable configuration

Edit `group_vars/all.yml`:

```yaml
# Replace with your domain
domain: side-by-side.your-domain.com

# Authentication mode (anonymous or magic-links)
auth_mode: anonymous

# Other settings can be left as default
```

### 3. Environment setup

Create `server/.env.production` file with production settings:

```env
# Application configuration
DATA_DIR=/opt/side-by-side/current/data
LOG_DIR=/opt/side-by-side/current/logs
DB_PATH=/opt/side-by-side/current/app.db
PORT=3000
BASE_URL=https://side-by-side.your-domain.com
NODE_ENV=production

# Database settings
# Provider: "sqlite" or "postgres"
DB_PROVIDER=sqlite
# Path for SQLite (used if DB_PROVIDER="sqlite")
DB_PATH=/opt/side-by-side/current/app.db
# URL for PostgreSQL (used if DB_PROVIDER="postgres")
# DATABASE_URL=postgresql://user:password@host:port/dbname

# URL for voting links (client side)
VOTING_BASE_URL=https://side-by-side.your-domain.com

# Client URL (for magic links)
CLIENT_URL=https://side-by-side.your-domain.com

# Server mode
SERVER_MODE=production

# Chat notifications
NOTIFICATIONS_LOCALE=en

# Mattermost integration
MATTERMOST_ENABLED=false
# MATTERMOST_WEBHOOK_URL=https://your-mattermost-server.com/hooks/your-webhook-id

# Telegram integration (for future)
TELEGRAM_ENABLED=false
# TELEGRAM_BOT_TOKEN=your-bot-token
# TELEGRAM_CHAT_ID=your-chat-id

# Web Push notifications
WEB_PUSH_ENABLED=false
# Generate keys with: npx web-push generate-vapid-keys
# VAPID_PUBLIC_KEY=your_vapid_public_key_here
# VAPID_PRIVATE_KEY=your_vapid_private_key_here
# VAPID_EMAIL=mailto:admin@your-domain.com

# Rate Limiting
RATE_LIMIT_VOTING_PER_MINUTE=6
RATE_LIMIT_VOTING_PER_HOUR=60
RATE_LIMIT_AUTH_MAGIC_LINK_PER_MINUTE=5
RATE_LIMIT_AUTH_VERIFY_TOKEN_PER_MINUTE=5

# Authentication mode
AUTH_MODE=anonymous

# Auto-approve sessions in dev mode (without sending email). Don't use in production!
AUTO_APPROVE_SESSIONS=false

# SMTP settings for sending magic links
# SMTP_HOST=your-smtp-server.com
# SMTP_PORT=587
# SMTP_USER=your-smtp-username
# SMTP_PASS=your-smtp-password
# SMTP_FROM_EMAIL=noreply@your-domain.com
```

## Initial Installation

### 1. Build project

```bash
# In project root
bun run build
```

**⚠️ IMPORTANT:** Make sure there are no local database files (`app.db`, `*.db`, `*.sqlite`) in the `server/` directory, as they may overwrite production data during deployment.

### 2. Server bootstrap

```bash
ansible-playbook -i ansible/inventory.ini ansible/bootstrap.yml
```

This will install:
- Bun 1.0+
- System dependencies for image optimization (ImageMagick, jpegoptim, pngquant, webp)
- Nginx configuration
- Systemd service
- Basic directory structure
- Placeholder env file

### 3. Environment configuration

After bootstrap, update `/etc/side-by-side/server.env` on the server with real settings.

### 4. First deployment

```bash
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e restart_service=true
```

## Application Updates

### 1. Build new version

```bash
# In project root
bun run build
```

### 2. Deploy

```bash
# Regular deployment (without service restart)
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml

# Deployment with service restart
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e restart_service=true

# Deployment with env file update
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e update_env=true -e restart_service=true
```

## Server Structure

```
/opt/side-by-side/
├── releases/                    # Releases with timestamp
│   └── 20241201_143022/        # Example release
│       ├── frontend/           # Built React frontend
│       ├── server/             # Built Bun backend
│       ├── data/               # Uploaded images
│       ├── logs/               # Application logs
│       └── manifest.json       # Release information
├── current -> releases/20241201_143022/  # Symlink to current release
└── data/                       # Data (symlink to current/data)

/etc/side-by-side/
└── server.env                  # Application configuration

/usr/share/nginx/side-by-side -> /opt/side-by-side/current/frontend/  # Nginx web root
```

## Nginx Configuration

Nginx is configured for:
- Serving frontend static files
- Proxying API requests to Bun server (including `/api/images/`)
- Caching static resources (1 year for hashed files, excluding `/api/` paths)
- SPA fallback for React Router
- HTTP/2 support for improved performance

**Important:** Frontend static files are cached, but files from `/api/images/` are proxied to Bun server for processing.

**HTTP/2:** After SSL certificate setup, nginx automatically enables HTTP/2 support.

## Systemd Service

The `side-by-side` service:
- Automatically starts on system boot
- Restarts on failures
- Runs as `www-data` user
- Reads configuration from `/etc/side-by-side/server.env`

## Release Management

- Keeps last 10 releases (configurable in `releases_to_keep`)
- Old releases are automatically removed on deployment
- **Database (`app.db`) is automatically copied** from current release to new one on deployment if using `DB_PROVIDER=sqlite`. When using PostgreSQL, the database is external and not affected by deployment.
- **Data (`data/`) and logs (`logs/`) are also preserved** between deployments.
- Rollback: switch `current` symlink to previous release and restart service.

## Monitoring

### Service logs
```bash
journalctl -u side-by-side -f
```

### Application logs
```bash
tail -f /opt/side-by-side/current/logs/server.log
```

### Health check
```bash
curl https://side-by-side.your-domain.com/health
```

## SSL Certificates

For production, it's recommended to configure SSL via Let's Encrypt:

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d side-by-side.your-domain.com

# Automatic renewal
crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Enabling HTTP/2

After SSL setup, HTTP/2 is automatically enabled. If you need to enable manually:

```bash
# Add http2 to listen directive
sed -i 's/listen 443 ssl;/listen 443 ssl http2;/' /etc/nginx/sites-available/side-by-side.your-domain.com

# Test and reload
nginx -t && systemctl reload nginx
```

## Authentication Modes

The application supports two authentication modes:

### AUTH_MODE=anonymous
- Anonymous access - users can create and vote without registration
- "Login" button is hidden in interface
- Votes are saved with `user_id = NULL`
- Protection against duplicate voting via localStorage

### AUTH_MODE=magic-links  
- Authorization via magic links
- Users must login via email
- "Login" button is displayed in interface
- Votes are tied to user
- **Requires SMTP configuration** for sending magic links

**Important:** Authentication mode is configured in `/etc/side-by-side/server.env` and applied after service restart.

### Quick mode switching

```bash
# Switch to anonymous mode
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e auth_mode=anonymous -e restart_service=true

# Switch to magic-links mode
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e auth_mode=magic-links -e restart_service=true
```

### SMTP configuration for magic-links mode

To work in `magic-links` mode, you need to configure SMTP server:

```bash
# Edit env file on server
ssh root@your-server "nano /etc/side-by-side/server.env"

# Add SMTP settings:
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM_EMAIL=noreply@your-domain.com

# Restart service
ssh root@your-server "systemctl restart side-by-side"
```

**Popular SMTP providers:**
- **Gmail**: `smtp.gmail.com:587` (requires App Password)
- **Yandex**: `smtp.yandex.ru:587`
- **Mail.ru**: `smtp.mail.ru:587`
- **SendGrid**: `smtp.sendgrid.net:587`

## Deployment Security

### Protection against production data overwrite

**Problem:** Local database files may accidentally get to production during deployment.

**Solution:** Ansible automatically excludes the following files during sync:
- `app.db`, `*.db`, `*.sqlite`, `*.sqlite3` - database files
- `data/` - data directory
- `logs/` - logs directory  
- `.env*` - environment files

**Pre-deployment check:**
```bash
# Make sure there are no local DB files in server/
ls -la server/*.db server/*.sqlite server/*.sqlite3 2>/dev/null || echo "OK: No local database files"

# Remove local DB files if they exist
rm -f server/*.db server/*.sqlite server/*.sqlite3
```

## Troubleshooting

### Permission issues
```bash
# Fix data permissions
chown -R www-data:www-data /opt/side-by-side/current/data
chown -R www-data:www-data /opt/side-by-side/current/logs
```

### Nginx issues
```bash
# Test configuration
nginx -t

# Reload
systemctl reload nginx
```

### Service issues
```bash
# Service status
systemctl status side-by-side

# Restart
systemctl restart side-by-side

# Logs
journalctl -u side-by-side --since "1 hour ago"
```

### Bun installation issues
If Bun didn't install via Ansible:

```bash
# Manual Bun installation on server
scp ansible/install-bun-manual.sh root@your-server:/tmp/
ssh root@your-server "chmod +x /tmp/install-bun-manual.sh && /tmp/install-bun-manual.sh"

# Or install manually
ssh root@your-server
curl -fsSL https://bun.sh/install | bash
ln -sf /root/.bun/bin/bun /usr/local/bin/bun
chmod +x /usr/local/bin/bun
bun --version
```

### Image issues (404 errors)
If images return 404 error, check nginx configuration:

```bash
# Check that static file rule excludes /api/ paths
grep -A 3 "location ~\*" /etc/nginx/sites-available/side-by-side.mikeozornin.ru

# Should be:
# location ~* ^(?!\/api\/).*\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {

# If incorrect, restart bootstrap:
ansible-playbook -i ansible/inventory.ini ansible/bootstrap.yml
```

### Native module issues (bcrypt etc.)
If service fails to start with "No native build was found" error, this means native modules were compiled on a different platform (macOS/Windows) and don't work on Linux.

**Solution:**
1. Make sure system dependencies for compilation are installed:
   ```bash
   apt install -y build-essential python3-dev libc6-dev
   ```

2. Rebuild dependencies on server:
   ```bash
   cd /opt/side-by-side/current/server
   bun install --production
   ```

3. Or use bcryptjs instead of bcrypt (recommended):
   ```bash
   # Locally
   bun remove bcrypt && bun add bcryptjs
   # Update import in code: import bcrypt from 'bcryptjs'
   # Rebuild and deploy
   ```

### Bun access permission issues
If service can't start bun due to access permissions:

```bash
# Check permissions
ls -la /usr/local/bin/bun

# If it's a symlink to /root/.bun/bin/bun, copy the file:
rm /usr/local/bin/bun
cp /root/.bun/bin/bun /usr/local/bin/bun
chmod +x /usr/local/bin/bun
chown root:root /usr/local/bin/bun
```

### Database recovery
If data was lost after deployment, it can be recovered from previous release:

```bash
# Find previous release with data
ls -la /opt/side-by-side/releases/

# Check if data exists in previous release
cd /opt/side-by-side/releases/YYYYMMDD_HHMMSS/server
bun -e "import Database from 'bun:sqlite'; const db = new Database('app.db'); console.log('Votings:', db.prepare('SELECT COUNT(*) FROM votings').get());"

# Restore database
cp /opt/side-by-side/releases/YYYYMMDD_HHMMSS/app.db /opt/side-by-side/current/app.db
chown www-data:www-data /opt/side-by-side/current/app.db
chmod 644 /opt/side-by-side/current/app.db

# Restart service
systemctl restart side-by-side
```
