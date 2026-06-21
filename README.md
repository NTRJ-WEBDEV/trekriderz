# TrekRiderz

## 🏔️ Your Ultimate Adventure Companion

TrekRiderz is a comprehensive travel and outdoor economy platform that connects travelers, trekkers, homestays, guides, and outdoor enthusiasts in one powerful ecosystem.

## 🚀 Quick Start

### Mobile App (React Native + Expo SDK 54)

```bash
cd mobile
npm install
npm start
```

### Web App (Next.js 15)

```bash
cd web
npm install
npm run dev
```

## 📦 Tech Stack

- **Mobile**: React Native, Expo SDK 54, Expo Router
- **Web**: Next.js 15.1, React 18.3, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Maps**: Mapbox
- **State**: Zustand + React Query
- **Styling**: Tailwind CSS (Web), NativeWind (Mobile - future)

## 🏗️ Project Structure

```
trailsync/
├── mobile/           # React Native mobile app
│   ├── app/         # Expo Router pages
│   ├── components/  # Reusable components
│   ├── lib/         # Utilities & configs
│   └── stores/      # Zustand stores
├── web/             # Next.js web app
│   ├── app/         # App router pages
│   ├── components/  # React components
│   └── lib/         # Utilities & configs
└── shared/          # Shared types/utils (future)
```

## 🎯 MVP Features

- ✅ Trip Planning Engine
- ✅ AI Itinerary Generator
- ✅ Homestay Discovery
- ✅ Guide Directory
- ✅ User Authentication
- ✅ Admin CMS for verification

## 🔐 Environment Setup

1. Copy `.env.example` to `.env`
2. Add your Supabase credentials
3. Add your Mapbox token
4. Add OpenAI API key (for AI features)

## 📱 Development

**Mobile**:

- iOS: `npm run ios` (macOS only)
- Android: `npm run android`
- Web preview: `npm run web`

**Web**:

- Dev server: `npm run dev`
- Build: `npm run build`
- Start production: `npm start`

## 🎨 Design Theme

**Hybrid Adventure-Modern**:

- Primary: Teal/Turquoise (#15a085)
- Accents: Orange (#FF6B35), Purple (#6C63FF)
- Dark mode: Deep navy (#0A0E27)
- Glassmorphism effects
- Smooth animations

## 📄 License

Proprietary - TrekRiderz 2026

## 🚀 Roadmap

See `implementation_plan.md` for detailed architecture and roadmap.
