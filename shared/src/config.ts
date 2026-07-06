/**
 * Central, tunable configuration. Keep all "magic numbers" here so game
 * balance and constraints can be adjusted in one place.
 */

import type { GameSettings } from "./types.js";

/** Avatar colors players can pick in the lobby. */
export const AVATAR_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // pink
  "#78716c", // stone
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Default room settings applied when a room is created. */
export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3,
  drawTimeSeconds: 80,
  maxPlayers: 8,
};

/** Allowed ranges for host-configurable settings (inclusive). */
export const SETTINGS_LIMITS = {
  rounds: { min: 1, max: 10 },
  drawTimeSeconds: { min: 30, max: 180 },
  maxPlayers: { min: 2, max: 12 },
} as const;

/** Minimum players required before the host can start a game. */
export const MIN_PLAYERS_TO_START = 2;

/** Nickname length constraints. */
export const NICKNAME = { min: 1, max: 16 } as const;

/** How many word options the drawer is offered each turn. */
export const WORD_CHOICE_COUNT = 3;

/** Turn/round pacing (seconds). */
export const TIMING = {
  /** Time the drawer has to pick a word before an auto-pick. */
  chooseSeconds: 10,
  /** Pause on the round-end reveal before the next turn. */
  roundEndSeconds: 6,
  /** How long a disconnected player can reconnect before being removed. */
  disconnectGraceSeconds: 90,
} as const;

/**
 * Scoring constants (Step 5 uses these). Kept here so game balance lives in one
 * file.
 */
export const SCORING = {
  /** Base points for a correct guess (scaled by time remaining). */
  basePoints: 500,
  /** Floor so a last-second correct guess still earns something. */
  minPoints: 50,
  /** Bonus for the first correct guesser of the round. */
  firstGuessBonus: 50,
  /** Max points a drawer can earn in a turn (scaled by % who guessed). */
  drawerMaxPoints: 100,
} as const;

/** Clamp a setting value into its allowed range. */
export function clampSetting(
  key: keyof typeof SETTINGS_LIMITS,
  value: number,
): number {
  const { min, max } = SETTINGS_LIMITS[key];
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Sanitize and enforce all settings coming from an (untrusted) client. */
export function sanitizeSettings(input: Partial<GameSettings>): GameSettings {
  return {
    rounds: clampSetting("rounds", input.rounds ?? DEFAULT_SETTINGS.rounds),
    drawTimeSeconds: clampSetting(
      "drawTimeSeconds",
      input.drawTimeSeconds ?? DEFAULT_SETTINGS.drawTimeSeconds,
    ),
    maxPlayers: clampSetting(
      "maxPlayers",
      input.maxPlayers ?? DEFAULT_SETTINGS.maxPlayers,
    ),
  };
}
