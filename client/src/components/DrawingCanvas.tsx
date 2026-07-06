import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawMode, Stroke } from "@maskari/shared";
import { socket } from "../socket";

const PALETTE = [
  "#000000",
  "#7f8c8d",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#8b5a2b",
];

const SIZES = [4, 8, 14, 24, 38];

let strokeCounter = 0;
function newStrokeId(): string {
  return `${socket.id ?? "s"}-${Date.now()}-${strokeCounter++}`;
}

/**
 * Real-time collaborative canvas. The stroke list is the source of truth and is
 * re-rendered on undo / clear / sync / resize. During active drawing (local or
 * remote) only the newest segment is painted for performance.
 */
export default function DrawingCanvas({ canDraw }: { canDraw: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const indexRef = useRef<Map<string, Stroke>>(new Map());
  const cssSize = useRef({ w: 1, h: 1 });

  // Id of the stroke this client is currently drawing (pointer down).
  const activeIdRef = useRef<string | null>(null);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(8);
  const [mode, setMode] = useState<DrawMode>("pen");

  // Keep latest tool values in refs so pointer handlers read fresh values.
  const toolRef = useRef({ color, size, mode });
  toolRef.current = { color, size, mode };

  /* ---------- rendering ---------- */

  const paintSegment = useCallback((s: Stroke, fromIdx: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { w, h } = cssSize.current;
    const p = s.points;
    ctx.strokeStyle = s.mode === "eraser" ? "#ffffff" : s.color;
    ctx.lineWidth = Math.max(1, s.size * w);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (p.length === 2) {
      // single point -> draw a dot
      ctx.moveTo(p[0] * w, p[1] * h);
      ctx.lineTo(p[0] * w + 0.01, p[1] * h);
    } else {
      ctx.moveTo(p[fromIdx] * w, p[fromIdx + 1] * h);
      ctx.lineTo(p[fromIdx + 2] * w, p[fromIdx + 3] * h);
    }
    ctx.stroke();
  }, []);

  const paintStroke = useCallback(
    (s: Stroke) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const { w, h } = cssSize.current;
      const p = s.points;
      if (p.length < 2) return;
      ctx.strokeStyle = s.mode === "eraser" ? "#ffffff" : s.color;
      ctx.lineWidth = Math.max(1, s.size * w);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (p.length === 2) {
        ctx.moveTo(p[0] * w, p[1] * h);
        ctx.lineTo(p[0] * w + 0.01, p[1] * h);
      } else {
        ctx.moveTo(p[0] * w, p[1] * h);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * w, p[i + 1] * h);
      }
      ctx.stroke();
    },
    [],
  );

  const redrawAll = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { w, h } = cssSize.current;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    for (const s of strokesRef.current) paintStroke(s);
  }, [paintStroke]);

  /* ---------- stroke ops (shared by local + remote) ---------- */

  const opBegin = useCallback(
    (s: Stroke) => {
      strokesRef.current.push(s);
      indexRef.current.set(s.id, s);
      paintSegment(s, 0);
    },
    [paintSegment],
  );

  const opAppend = useCallback(
    (id: string, x: number, y: number) => {
      const s = indexRef.current.get(id);
      if (!s) return;
      const fromIdx = s.points.length - 2;
      s.points.push(x, y);
      paintSegment(s, fromIdx);
    },
    [paintSegment],
  );

  const opUndo = useCallback(
    (strokeId: string) => {
      indexRef.current.delete(strokeId);
      strokesRef.current = strokesRef.current.filter((s) => s.id !== strokeId);
      redrawAll();
    },
    [redrawAll],
  );

  const opClear = useCallback(() => {
    strokesRef.current = [];
    indexRef.current.clear();
    redrawAll();
  }, [redrawAll]);

  const opSync = useCallback(
    (strokes: Stroke[]) => {
      strokesRef.current = strokes.map((s) => ({ ...s, points: [...s.points] }));
      indexRef.current = new Map(strokesRef.current.map((s) => [s.id, s]));
      redrawAll();
    },
    [redrawAll],
  );

  /* ---------- canvas sizing ---------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    ctxRef.current = canvas.getContext("2d");

    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0) return;
      const dpr = window.devicePixelRatio || 1;
      cssSize.current = { w: rect.width, h: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctxRef.current?.setTransform(dpr, 0, 0, dpr, 0, 0);
      redrawAll();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redrawAll]);

  /* ---------- remote events + initial sync ---------- */

  useEffect(() => {
    socket.emit("draw:requestSync", (strokes) => opSync(strokes));

    const onBegin = (p: {
      id: string;
      color: string;
      size: number;
      mode: DrawMode;
      x: number;
      y: number;
    }) =>
      opBegin({
        id: p.id,
        color: p.color,
        size: p.size,
        mode: p.mode,
        points: [p.x, p.y],
      });
    const onAppend = (p: { id: string; x: number; y: number }) =>
      opAppend(p.id, p.x, p.y);
    const onUndo = (p: { strokeId: string }) => opUndo(p.strokeId);

    socket.on("draw:begin", onBegin);
    socket.on("draw:append", onAppend);
    socket.on("draw:clear", opClear);
    socket.on("draw:undo", onUndo);
    socket.on("draw:sync", opSync);

    return () => {
      socket.off("draw:begin", onBegin);
      socket.off("draw:append", onAppend);
      socket.off("draw:clear", opClear);
      socket.off("draw:undo", onUndo);
      socket.off("draw:sync", opSync);
    };
  }, [opBegin, opAppend, opClear, opUndo, opSync]);

  /* ---------- local pointer input ---------- */

  function normPoint(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!canDraw) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = normPoint(e);
    const { color: c, size: sPx, mode: m } = toolRef.current;
    const sizeNorm = sPx / cssSize.current.w;
    const id = newStrokeId();
    activeIdRef.current = id;
    const stroke: Stroke = { id, color: c, size: sizeNorm, mode: m, points: [x, y] };
    opBegin(stroke);
    socket.emit("draw:begin", { id, color: c, size: sizeNorm, mode: m, x, y });
  }

  function onPointerMove(e: React.PointerEvent) {
    const id = activeIdRef.current;
    if (!id) return;
    const { x, y } = normPoint(e);
    opAppend(id, x, y);
    socket.emit("draw:append", { id, x, y });
  }

  function endStroke() {
    const id = activeIdRef.current;
    if (!id) return;
    activeIdRef.current = null;
    socket.emit("draw:end", { id });
  }

  /* ---------- toolbar actions ---------- */

  function handleClear() {
    if (!canDraw) return;
    opClear();
    socket.emit("draw:clear");
  }

  function handleUndo() {
    if (!canDraw) return;
    // Optimistically remove our own last stroke; server confirms via draw:undo.
    socket.emit("draw:undo");
  }

  return (
    <div className="canvas-area">
      <div
        ref={wrapRef}
        className={`canvas-wrap ${canDraw ? "" : "canvas-wrap--view"}`}
      >
        <canvas
          ref={canvasRef}
          className="canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          style={{ touchAction: "none", cursor: canDraw ? "crosshair" : "default" }}
        />
      </div>

      {canDraw && (
        <div className="toolbar">
          <div className="tool-colors">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`swatch swatch--sm ${
                  color === c && mode === "pen" ? "swatch--active" : ""
                }`}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setMode("pen");
                }}
                aria-label={`color ${c}`}
              />
            ))}
          </div>

          <div className="tool-sizes">
            {SIZES.map((s) => (
              <button
                key={s}
                className={`size-btn ${size === s ? "size-btn--active" : ""}`}
                onClick={() => setSize(s)}
                aria-label={`brush ${s}`}
              >
                <span
                  className="size-dot"
                  style={{ width: s / 2 + 4, height: s / 2 + 4 }}
                />
              </button>
            ))}
          </div>

          <div className="tool-actions">
            <button
              className={`tool-btn ${mode === "pen" ? "tool-btn--active" : ""}`}
              onClick={() => setMode("pen")}
            >
              Pen
            </button>
            <button
              className={`tool-btn ${mode === "eraser" ? "tool-btn--active" : ""}`}
              onClick={() => setMode("eraser")}
            >
              Eraser
            </button>
            <button className="tool-btn" onClick={handleUndo}>
              Undo
            </button>
            <button className="tool-btn tool-btn--danger" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
