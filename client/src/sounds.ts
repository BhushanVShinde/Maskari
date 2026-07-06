/** Lightweight Web Audio cues — no asset files, muted by default until toggled on. */

const STORAGE_KEY = "maskari:sounds";

let enabled = localStorage.getItem(STORAGE_KEY) === "true";
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  frequency: number,
  durationSec: number,
  type: OscillatorType = "sine",
  volume = 0.12,
): void {
  const ac = audioContext();
  if (!ac) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + durationSec);
  osc.stop(ac.currentTime + durationSec);
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean): void {
  enabled = next;
  localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
  if (next) void audioContext()?.resume();
}

export function playCorrectGuess(): void {
  tone(880, 0.12);
  window.setTimeout(() => tone(1175, 0.18), 90);
}

export function playTurnStart(): void {
  tone(523, 0.1);
  window.setTimeout(() => tone(659, 0.14), 80);
}

export function playRoundEnd(): void {
  tone(392, 0.18);
  window.setTimeout(() => tone(494, 0.22), 120);
}
