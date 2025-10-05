# Migration to GitHub Container Registry (GHCR)

This document describes how to migrate from local Docker builds to using pre-built images from GitHub Container Registry.

## Benefits

- Faster deployments (no build time on server)
- Consistent images across environments
- Better caching and layer reuse
- Easier CI/CD integration

## Prerequisites

1. GitHub repository with GitHub Actions enabled
2. GitHub Personal Access Token with `write:packages` permission
3. Docker images built and pushed to GHCR

## Setup GitHub Actions

Create `.github/workflows/docker-build.yml`:

```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push server image
        uses: docker/build-push-action@v5
        with:
          context: ./server
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/server:${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

      - name: Build and push client image
        uses: docker/build-push-action@v5
        with:
          context: ./client
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/client:${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

## Update Docker Compose

Replace `build:` with `image:` in `docker-compose.yml`:

```yaml
services:
  server:
    image: ghcr.io/your-username/side-by-side/server:latest
    # Remove: build: ../../server
    env_file: .env
    # ... rest of configuration

  client:
    image: ghcr.io/your-username/side-by-side/client:latest
    # Remove: build: ../../client
    # ... rest of configuration
```

## Update Ansible

Modify `ansible/deploy-compose.yml`:

```yaml
- name: Pull Docker images
  command: docker compose pull
  args:
    chdir: "{{ compose_dir }}"
  become_user: "{{ docker_user }}"
  when: compose_pull_images | bool
  register: pull_result
  changed_when: "'Pulling' in pull_result.stdout"

- name: Build Docker images (fallback)
  command: docker compose build --no-cache
  args:
    chdir: "{{ compose_dir }}"
  become_user: "{{ docker_user }}"
  when: not compose_pull_images | bool
  register: build_result
  changed_when: "'Building' in build_result.stdout or 'Step' in build_result.stdout"
```

## Environment Variables

Add to your `.env` file:

```env
# Image registry settings
COMPOSE_PULL_IMAGES=true
IMAGE_REGISTRY=ghcr.io
IMAGE_NAMESPACE=your-username
IMAGE_TAG=latest
```

## Deployment Commands

### With GHCR images:

```bash
# Set environment variable
export COMPOSE_PULL_IMAGES=true

# Deploy with Ansible
ansible-playbook -i inventory.ini ansible/deploy-compose.yml -e compose_pull_images=true

# Or manually
cd deploy/compose
docker compose pull
docker compose up -d
```

### With local builds (fallback):

```bash
# Set environment variable
export COMPOSE_PULL_IMAGES=false

# Deploy with Ansible
ansible-playbook -i inventory.ini ansible/deploy-compose.yml -e compose_pull_images=false

# Or manually
cd deploy/compose
docker compose build
docker compose up -d
```

## Image Tags

- `latest` - Latest from main branch
- `v1.0.0` - Specific version tags
- `main` - Branch-based tags
- `pr-123` - Pull request tags

## Security

1. **Private repositories**: Make images private if needed
2. **Token management**: Use GitHub's built-in `GITHUB_TOKEN`
3. **Image scanning**: Enable GitHub's security scanning
4. **Access control**: Manage package permissions in GitHub

## Rollback

To rollback to local builds:

1. Set `compose_pull_images=false` in Ansible vars
2. Revert `docker-compose.yml` to use `build:` instead of `image:`
3. Redeploy

## Troubleshooting

### Authentication issues:
```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### Image not found:
- Check image name and tag
- Verify repository permissions
- Check if image was built successfully

### Pull failures:
- Check network connectivity
- Verify authentication
- Check image availability in registry

