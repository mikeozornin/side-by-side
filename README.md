# Side-by-Side Voting

Web application for rapid design testing.

## Description

Side by Side allows designers to upload design variants and easily get team feedback through voting without emails or emoji counting in chats. Voting lasts for the specified time, after which results are shown.

Public plugin for download: https://www.figma.com/community/plugin/1545946464465075859/side-by-side-voting

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Bun + TypeScript + Hono + SQLite (bun:sqlite)
- **Image optimization**: ImageMagick, jpegoptim, pngquant, cwebp, avifenc
- **Figma plugin**: Vanilla JavaScript for integration with Figma Desktop App

## Installation and Setup

There's a ready Ansible script, try it. If not, read below.

### Requirements

- Bun 1.0+ (instead of Node.js)
- Image optimization utilities (Ubuntu):
  ```bash
  sudo apt update
  sudo apt install imagemagick jpegoptim pngquant webp avif-tools
  ```

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
- **Image optimization**: Automatic optimization of uploaded images
- **Dark mode**: Support for light and dark modes
- **Responsive**: Adaptive design for desktop
- **Hash routing**: SPA with hash-based routing

## Deployment

### Ubuntu + Nginx

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

### Database Structure

- `votings` - votings
- `voting_images` - voting images
- `votes` - user votes

### Logging

Logs are saved to `LOG_DIR/server.log` with rotation via logrotate.