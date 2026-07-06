import { SCORING } from "./config.js";

/** Normalize a guess or word for comparison. */
export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isCorrectGuess(guess: string, word: string): boolean {
  return normalizeText(guess) === normalizeText(word);
}

/** True when the guess is one edit away from the word (nice-to-have hint). */
export function isCloseGuess(guess: string, word: string): boolean {
  const a = normalizeText(guess);
  const b = normalizeText(word);
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  return levenshtein(a, b) <= 1;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/**
 * Points for a correct guesser. Scales with time remaining; first correct
 * guesser earns a bonus.
 */
export function scoreGuesser(
  timeRemainingMs: number,
  totalTimeMs: number,
  isFirstCorrect: boolean,
): number {
  const ratio =
    totalTimeMs > 0
      ? Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs))
      : 0;
  let pts = Math.round(SCORING.basePoints * ratio);
  pts = Math.max(SCORING.minPoints, pts);
  if (isFirstCorrect) pts += SCORING.firstGuessBonus;
  return pts;
}

/**
 * Drawer points at end of turn based on how many guessers got it.
 * Returns 0 if nobody guessed correctly.
 */
export function scoreDrawer(correctCount: number, guesserCount: number): number {
  if (guesserCount <= 0 || correctCount <= 0) return 0;
  return Math.round(
    SCORING.drawerMaxPoints * (correctCount / guesserCount),
  );
}
