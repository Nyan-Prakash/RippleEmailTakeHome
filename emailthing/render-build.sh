#!/bin/bash
set -e

echo "==> Installing pnpm globally..."
npm install -g pnpm@9

echo "==> Installing project dependencies..."
pnpm install --no-frozen-lockfile

echo "==> Installing Playwright Chromium with dependencies..."
pnpm exec playwright install --with-deps chromium

echo "==> Building Next.js application..."
pnpm build

echo "==> Build completed successfully!"
