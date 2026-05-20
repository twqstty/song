import { useEffect, useState } from "react";
import Header from "./components/Header/Header";
import Home from "./components/Home/Home";
import Upload from "./components/Upload/Upload";
import Game from "./components/Game/Game";
import Leaderboard from "./components/Leaderboard/Leaderboard";
import Settings from "./components/Settings/Settings";
import Result from "./components/Result/Result";
import Notification from "./components/Notification/Notification";

import { initialState } from "./components/initialState";
import "./App.css";

const API_BASE = "/api";

function createPlayerId() {
  return globalThis.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function App() {
  const [page, setPage] = useState("home");
  const [state, setState] = useState(null);
  const [notification, setNotification] = useState(null);
  const [registrationName, setRegistrationName] = useState("");

  useEffect(() => {
    let isActive = true;

    const loadState = async () => {
      try {
        const response = await fetch(`${API_BASE}/state`);

        if (!response.ok) {
          throw new Error("Failed to load state");
        }

        const remoteState = await response.json();

        if (!isActive) {
          return;
        }

        setState({
          ...initialState,
          ...remoteState,
          artists: Array.isArray(remoteState.artists) ? remoteState.artists : initialState.artists,
          tracks: Array.isArray(remoteState.tracks) ? remoteState.tracks : initialState.tracks,
          settings: {
            ...initialState.settings,
            rounds: remoteState.settings?.rounds || initialState.settings.rounds,
            autoPlay: remoteState.settings?.autoPlay ?? initialState.settings.autoPlay,
            allowSkip: remoteState.settings?.allowSkip ?? initialState.settings.allowSkip,
            showProgress: remoteState.settings?.showProgress ?? initialState.settings.showProgress
          },
          players: Array.isArray(remoteState.players) ? remoteState.players : initialState.players,
          currentPlayer: remoteState.currentPlayer || initialState.currentPlayer,
          leaderboard: Array.isArray(remoteState.leaderboard)
            ? remoteState.leaderboard
            : initialState.leaderboard,
          game: {
            ...initialState.game,
            ...(remoteState.game || {})
          }
        });
      } catch (error) {
        console.error("Failed to load backend state", error);

        if (isActive) {
          setState(initialState);
        }
      }
    };

    loadState();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    const controller = new AbortController();

    const saveState = async () => {
      try {
        await fetch(`${API_BASE}/state`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(state),
          signal: controller.signal
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Failed to save backend state", error);
        }
      }
    };

    saveState();

    return () => {
      controller.abort();
    };
  }, [state]);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setNotification(null);
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [notification]);

  if (!state) {
    return (
      <div className="app-loading">
        <p>Загружаю библиотеку...</p>
      </div>
    );
  }

  const registerPlayer = (event) => {
    event.preventDefault();

    const name = registrationName.trim().replace(/\s+/g, " ");

    if (!name) {
      setNotification({
        text: "Введите имя, чтобы начать игру.",
        type: "error"
      });
      return;
    }

    setState((currentState) => {
      const role = currentState.players.length ? "user" : "admin";
      const player = {
        id: createPlayerId(),
        name: name.slice(0, 20),
        role,
        registeredAt: new Date().toISOString()
      };

      return {
        ...currentState,
        players: [...currentState.players, player],
        currentPlayer: player
      };
    });
    setRegistrationName("");
  };

  const loginAsPlayer = (playerId) => {
    const player = state.players.find((item) => item.id === playerId);

    if (!player) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      currentPlayer: player
    }));
  };

  const logoutPlayer = () => {
    setPage("home");
    setState((currentState) => ({
      ...currentState,
      currentPlayer: null
    }));
  };

  if (!state.currentPlayer?.name) {
    return (
      <>
        <main className="registration">
          <section className="registration__card">
            <p className="registration__eyebrow">SOUNDQUIZ ACCESS</p>
            <h1>Представься перед входом</h1>
            <p className="registration__lead">
              Имя сохранится на сервере и будет использоваться в результатах и таблице лидеров.
              Старый leaderboard уже можно начать заново с чистого листа.
            </p>

            <form className="registration__form" onSubmit={registerPlayer}>
              <label>
                <span>Имя игрока</span>
                <input
                  type="text"
                  value={registrationName}
                  maxLength={20}
                  autoFocus
                  placeholder="Например, Босс"
                  onChange={(event) => setRegistrationName(event.target.value)}
                />
              </label>

              <button type="submit">Войти на сайт</button>
            </form>

            {state.players.length ? (
              <div className="registration__accounts">
                <span>Уже созданные аккаунты</span>
                <div>
                  {state.players.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => loginAsPlayer(player.id)}
                    >
                      <strong>{player.name}</strong>
                      <small>{player.role}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </main>

        <Notification data={notification} />
      </>
    );
  }

  const isAdmin = state.currentPlayer?.role === "admin";
  const safeGoTo = (nextPage) => {
    if (nextPage === "upload" && !isAdmin) {
      setNotification({
        text: "Раздел загрузки доступен только администратору.",
        type: "error"
      });
      setPage("home");
      return;
    }

    setPage(nextPage);
  };

  const visiblePage = page === "upload" && !isAdmin ? "home" : page;

  return (
    <>
      <Header
        goTo={safeGoTo}
        current={visiblePage}
        currentPlayer={state.currentPlayer}
        onLogout={logoutPlayer}
      />

      {visiblePage === "home" && <Home goTo={safeGoTo} isAdmin={isAdmin} />}
      {visiblePage === "upload" && isAdmin && (
        <Upload state={state} setState={setState} goTo={safeGoTo} setNotification={setNotification} />
      )}
      {visiblePage === "game" && (
        <Game state={state} setState={setState} goTo={safeGoTo} setNotification={setNotification} />
      )}
      {visiblePage === "leaderboard" && <Leaderboard state={state} />}
      {visiblePage === "settings" && <Settings state={state} setState={setState} />}
      {visiblePage === "result" && <Result state={state} goTo={safeGoTo} />}

      <Notification data={notification} />
    </>
  );
}

export default App;
