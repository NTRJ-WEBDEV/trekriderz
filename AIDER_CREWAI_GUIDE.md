# 🤖 WANDR Development with Aider & CrewAI

This project uses **Aider** (powered by DeepSeek API) and **CrewAI** for intelligent code generation, review, and testing across mobile and web platforms.

## 🚀 Quick Start

### 1. **Install CrewAI Dependencies**

```bash
# Create Python virtual environment (if not already done)
python3 -m venv venv
source venv/bin/activate

# Install CrewAI packages
pip install crewai crewai-tools python-dotenv
```

### 2. **Install Node Dependencies**

```bash
# Mobile app
cd mobile && npm install

# Web app
cd ../web && npm install

cd ..
```

### 3. **Set Up Environment Variables**

Your `.env` file is already configured with:
- ✅ Supabase credentials
- ✅ DeepSeek API key
- ✅ CrewAI settings

**TODO**: Update Mapbox tokens in `.env` file

---

## 📝 Using Aider for Code Writing

**Aider** is an AI pair programmer that edits your code directly.

### Start Aider Session

```bash
aider --model deepseek/deepseek-chat
```

### Common Aider Commands

```bash
# Start aider with mobile app
aider mobile/app mobile/components mobile/lib

# Start aider with web app
aider web/app web/components web/lib

# Edit read-only (don't modify)
aider --read-only mobile/app

# List all files in session
/list

# See git diff of changes
/diff

# Accept all changes
/accept all
```

---

## 🤖 Using CrewAI for Development & Testing

**CrewAI** creates specialized AI agents for features, reviews, and testing.

### Available Creative Crews

```bash
# Run the main development crew
python crew.py
```

### Feature Development Workflow

```
You: "Build trip planning engine component"

CrewAI will:
1. 👨‍💻 Mobile Developer — Create React Native component
2. 👨‍💻 Web Developer — Create Next.js component  
3. 👀 Code Reviewer — Review both implementations
4. 🧪 Test Engineer — Write tests for both platforms
```

---

## 🏗️ Pending Work & Features

### Phase 1: Core Features (Next)
- ✅ Trip planning engine (40%)
- 🔄 AI itinerary generator (30%)
- 🔄 Homestay discovery (25%)
- 🔄 Guide directory (20%)
- ⚠️ Booking system (5%)

### Phase 2: Integration
- Connect with BAZARIO marketplace
- Payment integration
- Real-time messaging

---

## 📱 App Structure

```
wandr-app/
├── mobile/
│   ├── app/          # Expo Router pages
│   ├── components/   # Reusable components
│   ├── lib/          # Utilities & Supabase client
│   ├── stores/       # Zustand state management
│   └── assets/       # Images, fonts
├── web/
│   ├── app/          # Next.js 15 pages
│   ├── components/   # React components
│   ├── lib/          # Utilities & Supabase client
│   └── styles/       # Tailwind CSS
└── crew.py           # CrewAI automation
```

---

## 🔧 Development Commands

```bash
# Start mobile (Expo)
cd mobile && npm start

# Start web (Next.js)
cd web && npm run dev

# Run CrewAI automation
python crew.py

# Start Aider session
aider mobile/app web/app
```

---

## 📚 Useful Resources

- [Aider Docs](https://aider.chat)
- [CrewAI Docs](https://docs.crewai.com)
- [Expo Docs](https://docs.expo.dev)
- [Next.js 15 Docs](https://nextjs.org/docs)
