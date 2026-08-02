#!/usr/bin/env bash
# GeoSyze — build + deploy script (Hostinger VPS / any Linux box)
# Usage: bash deploy.sh   (run from the repo root)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/4] Building frontend (Geosyze-react)"
cd "$REPO_DIR/Geosyze-react"
npm install
npm run build

echo "==> [2/4] Building backend (NestJS)"
cd "$REPO_DIR/backend"
npm install
npm run build

echo "==> [3/4] Preparing data dirs"
mkdir -p uploads/gis

echo "==> [4/4] Seeding database (idempotent)"
npm run seed

echo ""
echo "Build complete."
echo "  frontend dist : $REPO_DIR/Geosyze-react/dist"
echo "  backend dist  : $REPO_DIR/backend/dist"
echo ""
echo "Before first start, create production env:"
echo "  cp backend/.env.example backend/.env   # then edit secrets"
echo ""
echo "Start with PM2:"
echo "  pm2 start backend/ecosystem.config.js"
echo "  pm2 save && pm2 startup"
