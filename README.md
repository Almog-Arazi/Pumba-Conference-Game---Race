# Pumba Conference Race Game

An interactive 3D parking race game built for conference booths and live events. Players dodge obstacles, collect parking spots, and compete on a live leaderboard — all controlled by hand gestures via their device camera.

## Features

- **Hand Gesture Controls** — Swipe left/right to change lanes, raise hand to jump. Powered by MediaPipe Gesture Recognition.
- **3D Racing Gameplay** — Built with React Three Fiber. Dodge obstacles, collect coins and parking bonuses across expanding lanes.
- **Conference Registration** — Players register with name and company before playing.
- **Live Leaderboard** — Hall of fame ranking players by parking spots collected.
- **Share Card** — Auto-generates a personalized share card with player photo (background removed via MediaPipe), score, and branding.
- **Admin Panel** — `/admin` route for event organizers to manage the leaderboard and game settings.
- **Calibration Tools** — Camera angle and player photo positioning can be fine-tuned for any screen setup.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** — Dev server and build
- **React Three Fiber** / **Three.js** — 3D rendering
- **Zustand** — State management
- **MediaPipe** — Hand gesture recognition and selfie segmentation
- **Framer Motion** — UI animations

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

The game will be available at `http://localhost:5000`.

## Project Structure

```
├── App.tsx                  # Main app with 3D canvas and background video
├── store.ts                 # Zustand game state
├── types.ts                 # Game types and constants
├── components/
│   ├── System/
│   │   ├── GestureController.tsx   # MediaPipe hand tracking
│   │   ├── Audio.ts                # Sound effects and music
│   │   └── photoCapture.ts         # Selfie segmentation + share card
│   ├── UI/
│   │   ├── HUD.tsx                 # In-game heads-up display
│   │   ├── RegisterScreen.tsx      # Player registration
│   │   ├── OnboardingScreen.tsx    # Instructions and calibration
│   │   ├── HallOfFame.tsx          # Leaderboard
│   │   └── ShareCard.tsx           # Post-game share card
│   └── World/
│       ├── Environment.tsx         # Road, buildings, skybox
│       ├── Player.tsx              # Player car/character
│       ├── LevelManager.tsx        # Obstacle and item spawning
│       └── Effects.tsx             # Post-processing effects
├── AdminPage.tsx            # Admin panel
├── CalibrationPage.tsx      # Camera calibration tool
└── public/                  # Static assets (videos, images, audio)
```

## Build for Production

```bash
npm run build
```

Output goes to `dist/`, ready for deployment on Vercel or any static host.
