/**
 * Drawing protocol types.
 *
 * Coordinates are normalized to the [0,1] range relative to the canvas box so
 * strokes render identically on any screen size / device pixel ratio. Stroke
 * `size` is stored as a fraction of the canvas width for the same reason.
 * Points are stored flat: [x0, y0, x1, y1, ...].
 */

export type DrawMode = "pen" | "eraser";

export interface Stroke {
  id: string;
  color: string;
  /** Line width as a fraction of canvas width. */
  size: number;
  mode: DrawMode;
  /** Flat list of normalized points: [x0, y0, x1, y1, ...]. */
  points: number[];
}

export interface DrawBeginPayload {
  id: string;
  color: string;
  size: number;
  mode: DrawMode;
  x: number;
  y: number;
}

export interface DrawAppendPayload {
  id: string;
  x: number;
  y: number;
}

export interface DrawEndPayload {
  id: string;
}
