const SESSION_KEY = "maskari:session";

export interface RoomSession {
  roomCode: string;
  playerId: string;
}

export function loadSession(): RoomSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomSession>;
    if (
      typeof parsed.roomCode === "string" &&
      typeof parsed.playerId === "string" &&
      parsed.roomCode.length > 0 &&
      parsed.playerId.length > 0
    ) {
      return {
        roomCode: parsed.roomCode.toUpperCase(),
        playerId: parsed.playerId,
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

export function saveSession(roomCode: string, playerId: string): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ roomCode: roomCode.toUpperCase(), playerId }),
  );
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
