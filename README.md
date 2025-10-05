# Side-by-Side Voting

Web application for rapid design testing.

## Description

Side by Side allows designers to upload design variants and easily get team feedback through voting without emails or emoji counting in chats. Voting lasts for the specified time, after which results are shown.

Public plugin for download: https://www.figma.com/community/plugin/1545946464465075859/side-by-side-voting

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Bun + TypeScript + Hono + SQLite/PostgreSQL
- **Image optimization**: ImageMagick, jpegoptim, pngquant, cwebp, avifenc, Sharp
- **Testing**: Bun Test (server), Vitest + React Testing Library (client)
- **Figma plugin**: Vanilla JavaScript for integration with Figma Desktop App

## Installation and Setup

There's a ready Ansible script, try it. If not, read below.

### Requirements

- Bun 1.0+ (instead of Node.js)
- Image optimization utilities (Ubuntu):
  ```bash
  sudo apt update
  sudo apt install imagemagick jpegoptim pngquant webp avif-tools
  
  # For HEIC/HEIF support (Sharp library dependencies)
  sudo apt install libvips-dev libvips42 libheif-dev libglib2.0-dev \
    libgobject-2.0-dev libcairo2-dev libpango1.0-dev libjpeg-dev \
    libpng-dev libwebp-dev libtiff-dev libgif-dev libexif-dev \
    liblcms2-dev liborc-dev libfftw3-dev libmagickwand-dev
  ```
- **Optional**: PostgreSQL (if using `DB_PROVIDER=postgres`)

### Installing Bun

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Reload terminal or run:
source ~/.bashrc
```

### Installing Dependencies

```bash
# Install all dependencies
bun install
```

### Environment Setup

Copy the configuration file:
```bash
cp env.example .env
```

Edit `.env` if necessary:
```env
DATA_DIR=./data
LOG_DIR=./logs
DB_PATH=./app.db
PORT=3000
BASE_URL=http://localhost:3000
NODE_ENV=development

# Database configuration (optional)
DB_PROVIDER=sqlite  # or 'postgres'
DATABASE_URL=postgresql://user:password@host:port/database  # for PostgreSQL

# Storage configuration (optional)
STORAGE_DRIVER=local  # or 's3'
# For S3 storage (MinIO, AWS S3, etc.)
S3_ENDPOINT=http://your-minio-server:9000
S3_REGION=us-east-1
S3_BUCKET=side-by-side
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_FORCE_PATH_STYLE=true
```

### Development Mode

```bash
# Run server and client simultaneously
bun run dev
```

Or separately:
```bash
# Server only (port 3000)
bun run dev:server

# Client only (port 5173)
bun run dev:client
```

### Production Build

```bash
# Build client and server
bun run build

# Run production server
bun run start
```

## Project Structure

```
side-by-side/
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Application pages
│   │   └── lib/           # Utilities
│   └── package.json
├── server/                # Bun backend
│   ├── src/
│   │   ├── db/            # Database and schemas (bun:sqlite)
│   │   ├── routes/        # API routes (Hono)
│   │   └── utils/         # Server utilities
│   └── package.json
├── figma-plugin/          # Figma plugin
│   ├── code.js            # Main plugin logic
│   ├── ui.html            # Plugin interface HTML
│   └── manifest.json      # Plugin manifest
├── data/                  # Uploaded images
├── logs/                  # Server logs
└── package.json           # Root package.json
```

## API

### Votings

- `GET /api/votings` - list of all votings
- `GET /api/votings/:id` - voting details
- `POST /api/votings` - create voting
- `POST /api/votings/:id/vote` - vote
- `GET /api/votings/:id/results` - voting results

### Images

- `GET /api/images/:filename` - get image

## Features

- **Anti-fraud**: Uses IndexedDB to prevent duplicate voting in the same browser
- **Image optimization**: Automatic optimization of uploaded images (JPEG, PNG, WebP, AVIF)
- **HEIC/HEIF support**: Automatic conversion to JPG for browser compatibility
- **Video support**: MP4, WebM, MOV, AVI formats
- **Database flexibility**: SQLite (default) or PostgreSQL support
- **Storage flexibility**: Local filesystem (default) or S3-compatible storage (MinIO, AWS S3) with proxy serving
- **Testing**: Comprehensive test suite with 53+ server tests and client component tests
- **Dark mode**: Support for light and dark modes
- **Responsive**: Adaptive design for desktop
- **Hash routing**: SPA with hash-based routing

## Deployment

### Docker Compose (Recommended)

The easiest way to deploy the application is using Docker Compose with pre-built images from GitHub Container Registry.

#### Option A: Using pre-built images (easiest)

Docker images are automatically built via GitHub Actions and published to GHCR.

1. **On your VPS**:
   ```bash
   mkdir -p /opt/side-by-side/compose
   cd /opt/side-by-side/compose
   
   # Copy configuration files:
   # - docker-compose.yml
   # - nginx.conf  
   # - env.example (rename to .env)
   
   # Edit .env with your settings
   nano .env
   
   # Pull and run
   docker compose pull
   docker compose up -d
   ```

2. **With PostgreSQL**:
   ```bash
   docker compose --profile postgres up -d
   ```

#### Option B: Build locally (if needed)

If you need to build images locally (e.g., for testing):
```bash
cd deploy/compose
./build-and-push.sh --no-push --tag test
```

#### Option C: Using Ansible (automated deployment)

```bash
# Bootstrap server
ansible-playbook -i inventory.ini ansible/bootstrap-compose.yml

# Deploy application
ansible-playbook -i inventory.ini ansible/deploy-compose.yml
```

See [deploy/compose/README.md](deploy/compose/README.md) for detailed documentation.

### CI/CD with GitHub Actions

Docker images are automatically built on every push to `main`/`master`:
- 🤖 Automatic builds on Linux x86-64 (no emulation issues)
- 📦 Published to `ghcr.io/mikeozornin/side-by-side`
- 🏷️ Tagged as `latest` for main branch
- 🔢 Versioned tags for git tags (e.g., `v1.0.0`)

See [.github/workflows/README.md](.github/workflows/README.md) for more details.

### Ubuntu + Nginx (Classic)

1. Build the project: `bun run build`
2. Configure Nginx for static file serving and API proxying
3. Start the server: `bun run start`
4. Set up systemd service for auto-start

### Production Environment Variables

```env
DATA_DIR=/var/app/side-by-side/data
LOG_DIR=/var/app/side-by-side/logs
DB_PATH=/var/app/side-by-side/app.db
PORT=3000
BASE_URL=https://yourdomain.com
NODE_ENV=production

# Storage configuration
STORAGE_DRIVER=local  # or 's3'
# For S3 storage (MinIO, AWS S3, etc.)
S3_ENDPOINT=http://your-minio-server:9000
S3_REGION=us-east-1
S3_BUCKET=side-by-side
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_FORCE_PATH_STYLE=true
```

### S3 Storage Setup

The application supports S3-compatible storage (MinIO, AWS S3, etc.) for file storage. Files are served through the backend proxy mode for security and consistency.

1. Create an S3 bucket in AWS Console or MinIO
2. Configure environment variables:
```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_FORCE_PATH_STYLE=false
```

## Figma Plugin

The application includes a Figma plugin that allows creating votings directly from the design interface.

### Plugin Development (developer version)

1. Open Figma Desktop App
2. Go to plugin settings: Menu → Plugins → Development → Import plugin from manifest...
3. Select the `figma-plugin/manifest.json` file

### Usage

1. Select two or more elements on canvas (frames, groups, or components)
2. Run the "Side-by-Side Voting" plugin
3. Fill in the voting title and select duration
4. Click "Create Voting"
5. The voting link will be copied to clipboard

Detailed plugin documentation is available in [figma-plugin/README.md](figma-plugin/README.md).

## Development

### Testing

```bash
# Run server tests
cd server && bun test

# Run client tests  
cd client && npm test

# Run with coverage
cd server && bun test --coverage
cd client && npm test -- --coverage
```

### Database Structure

- `users` - user accounts
- `votings` - voting sessions
- `voting_options` - voting variants (images/videos)
- `votes` - user votes
- `magic_tokens` - email authentication tokens
- `sessions` - user sessions
- `figma_auth_codes` - Figma plugin authentication

### Logging

Logs are saved to `LOG_DIR/server.log` with rotation via logrotate.