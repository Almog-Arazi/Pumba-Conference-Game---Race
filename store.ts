
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { GameStatus, RUN_SPEED_BASE, LeaderboardEntry } from './types';
import { audio } from './components/System/Audio';

interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  maxLives: number;
  speed: number;
  level: number;
  laneCount: number;
  coinsCollected: number;
  parkingCollected: number;
  distance: number;
  countdown: number;
  upcomingParkingLane: number | null;

  // Settings
  handControlsEnabled: boolean;
  hasDoubleJump: boolean;
  isImmortalityActive: boolean;

  // Double Score Bonus
  isDoubleScoreActive: boolean;
  doubleScoreEndTime: number;

  // Gold Bonus — x4 score (one per game)
  isQuadScoreActive: boolean;
  quadScoreEndTime: number;
  goldBonusUsed: boolean;

  // Pause
  isPaused: boolean;
  togglePause: () => void;
  
  // Character Selection
  selectedCharacterId: string;

  // Player registration
  playerName: string;
  playerCompany: string;
  playerContact: string;
  setPlayer: (name: string, company: string, contact: string) => void;

  // Share card
  playerPhoto: string | null;    // segmented photo data URL (captured at onboarding step 0)
  setPlayerPhoto: (url: string | null) => void;

  // Leaderboard
  leaderboard: LeaderboardEntry[];

  // Actions
  startGame: () => void;
  startCountdown: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectCoin: () => void;
  collectParking: () => void;
  collectBonus: () => void;
  collectGoldBonus: () => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  setUpcomingParkingLane: (lane: number | null) => void;
  toggleHandControls: () => void;
  activateImmortality: () => void;
  selectCharacter: (id: string) => void;
  resetLeaderboard: () => void;
}

const HALL_OF_FAME_KEY = 'pumba_hall_of_fame';

const loadLeaderboard = (): LeaderboardEntry[] => {
    try {
        const stored = localStorage.getItem(HALL_OF_FAME_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.VIDEO_INTRO,
  score: 0,
  lives: 5,
  maxLives: 5,
  speed: 0,
  level: 1,
  laneCount: 3,
  coinsCollected: 0,
  parkingCollected: 0,
  distance: 0,
  countdown: 0,
  upcomingParkingLane: null,
  handControlsEnabled: true,
  hasDoubleJump: false,
  isImmortalityActive: false,
  isDoubleScoreActive: false,
  doubleScoreEndTime: 0,
  isQuadScoreActive: false,
  quadScoreEndTime: 0,
  goldBonusUsed: false,
  isPaused: false,
  selectedCharacterId: 'char_10',
  playerName: '',
  playerCompany: '',
  playerContact: '',
  playerPhoto: null,
  leaderboard: loadLeaderboard(),

  startCountdown: () => {
    // Set status to COUNTDOWN
    const startNum = 3;
    set({ status: GameStatus.COUNTDOWN, countdown: startNum });
    
    // Play the Race Start Sound (Mario Kart style) once at the beginning
    audio.playStartSequence();
    
    const timer = setInterval(() => {
        const { countdown } = get();
        if (countdown > 1) {
            set({ countdown: countdown - 1 });
        } else if (countdown === 1) {
            set({ countdown: 0 }); // This will trigger "START!" text in UI
            setTimeout(() => {
                clearInterval(timer);
                get().startGame();
            }, 800);
        }
    }, 1000);
  },

  startGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 5, 
    maxLives: 5,
    speed: RUN_SPEED_BASE,
    level: 1,
    laneCount: 3,
    coinsCollected: 0,
    parkingCollected: 0,
    distance: 0,
    isImmortalityActive: false,
    isDoubleScoreActive: false,
    doubleScoreEndTime: 0,
    isQuadScoreActive: false,
    quadScoreEndTime: 0,
    goldBonusUsed: false,
    isPaused: false,
  }),

  restartGame: () => {
      set({ status: GameStatus.REGISTER, playerPhoto: null });
  },

  setPlayer: (name, company, contact) => set({ playerName: name, playerCompany: company, playerContact: contact }),

  setPlayerPhoto: (url) => set({ playerPhoto: url }),

  toggleHandControls: () => set((state) => ({ handControlsEnabled: !state.handControlsEnabled })),

  takeDamage: () => {
    const { lives, isImmortalityActive } = get();
    // Prevent damage if immortality is active
    if (isImmortalityActive) return;

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      // GAME OVER LOGIC
      const { score, parkingCollected, playerName, playerCompany, playerContact, leaderboard } = get();
      
      const newEntry: LeaderboardEntry = {
          id: uuidv4(),
          name: playerName || 'Anonymous',
          company: playerCompany,
          contact: playerContact,
          parkingCollected,
          score,
          timestamp: Date.now()
      };

      // Keep top 50, sorted by parkingCollected (primary) then score (secondary)
      const newLeaderboard = [...leaderboard, newEntry]
        .sort((a, b) => b.parkingCollected - a.parkingCollected || b.score - a.score)
        .slice(0, 50);
      
      localStorage.setItem(HALL_OF_FAME_KEY, JSON.stringify(newLeaderboard));

      audio.stopMusic(); // Stop music on game over
      audio.playGameOver(); // Play "Loser" sound effect
      set({ 
          lives: 0, 
          status: GameStatus.GAME_OVER, 
          speed: 0,
          leaderboard: newLeaderboard
      });
    }
  },

  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  
  collectCoin: () => set((state) => {
    const multiplier = state.isQuadScoreActive ? 4 : state.isDoubleScoreActive ? 2 : 1;
    return {
      score: state.score + 100 * multiplier,
      coinsCollected: state.coinsCollected + 1,
      speed: state.speed * 1.05,
    };
  }),

  // Parking spot collected: counts separately, awards score with bonus multiplier
  collectParking: () => set((state) => {
    const multiplier = state.isQuadScoreActive ? 4 : state.isDoubleScoreActive ? 2 : 1;
    return {
      parkingCollected: state.parkingCollected + multiplier,
      score: state.score + 200 * multiplier,
    };
  }),

  collectBonus: () => {
    const { status, isDoubleScoreActive } = get();
    if (status !== GameStatus.PLAYING) return;
    const endTime = Date.now() + 5000;
    const wasAlreadyActive = isDoubleScoreActive;
    set({ isDoubleScoreActive: true, doubleScoreEndTime: endTime });
    if (wasAlreadyActive) return; // interval already running — it will read the new endTime
    const tick = setInterval(() => {
      if (Date.now() >= get().doubleScoreEndTime) {
        set({ isDoubleScoreActive: false, doubleScoreEndTime: 0 });
        clearInterval(tick);
      }
    }, 200);
  },

  collectGoldBonus: () => {
    const { status, goldBonusUsed } = get();
    if (status !== GameStatus.PLAYING || goldBonusUsed) return;
    const endTime = Date.now() + 10_000;
    set({ goldBonusUsed: true, isQuadScoreActive: true, quadScoreEndTime: endTime });
    const tick = setInterval(() => {
      if (Date.now() >= get().quadScoreEndTime) {
        clearInterval(tick);
        set({ isQuadScoreActive: false, quadScoreEndTime: 0 });
      }
    }, 200);
  },

  togglePause: () => set(state => ({ isPaused: !state.isPaused })),

  setDistance: (dist) => set({ distance: dist }),

  setUpcomingParkingLane: (lane) => set({ upcomingParkingLane: lane }),

  setStatus: (status) => set({ status }),

  // Implementation of activateImmortality action
  activateImmortality: () => {
    const { status, isImmortalityActive } = get();
    if (status !== GameStatus.PLAYING || isImmortalityActive) return;
    
    set({ isImmortalityActive: true });
    // Immortality effect lasts for a limited duration (e.g., 5 seconds)
    setTimeout(() => {
      set({ isImmortalityActive: false });
    }, 5000);
  },

  selectCharacter: (id: string) => set({ selectedCharacterId: id }),

  resetLeaderboard: () => {
      localStorage.removeItem(HALL_OF_FAME_KEY);
      set({ leaderboard: [] });
  }
}));
