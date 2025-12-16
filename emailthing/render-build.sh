#!/bin/bash
set -e

echo "Installing dependencies..."
pnpm install

echo "Installing Playwright browsers..."
npx playwright install --with-deps chromium

echo "Building Next.js application..."
pnpm build

echo "Build completed successfully!"
