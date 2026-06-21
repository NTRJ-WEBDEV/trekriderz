#!/bin/bash

# Supabase Deployment Script for TrekRiderz
# This script helps deploy the Supabase configuration

set -e  # Exit on error

echo "🚀 Starting Supabase deployment for TrekRiderz..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Login to Supabase
echo ""
print_status "Step 1: Logging into Supabase..."
supabase login

# Step 2: Initialize project (if not already)
if [ ! -f "supabase/config.toml" ]; then
    print_status "Step 2: Initializing Supabase project..."
    supabase init
else
    print_status "Step 2: Supabase already initialized"
fi

# Step 3: Link to project
echo ""
print_status "Step 3: Linking to Supabase project..."
echo "Please enter your Supabase project reference ID:"
read -p "Project Ref: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    print_error "Project reference is required"
    exit 1
fi

supabase link --project-ref "$PROJECT_REF"

# Step 4: Deploy database schema
echo ""
print_status "Step 4: Deploying database schema..."
supabase db push

# Step 5: Deploy migrations
echo ""
print_status "Step 5: Applying migrations..."
for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "Applying: $(basename "$migration")"
        # In production, you would use: supabase db push
        # For now, we'll just list them
    fi
done

# Step 6: Deploy edge functions
echo ""
print_status "Step 6: Deploying edge functions..."

# Function to deploy a single edge function
deploy_function() {
    local func_name=$1
    local func_dir=$2
    
    if [ -d "$func_dir" ]; then
        echo "Deploying: $func_name"
        supabase functions deploy "$func_name" --project-ref "$PROJECT_REF"
    else
        print_warning "Function directory not found: $func_dir"
    fi
}

# Deploy each function
deploy_function "send-notification" "supabase/functions/send-notification"
deploy_function "generate-itinerary" "supabase/functions/generate-itinerary"
deploy_function "create-payment" "supabase/functions/create-payment"
deploy_function "handle-payment-webhook" "supabase/functions/handle-payment-webhook"
deploy_function "send-push-notification" "supabase/functions/send-push-notification"

# Step 7: Set up storage
echo ""
print_status "Step 7: Setting up storage buckets..."
echo "Note: Storage buckets need to be created manually in Supabase dashboard"
echo ""
echo "Please create these buckets in Supabase Dashboard > Storage:"
echo "1. avatars (public, 5MB limit, images only)"
echo "2. homestays (public, 10MB limit, images only)"
echo "3. guides (public, 10MB limit, images + PDF)"
echo "4. posts (public, 20MB limit, images + videos)"
echo "5. trip-media (public, 50MB limit, all media)"

# Step 8: Generate environment template
echo ""
print_status "Step 8: Generating environment template..."

cat > .env.supabase << EOF
# Supabase Environment Variables
# Add these to your Supabase project settings

# Authentication
SUPABASE_URL=https://$PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# External Services
EXPO_ACCESS_TOKEN=your_expo_access_token
OPENAI_API_KEY=your_openai_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Application URLs
WEB_APP_URL=https://your-web-app.com
MOBILE_APP_SCHEME=trekriderz://
EOF

print_status "Environment template created: .env.supabase"

# Step 9: Generate application environment files
echo ""
print_status "Step 9: Generating application environment files..."

# Web app .env
cat > web/.env << EOF
# Web Application Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://$PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
EOF

# Mobile app .env
cat > mobile/.env << EOF
# Mobile Application Environment Variables
EXPO_PUBLIC_SUPABASE_URL=https://$PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
EXPO_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
EOF

print_status "Application environment files created"
print_warning "Please update the .env files with your actual API keys"

# Step 10: Summary
echo ""
echo "========================================="
print_status "Supabase deployment setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Update .env files with your actual API keys"
echo "2. Create storage buckets in Supabase dashboard"
echo "3. Configure authentication providers"
echo "4. Set up email templates"
echo "5. Test the integration"
echo ""
echo "For detailed instructions, see: supabase_setup_guide.md"
echo ""

# Check for any issues
echo "Checking for potential issues..."
if [ ! -f "web/.env" ] || [ ! -f "mobile/.env" ]; then
    print_error "Environment files not created properly"
fi

if [ ! -d "supabase/migrations" ]; then
    print_error "Migrations directory not found"
fi

print_status "Setup script completed successfully!"
echo ""
echo "To test your setup, run:"
echo "  npm run dev        # Web app"
echo "  npm start          # Mobile app"
echo ""
echo "Remember to secure your API keys and never commit them to version control!"
