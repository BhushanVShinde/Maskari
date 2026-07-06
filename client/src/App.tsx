import Landing from "./components/Landing";
import Lobby from "./components/Lobby";
import GameScreen from "./components/GameScreen";
import GameOverScreen from "./components/GameOverScreen";
import { useRoom } from "./useRoom";

function ConnectionBanner({
  connected,
  reconnecting,
}: {
  connected: boolean;
  reconnecting: boolean;
}) {
  if (connected && !reconnecting) return null;
  return (
    <div className="conn-banner" role="status">
      {reconnecting
        ? "Reconnecting to your room…"
        : "Connection lost — trying to reconnect…"}
    </div>
  );
}

export default function App() {
  const {
    connected,
    reconnecting,
    state,
    me,
    isHost,
    isDrawer,
    hasGuessed,
    closedReason,
    wordChoices,
    chooseEndsAt,
    myWord,
    chatMessages,
    lastRoundEnd,
    gameOverInfo,
    soundOn,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    chooseWord,
    sendChat,
    returnToLobby,
    leaveRoom,
    toggleSound,
  } = useRoom();

  const banner = (
    <ConnectionBanner connected={connected} reconnecting={reconnecting} />
  );

  if (state?.phase === "gameOver") {
    return (
      <>
        {banner}
        <GameOverScreen
          players={state.players}
          me={me}
          isHost={isHost}
          winnerId={gameOverInfo?.winnerId ?? null}
          winnerNickname={gameOverInfo?.winnerNickname ?? null}
          onPlayAgain={startGame}
          onBackToLobby={returnToLobby}
          onLeave={leaveRoom}
        />
      </>
    );
  }

  if (state && state.phase !== "lobby") {
    return (
      <>
        {banner}
        <GameScreen
          state={state}
          me={me}
          isHost={isHost}
          isDrawer={isDrawer}
          hasGuessed={hasGuessed}
          myWord={myWord}
          wordChoices={wordChoices}
          chooseEndsAt={chooseEndsAt}
          lastRoundEnd={lastRoundEnd}
          chatMessages={chatMessages}
          chooseWord={chooseWord}
          sendChat={sendChat}
          returnToLobby={returnToLobby}
          leaveRoom={leaveRoom}
          soundOn={soundOn}
          onToggleSound={toggleSound}
        />
      </>
    );
  }

  if (state) {
    return (
      <>
        {banner}
        <Lobby
          state={state}
          me={me}
          isHost={isHost}
          updateSettings={updateSettings}
          startGame={startGame}
          leaveRoom={leaveRoom}
          soundOn={soundOn}
          onToggleSound={toggleSound}
        />
      </>
    );
  }

  return (
    <>
      {banner}
      {closedReason && <div className="toast">{closedReason}</div>}
      <Landing
        connected={connected}
        createRoom={createRoom}
        joinRoom={joinRoom}
        soundOn={soundOn}
        onToggleSound={toggleSound}
      />
    </>
  );
}
