#!/bin/bash
# Build and push Docker images to registry

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
REGISTRY="${IMAGE_REGISTRY:-ghcr.io/your-github-username}"
TAG="${IMAGE_TAG:-latest}"
BUILD_SERVER=true
BUILD_CLIENT=true
PUSH=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --no-push)
      PUSH=false
      shift
      ;;
    --server-only)
      BUILD_CLIENT=false
      shift
      ;;
    --client-only)
      BUILD_SERVER=false
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --registry REGISTRY   Docker registry (default: ghcr.io/your-github-username)"
      echo "  --tag TAG             Image tag (default: latest)"
      echo "  --no-push             Build only, don't push to registry"
      echo "  --server-only         Build only server image"
      echo "  --client-only         Build only client image"
      echo "  --help                Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --registry ghcr.io/myuser --tag v1.0.0"
      echo "  $0 --registry myuser --tag latest"
      echo "  $0 --no-push --server-only"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."

echo -e "${GREEN}Building and pushing Docker images${NC}"
echo "Registry: $REGISTRY"
echo "Tag: $TAG"
echo ""

# Build and push server
if [ "$BUILD_SERVER" = true ]; then
  echo -e "${YELLOW}Building server image...${NC}"
  docker build \
    --platform linux/amd64 \
    -t "$REGISTRY/side-by-side-server:$TAG" \
    -f "$PROJECT_ROOT/server/Dockerfile" \
    "$PROJECT_ROOT/server"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server image built successfully${NC}"
    
    if [ "$PUSH" = true ]; then
      echo -e "${YELLOW}Pushing server image...${NC}"
      docker push "$REGISTRY/side-by-side-server:$TAG"
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Server image pushed successfully${NC}"
      else
        echo -e "${RED}✗ Failed to push server image${NC}"
        exit 1
      fi
    fi
  else
    echo -e "${RED}✗ Failed to build server image${NC}"
    exit 1
  fi
  echo ""
fi

# Build and push client
if [ "$BUILD_CLIENT" = true ]; then
  echo -e "${YELLOW}Building client image...${NC}"
  docker build \
    --platform linux/amd64 \
    -t "$REGISTRY/side-by-side-client:$TAG" \
    -f "$PROJECT_ROOT/client/Dockerfile" \
    "$PROJECT_ROOT/client"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Client image built successfully${NC}"
    
    if [ "$PUSH" = true ]; then
      echo -e "${YELLOW}Pushing client image...${NC}"
      docker push "$REGISTRY/side-by-side-client:$TAG"
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Client image pushed successfully${NC}"
      else
        echo -e "${RED}✗ Failed to push client image${NC}"
        exit 1
      fi
    fi
  else
    echo -e "${RED}✗ Failed to build client image${NC}"
    exit 1
  fi
  echo ""
fi

echo -e "${GREEN}Done!${NC}"
echo ""
echo "Images:"
if [ "$BUILD_SERVER" = true ]; then
  echo "  - $REGISTRY/side-by-side-server:$TAG"
fi
if [ "$BUILD_CLIENT" = true ]; then
  echo "  - $REGISTRY/side-by-side-client:$TAG"
fi

if [ "$PUSH" = true ]; then
  echo ""
  echo "To deploy on VPS, run:"
  echo "  docker compose pull"
  echo "  docker compose up -d"
fi
