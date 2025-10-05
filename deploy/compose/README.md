# Docker Deployment

This directory contains Docker Compose configuration for Side-by-Side Voting application.

## Files

- `docker-compose.yml` - Main Docker Compose configuration
- `nginx-https.conf` - Nginx configuration with HTTPS support
- `env.j2` - Ansible template for environment variables
- `README.md` - This file

## Services

### edge (Nginx)
- **Port**: 80, 443
- **Role**: Reverse proxy with SSL termination
- **Features**: 
  - HTTP to HTTPS redirect
  - SSL/TLS termination
  - Security headers
  - Let's Encrypt support

### client (React Frontend)
- **Port**: 80 (internal)
- **Role**: Frontend application
- **Features**:
  - Static file serving
  - React SPA routing

### server (Bun Backend)
- **Port**: 3000 (internal)
- **Role**: API server
- **Features**:
  - REST API endpoints
  - Database operations
  - File uploads
  - Authentication

### certbot (Let's Encrypt)
- **Role**: SSL certificate management
- **Features**:
  - Automatic certificate renewal
  - Webroot validation

## Deployment

### 1. Initial Setup
```bash
# Deploy with Ansible
./deploy.sh --docker
```

### 2. Get SSL Certificate
```bash
ssh root@your-server 'cd /opt/side-by-side/compose && docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email your@email.com --agree-tos --no-eff-email -d your-domain.com'
```

### 3. Enable HTTPS
```bash
ssh root@your-server 'cd /opt/side-by-side/compose && docker compose down && docker compose up -d'
```

## Management

### View Logs
```bash
docker compose logs -f
```

### Restart Services
```bash
docker compose restart
```

### Update Images
```bash
docker compose pull && docker compose up -d
```

### Stop All Services
```bash
docker compose down
```

## Environment Variables

Key environment variables for Docker deployment:

- `DOMAIN` - Your domain name
- `DOCKER_HUB_USERNAME` - Docker Hub username for images
- `SMTP_*` - SMTP configuration for magic links
- `JWT_SECRET` - Secret key for JWT tokens

## Troubleshooting

### SSL Certificate Issues
1. Check domain DNS resolution
2. Verify port 80 is open
3. Check nginx configuration
4. Review certbot logs

### Service Health Issues
1. Check container logs: `docker compose logs [service]`
2. Verify environment variables
3. Check port conflicts
4. Review resource usage

### API Issues
1. Check server logs: `docker compose logs server`
2. Verify database connectivity
3. Check file permissions
4. Review CORS settings