#!/bin/bash
# WANDR Quick Setup & Run

echo "🎒 WANDR LOCAL SETUP"
echo "===================="
echo ""

APP_DIR="/home/natzridz/wandr-app"

# Step 1: Environment setup
echo "📋 Step 1: Setting up environment variables..."
if [ -f "$APP_DIR/.env.example" ]; then
    echo "✅ .env.example found"
else
    echo "⚠️  No .env.example in root"
fi

if [ ! -f "$APP_DIR/web/.env" ]; then
    cp "$APP_DIR/web/.env.example" "$APP_DIR/web/.env" 2>/dev/null || echo "⚠️  Could not copy web .env"
fi

if [ ! -f "$APP_DIR/mobile/.env" ]; then
    cp "$APP_DIR/mobile/.env.example" "$APP_DIR/mobile/.env" 2>/dev/null || echo "⚠️  Could not copy mobile .env"
fi

echo ""
echo "📝 Current environment files:"
echo "  - web/.env"
echo "  - mobile/.env"
echo ""
echo "⚠️  MANUAL STEP: Add these to .env files:"
echo "  EXPO_PUBLIC_SUPABASE_URL=your_url"
echo "  EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key"
echo "  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2: Installing dependencies..."
echo ""

echo "Installing WEB dependencies..."
cd "$APP_DIR/web"
if [ -d "node_modules" ]; then
    echo "✅ web/node_modules exists"
else
    npm install
fi

echo ""
echo "Installing MOBILE dependencies..."
cd "$APP_DIR/mobile"
if [ -d "node_modules" ]; then
    echo "✅ mobile/node_modules exists"
else
    npm install
fi

# Step 3: Ready to run
echo ""
echo "================================================================"
echo "✅ WANDR Setup Complete!"
echo "================================================================"
echo ""
echo "🚀 To run WANDR:"
echo ""
echo "Web (Next.js):"
echo "  cd $APP_DIR/web"
echo "  npm run dev"
echo "  # http://localhost:3000"
echo ""
echo "Mobile (Expo):"
echo "  cd $APP_DIR/mobile"
echo "  npm start"
echo "  # Scan QR code for iOS/Android"
echo ""
echo "Web Preview (Expo):"
echo "  cd $APP_DIR/mobile"
echo "  npm run web"
echo ""
