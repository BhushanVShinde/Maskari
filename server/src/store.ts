import { Room } from "./room.js";
import type { GameSettings } from "@maskari/shared";
import { generateRoomCode } from "./util.js";

/**
 * Storage abstraction for rooms. The rest of the server depends only on this
 * interface, so an in-memory Map today can be swapped for Redis / a database
 * later without touching the socket handlers.
 */
export interface RoomStore {
  create(settings?: GameSettings): Room;
  get(code: string): Room | undefined;
  delete(code: string): void;
  count(): number;
}

/** Simple in-memory implementation backed by a Map. */
export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  create(settings?: GameSettings): Room {
    // Ensure the generated code is unique.
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }
    const room = new Room(code, settings);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  delete(code: string): void {
    this.rooms.delete(code.toUpperCase());
  }

  count(): number {
    return this.rooms.size;
  }
}
