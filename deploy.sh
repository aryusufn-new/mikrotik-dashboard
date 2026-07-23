#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 MIMO.SA Deployment Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd /opt/mikrotik-dashboard || exit 1

CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo -e "${YELLOW}📌 Current version: $CURRENT_COMMIT${NC}"

echo -e "\n${BLUE}📥 Pulling latest code from Git...${NC}"
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}✅ Already up to date. No deployment needed.${NC}"
    exit 0
fi

echo -e "${YELLOW}📦 New commits found. Pulling changes...${NC}"
git pull origin main

NEW_COMMIT=$(git rev-parse --short HEAD)
echo -e "${GREEN}📌 New version: $NEW_COMMIT${NC}"

echo -e "\n${YELLOW}📝 Changes:${NC}"
git log --oneline "$CURRENT_COMMIT".."$NEW_COMMIT"

BACKEND_CHANGED=$(git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -E '^backend/' || true)
FRONTEND_CHANGED=$(git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -E '^frontend/' || true)

if [ -n "$BACKEND_CHANGED" ]; then
    echo -e "\n${BLUE}🔧 Backend files changed. Deploying backend...${NC}"
    
    if git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -q "backend/requirements.txt"; then
        echo -e "${YELLOW}📦 requirements.txt changed. Updating dependencies...${NC}"
        cd /opt/mikrotik-dashboard/backend
        source .venv/bin/activate
        pip install -r requirements.txt
    fi
    
    echo -e "${BLUE}🔄 Restarting backend service...${NC}"
    systemctl restart mikrotik-dashboard
    
    sleep 3
    
    if systemctl is-active --quiet mikrotik-dashboard; then
        echo -e "${GREEN}✅ Backend running successfully${NC}"
    else
        echo -e "${RED}❌ Backend failed to start!${NC}"
        echo -e "${YELLOW}Last 20 log lines:${NC}"
        journalctl -u mikrotik-dashboard -n 20 --no-pager
        exit 1
    fi
else
    echo -e "\n${GREEN}✅ No backend changes detected${NC}"
fi

if [ -n "$FRONTEND_CHANGED" ]; then
    echo -e "\n${BLUE}�� Frontend files changed. Deploying frontend...${NC}"
    
    cd /opt/mikrotik-dashboard/frontend
    
    if git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -q "frontend/package.json"; then
        echo -e "${YELLOW}📦 package.json changed. Updating dependencies...${NC}"
        npm ci
    fi
    
    echo -e "${BLUE}🏗️  Building frontend...${NC}"
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend built successfully${NC}"
    else
        echo -e "${RED}❌ Frontend build failed!${NC}"
        exit 1
    fi
else
    echo -e "\n${GREEN}✅ No frontend changes detected${NC}"
fi

SERVER_IP=$(hostname -I | awk '{print $1}')

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Deployment completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🌐 Access dashboard: ${NC}http://$SERVER_IP"
echo -e "${YELLOW}📋 Version: ${NC}$NEW_COMMIT"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
