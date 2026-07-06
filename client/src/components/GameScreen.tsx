import type { ChatMessage, Player, RoomState } from "@maskari/shared";
import type { RoundEndPayload } from "@maskari/shared";
import DrawingCanvas from "./DrawingCanvas";
import CountdownTimer from "./CountdownTimer";
import WordChoiceModal from "./WordChoiceModal";
import RoundEndOverlay from "./RoundEndOverlay";
import ChatPanel from "./ChatPanel";
import SoundToggle from "./SoundToggle";

type Props = {
  state: RoomState;
  me: Player | null;
  isHost: boolean;
  isDrawer: boolean;
  hasGuessed: boolean;
  myWord: string | null;
  wordChoices: string[] | null;
  chooseEndsAt: number | null;
  lastRoundEnd: RoundEndPayload | null;
  chatMessages: ChatMessage[];
  chooseWord: (word: string) => void;
  sendChat: (text: string) => void;
  returnToLobby: () => void;
  leaveRoom: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
};

export default function GameScreen({
  state,
  me,
  isHost,
  isDrawer,
  hasGuessed,
  myWord,
  wordChoices,
  chooseEndsAt,
  lastRoundEnd,
  chatMessages,
  chooseWord,
  sendChat,
  returnToLobby,
  leaveRoom,
  soundOn,
  onToggleSound,
}: Props) {
  const canDraw = state.phase === "drawing" && isDrawer;

  const drawer = state.players.find((p) => p.id === state.currentDrawerId);
  const players = [...state.players].sort((a, b) => b.score - a.score);

  const showWordModal =
    isDrawer &&
    state.phase === "choosing" &&
    wordChoices &&
    wordChoices.length > 0 &&
    chooseEndsAt;

  const roundEndData =
    state.phase === "roundEnd" && lastRoundEnd ? lastRoundEnd : null;

  return (
    <div className={`game ${state.phase === "roundEnd" ? "game--round-end" : ""}`}>
      <header className="game__head">
        <div className="game__title">
          <strong>Maskari</strong>
          <span className="chip">Room {state.code}</span>
          <span className="chip chip--muted">
            Round {state.round}/{state.totalRounds}
          </span>
        </div>
        <div className="game__actions">
          <SoundToggle enabled={soundOn} onToggle={onToggleSound} />
          {isHost && (
            <button className="btn btn--ghost btn--sm" onClick={returnToLobby}>
              Back to lobby
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </header>

      <div className="game__status">
        {state.phase === "choosing" && drawer && (
          <p className="status-banner status-banner--choosing">
            <span className="avatar avatar--sm" style={{ background: drawer.color }} />
            <strong>{drawer.nickname}</strong> is choosing a word…
            {isDrawer && <span className="you"> (that's you!)</span>}
          </p>
        )}

        {state.phase === "drawing" && (
          <div className="word-bar">
            {isDrawer && myWord ? (
              <div className="word-bar__drawer">
                <span className="word-bar__label">Draw this word:</span>
                <span className="word-bar__secret">{myWord}</span>
              </div>
            ) : (
              <div className="word-bar__guesser">
                <span className="word-bar__label">
                  {state.wordLength} letters
                </span>
                <span className="word-bar__blanks">{state.maskedWord}</span>
              </div>
            )}
            <CountdownTimer endsAt={state.turnEndsAt} label="Time left" />
          </div>
        )}

        {state.phase === "roundEnd" && state.revealWord && (
          <p className="status-banner status-banner--reveal">
            The word was: <strong>{state.revealWord}</strong>
          </p>
        )}
      </div>

      <div className="game__body game__body--with-chat">
        <aside className="sidebar">
          <h2 className="panel__title">Players</h2>
          <ul className="players">
            {players.map((p) => (
              <li
                key={p.id}
                className={`player ${p.id === state.currentDrawerId ? "player--drawer" : ""} ${state.correctGuessers.includes(p.id) ? "player--guessed" : ""}`}
              >
                <span className="avatar" style={{ background: p.color }} />
                <span className="player__name">
                  {p.nickname}
                  {p.id === me?.id && <span className="you"> (you)</span>}
                  {p.id === state.currentDrawerId && (
                    <span className="drawer-tag"> drawing</span>
                  )}
                  {state.correctGuessers.includes(p.id) && (
                    <span className="guessed-tag"> ✓</span>
                  )}
                  {!p.connected && (
                    <span className="offline-tag"> offline</span>
                  )}
                </span>
                <span className="score">{p.score}</span>
              </li>
            ))}
          </ul>
        </aside>

        <main className="stage">
          <DrawingCanvas canDraw={canDraw} />
        </main>

        <ChatPanel
          messages={chatMessages}
          phase={state.phase}
          isDrawer={isDrawer}
          hasGuessed={hasGuessed}
          onSend={sendChat}
        />
      </div>

      {showWordModal && (
        <WordChoiceModal
          words={wordChoices}
          chooseEndsAt={chooseEndsAt}
          onChoose={chooseWord}
        />
      )}

      {roundEndData && (
        <RoundEndOverlay
          word={roundEndData.word}
          drawerName={roundEndData.drawerNickname}
          roundScores={roundEndData.roundScores}
          roundEndEndsAt={roundEndData.roundEndEndsAt}
        />
      )}
    </div>
  );
}
