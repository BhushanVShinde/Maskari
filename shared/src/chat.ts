/** A single chat / guess message shown in the game panel. */
export type ChatMessageKind =
  | "chat"
  | "correct"
  | "system"
  | "private";

export interface ChatMessage {
  id: string;
  kind: ChatMessageKind;
  playerId?: string;
  playerName?: string;
  text: string;
  timestamp: number;
  /** Points earned (private correct-guess confirmations). */
  points?: number;
}

export interface ChatSendPayload {
  text: string;
}
