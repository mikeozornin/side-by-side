#!/bin/bash
# Setup SSL certificate with Let's Encrypt

set -e

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <your-domain.com> <email@example.com>"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-""}

if [ -z "$EMAIL" ]; then
    echo "Error: Email is required for Let's Encrypt"
    echo "Usage: $0 <your-domain.com> <email@example.com>"
    exit 1
fi

echo "🔐 Setting up SSL for domain: $DOMAIN"
echo "📧 Email: $EMAIL"

# Update nginx-ssl.conf with domain
echo "📝 Updating nginx-ssl.conf with your domain..."
sed -i.bak "s/YOUR_DOMAIN/$DOMAIN/g" nginx-ssl.conf
sed -i.bak "s/server_name _;/server_name $DOMAIN;/g" nginx-ssl.conf

# Create directories for certbot
mkdir -p certbot-conf certbot-www

# Start services without SSL first
echo "🚀 Starting services..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Obtain SSL certificate
echo "📜 Obtaining SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# Start with SSL
echo "🔒 Enabling SSL configuration..."
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d

echo "✅ SSL setup complete!"
echo "🌐 Your site is now available at https://$DOMAIN"
echo ""
echo "⚠️  Certificate will auto-renew every 12 hours"
echo "💡 To force renewal: docker compose run --rm certbot renew"

