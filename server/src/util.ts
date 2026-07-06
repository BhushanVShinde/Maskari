import { randomUUID } from "node:crypto";

/** Characters used for room codes — no ambiguous 0/O/1/I. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generate a short, human-shareable room code. */
export function generateRoomCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Generate a unique player id. */
export function generatePlayerId(): string {
  return randomUUID();
}

/** Trim + collapse whitespace and cap length. */
export function cleanNickname(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLen);
}
