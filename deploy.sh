#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BRANCH="${1:-dev}"

if [ "$BRANCH" = "main" ]; then
    PROJECT_DIR="/opt/mikrotik-main"
    PORT="80"
elif [ "$BRANCH" = "dev" ]; then
    PROJECT_DIR="/opt/mikrotik-dev"
    PORT="8080"
else
    echo -e "${RED}Unknown branch: $BRANCH${NC}"
    exit 1
fi

LOGFILE="/var/log/mikrotik-deploy-${BRANCH}.log"

log() {
    echo -e "$1" | tee -a "$LOGFILE"
}

log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${BLUE}MIMO.SA Deploy - branch: $BRANCH${NC}"
log "${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_DIR" || exit 1

CURRENT_COMMIT=$(git rev-parse --short HEAD)
log "${YELLOW}Current: $CURRENT_COMMIT${NC}"

log "\n${BLUE}Pulling latest from $BRANCH...${NC}"
git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    log "${GREEN}Already up to date.${NC}"
    exit 0
fi

git pull origin "$BRANCH"

NEW_COMMIT=$(git rev-parse --short HEAD)
log "${GREEN}New: $NEW_COMMIT${NC}"

log "\n${YELLOW}Changes:${NC}"
git log --oneline "$CURRENT_COMMIT".."$NEW_COMMIT" | tee -a "$LOGFILE"

BACKEND_CHANGED=$(git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -E '^backend/' || true)
FRONTEND_CHANGED=$(git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -E '^frontend/' || true)
COMPOSE_CHANGED=$(git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -E '^docker-compose' || true)

if [ -n "$COMPOSE_CHANGED" ] || [ -n "$BACKEND_CHANGED" ] || [ -n "$FRONTEND_CHANGED" ]; then
    SERVICES=""

    if [ -n "$BACKEND_CHANGED" ] || [ -n "$COMPOSE_CHANGED" ]; then
        log "\n${BLUE}Backend changed, rebuilding...${NC}"
        SERVICES="$SERVICES backend"
    fi

    if [ -n "$FRONTEND_CHANGED" ] || [ -n "$COMPOSE_CHANGED" ]; then
        log "\n${BLUE}Frontend changed, rebuilding...${NC}"
        SERVICES="$SERVICES frontend"
    fi

    if [ -n "$COMPOSE_CHANGED" ]; then
        log "\n${BLUE}docker-compose changed, rebuilding all...${NC}"
        docker compose down
        docker compose up -d --build
    else
        docker compose up -d --build $SERVICES
    fi

    sleep 5

    RUNNING=$(docker compose ps --format '{{.State}}' | grep -c "running" || true)
    TOTAL=$(docker compose ps --format '{{.State}}' | wc -l)

    if [ "$RUNNING" -eq "$TOTAL" ]; then
        log "${GREEN}All $TOTAL containers running${NC}"
    else
        log "${RED}Only $RUNNING/$TOTAL containers running!${NC}"
        docker compose ps | tee -a "$LOGFILE"
        docker compose logs --tail=30 | tee -a "$LOGFILE"
        exit 1
    fi
else
    log "\n${GREEN}No app changes detected${NC}"
fi

SERVER_IP=$(hostname -I | awk '{print $1}')

log "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${GREEN}Deploy completed!${NC}"
log "${YELLOW}URL: http://$SERVER_IP:$PORT${NC}"
log "${YELLOW}Version: $NEW_COMMIT${NC}"
log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
