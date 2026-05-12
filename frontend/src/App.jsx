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

function App() {
  const [page, setPage] = useState("home");
  const [state, setState] = useState(null);
  const [notification, setNotification] = useState(null);

  const goTo = (p) => setPage(p);

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
            ...(remoteState.settings || {})
          },
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

  if (!state) {
    return (
      <div className="app-loading">
        <p>Загружаю библиотеку...</p>
      </div>
    );
  }

  return (
    <>
      <Header goTo={goTo} current={page} />

      {page === "home" && <Home goTo={goTo} />}
      {page === "upload" && (
        <Upload state={state} setState={setState} goTo={goTo} setNotification={setNotification} />
      )}
      {page === "game" && (
        <Game state={state} setState={setState} goTo={goTo} setNotification={setNotification} />
      )}
      {page === "leaderboard" && <Leaderboard state={state} />}
      {page === "settings" && <Settings state={state} setState={setState} />}
      {page === "result" && <Result state={state} goTo={goTo} />}

      <Notification data={notification} />
    </>
  );
}

export default App;
