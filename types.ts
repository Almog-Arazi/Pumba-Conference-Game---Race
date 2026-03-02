
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export enum GameStatus {
  VIDEO_INTRO = 'VIDEO_INTRO', // fullscreen intro video sequence
  REGISTER = 'REGISTER',       // player name / company registration
  INTRO = 'INTRO',             // instructions / onboarding screen
  MENU = 'MENU',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  SHOP = 'SHOP',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum ObjectType {
  OBSTACLE = 'OBSTACLE',
  COIN = 'COIN',
  SHOP_PORTAL = 'SHOP_PORTAL',
  ALIEN = 'ALIEN',
  MISSILE = 'MISSILE',
  CV_GATE = 'CV_GATE',
  BONUS = 'BONUS',
  GOLD_BONUS = 'GOLD_BONUS'
}

export interface GameObject {
  id: string;
  type: ObjectType;
  subType?: string;
  position: [number, number, number]; // x, y, z
  active: boolean;
  color?: string;
  hasFired?: boolean; // For Aliens
}

export const LANE_WIDTH = 2.2;
export const JUMP_HEIGHT = 2.5;
export const JUMP_DURATION = 0.6; // seconds
export const RUN_SPEED_BASE = 22.5;
export const SPAWN_DISTANCE = 120;
export const REMOVE_DISTANCE = 20; // Behind player

export interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: any; // Lucide icon component
    oneTime?: boolean; // If true, remove from pool after buying
}

export interface LeaderboardEntry {
    id: string;
    name: string;
    company: string;
    contact: string; // phone or email, optional
    parkingCollected: number;
    score: number;
    timestamp: number;
}
