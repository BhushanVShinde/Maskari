import type { ChatMessage, Player, RoomState } from "@maskari/shared";
import type { RoundEndPayload } from "@maskari/shared";
import DrawingCanvas from "./DrawingCanvas";
import CountdownTimer from "./CountdownTimer";
import WordChoiceModal from "./WordChoiceModal";
import RoundEndOverlay from "./RoundEndOverlay";
import ChatPanel from "./ChatPanel";
import PlayerSlot from "./PlayerSlot";
import SoundToggle from "./SoundToggle";
import Avatar from "./Avatar";
import WordTiles from "./WordTiles";

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
  const leaderId = players[0]?.id;

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
      <header className="game__topbar">
        <div className="game__brand">
          Maskari<span>.io</span>
        </div>
        <div className="game__chips">
          <span className="chip">Room {state.code}</span>
          <span className="chip">Round {state.round}/{state.totalRounds}</span>
        </div>
        <div className="game__actions">
          <SoundToggle enabled={soundOn} onToggle={onToggleSound} />
          {isHost && (
            <button className="btn btn--ghost btn--sm" type="button" onClick={returnToLobby}>
              Lobby
            </button>
          )}
          <button className="btn btn--ghost btn--sm" type="button" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </header>

      {(state.phase === "choosing" || state.phase === "drawing" || state.phase === "roundEnd") && (
        <div className="game__wordstage">
          {state.phase === "choosing" && drawer && (
            <p className="wordstage__banner">
              <Avatar nickname={drawer.nickname} color={drawer.color} size="sm" />
              <strong>{drawer.nickname}</strong> is choosing a word…
              {isDrawer && <span className="you"> (You)</span>}
            </p>
          )}

          {state.phase === "drawing" && drawer && (
            <>
              <p className="wordstage__banner wordstage__banner--draw">
                {isDrawer ? (
                  <>✏️ You are drawing!</>
                ) : (
                  <>
                    <Avatar nickname={drawer.nickname} color={drawer.color} size="sm" />
                    <strong>{drawer.nickname}</strong> is drawing!
                  </>
                )}
              </p>
              {isDrawer && myWord ? (
                <div className="wordstage__secret">{myWord}</div>
              ) : (
                <>
                  {state.maskedWord && (
                    <WordTiles masked={state.maskedWord} hintCount={state.hintCount} />
                  )}
                  <p className="wordstage__hint">
                    {state.wordLength} letters — type your guess in chat
                  </p>
                </>
              )}
              <CountdownTimer
                endsAt={state.turnEndsAt}
                totalSeconds={state.settings.drawTimeSeconds}
                label="Time left"
              />
            </>
          )}

          {state.phase === "roundEnd" && state.revealWord && (
            <>
              <p className="wordstage__banner">The word was</p>
              <div className="wordstage__secret">{state.revealWord}</div>
            </>
          )}
        </div>
      )}

      <div className="game__body">
        <aside className="game__sidebar">
          <div className="game__sidebar-head">Players</div>
          <ul className="game__sidebar-list">
            {players.map((p) => (
              <PlayerSlot
                key={p.id}
                player={p}
                meId={me?.id}
                isDrawer={p.id === state.currentDrawerId}
                hasGuessed={state.correctGuessers.includes(p.id)}
                isLeader={p.id === leaderId && state.phase === "drawing"}
                score={p.score}
                compact
              />
            ))}
          </ul>
        </aside>

        <main className="game__stage">
          <DrawingCanvas canDraw={canDraw} drawerName={drawer?.nickname} />
        </main>

        <ChatPanel
          messages={chatMessages}
          players={state.players}
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
