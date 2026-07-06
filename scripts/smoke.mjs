/**
 * End-to-end smoke test for Maskari.
 *
 * Requires the server on http://localhost:3001 (dev or production).
 * Run: npm test
 */
import { io } from "socket.io-client";

const URL = process.env.MASKARI_URL ?? "http://localhost:3001";
const log = (...args) => console.log("[smoke]", ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return io(URL, { transports: ["websocket"], forceNew: true });
}

function waitConnect(sock) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("connect timeout")), 8000);
    sock.once("connect", () => {
      clearTimeout(t);
      resolve();
    });
    sock.once("connect_error", reject);
  });
}

function emitAck(sock, event, payload) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout: ${event}`)),
      10000,
    );
    const done = (res) => {
      clearTimeout(t);
      resolve(res);
    };
    if (payload === undefined) {
      sock.emit(event, done);
    } else {
      sock.emit(event, payload, done);
    }
  });
}

function waitFor(sock, event, predicate = () => true, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout: ${event}`)),
      timeoutMs,
    );
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(t);
      sock.off(event, handler);
      resolve(payload);
    };
    sock.on(event, handler);
  });
}

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    log("PASS", name, detail ? `— ${detail}` : "");
  } else {
    failed++;
    log("FAIL", name, detail ? `— ${detail}` : "");
  }
}

async function run() {
  log("connecting to", URL);

  const host = connect();
  const guest = connect();
  await waitConnect(host);
  await waitConnect(guest);
  check("socket connect", host.connected && guest.connected);

  host.once("conn:pong", (p) => check("conn:pong", !!p.message));
  host.emit("conn:ping", { time: Date.now() });
  await sleep(100);

  const createRes = await emitAck(host, "room:create", {
    nickname: "Alice",
    color: "#3b82f6",
  });
  check("room:create", createRes.ok, createRes.error);
  const roomCode = createRes.data.state.code;
  const hostId = createRes.data.playerId;

  const joinRes = await emitAck(guest, "room:join", {
    roomCode,
    nickname: "Bob",
    color: "#22c55e",
  });
  check("room:join", joinRes.ok, joinRes.error);
  const guestId = joinRes.data.playerId;

  const settingsRes = await emitAck(host, "room:updateSettings", {
    rounds: 1,
    drawTimeSeconds: 30,
  });
  check("room:updateSettings", settingsRes.ok, settingsRes.error);

  const aliceChoicesPromise = waitFor(host, "game:wordChoices");
  const startRes = await emitAck(host, "room:startGame");
  check("room:startGame", startRes.ok, startRes.error);
  const aliceChoices = await aliceChoicesPromise;
  const secretWord = aliceChoices.words[0];
  const aliceWordPromise = waitFor(host, "game:yourWord");
  const turnStartPromise = waitFor(guest, "game:turnStart");
  host.emit("word:choose", { word: secretWord });
  await aliceWordPromise;
  await turnStartPromise;

  let correct = false;
  guest.once("chat:message", (m) => {
    if (m.kind === "correct") correct = true;
  });
  guest.emit("chat:message", { text: secretWord });
  await waitFor(guest, "game:roundEnd");
  check("correct guess", correct);

  const bobChoicesPromise = waitFor(guest, "game:wordChoices");
  const bobChoices = await bobChoicesPromise;
  const bobWord = bobChoices.words[0];
  const bobWordPromise = waitFor(guest, "game:yourWord");
  guest.emit("word:choose", { word: bobWord });
  await bobWordPromise;

  let bobCorrect = false;
  host.once("chat:message", (m) => {
    if (m.kind === "correct") bobCorrect = true;
  });
  host.emit("chat:message", { text: bobWord });
  await waitFor(host, "game:gameOver", undefined, 15000);
  check("game:gameOver", bobCorrect);

  const againRes = await emitAck(host, "room:startGame");
  check("play again", againRes.ok);

  const offlinePromise = waitFor(
    host,
    "room:update",
    (s) => s.players.find((p) => p.id === guestId)?.connected === false,
  );
  guest.disconnect();
  await offlinePromise;
  check("disconnect marks offline", true);

  const reconn = connect();
  await waitConnect(reconn);

  let syncStrokes = null;
  reconn.on("draw:sync", (strokes) => {
    syncStrokes = strokes;
  });

  const reconnectRes = await emitAck(reconn, "room:reconnect", {
    roomCode,
    playerId: guestId,
  });
  check("room:reconnect", reconnectRes.ok, reconnectRes.error);
  await sleep(200);
  check("draw:sync on reconnect", Array.isArray(syncStrokes));

  await waitFor(
    host,
    "room:update",
    (s) => s.players.find((p) => p.id === guestId)?.connected === true,
  );
  check("reconnect marks online", true);

  host.emit("room:leave");
  reconn.emit("room:leave");
  host.close();
  reconn.close();

  log(`done: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("[smoke] error:", err);
  process.exit(1);
});
