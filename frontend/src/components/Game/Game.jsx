import { useEffect, useMemo, useRef, useState } from "react";
import "./Game.css";

const ARTIST_PLACEHOLDER = "/artists/placeholder.svg";
const ROUND_TIME_SECONDS = 10;
const POINTS_PER_CORRECT = 300;

function normalizeAnswer(value) {
  return value
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[()"'`.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtistName(value) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function getArtistImageSrc(image) {
  return image?.trim() || ARTIST_PLACEHOLDER;
}

export default function Game({ state, setState, goTo, setNotification }) {
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_SECONDS);
  const [answer, setAnswer] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const nextRoundTimeoutRef = useRef(null);
  const hasArtistCards = state.artists.length > 0;
  const currentPlayer = state.currentPlayer || {};
  const playerName = currentPlayer.name || "Игрок";

  const playableTracks = useMemo(
    () => state.tracks.filter((track) => track.audioUrl && track.answer.trim() && track.title.trim()),
    [state.tracks]
  );

  const artists = useMemo(
    () =>
      state.artists
        .map((artist) => ({
          ...artist,
          tracks: playableTracks.filter((track) => track.artistId === artist.id)
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [state.artists, playableTracks]
  );

  const filteredArtists = useMemo(() => {
    const query = normalizeArtistName(artistQuery);

    if (!query) {
      return artists;
    }

    return artists.filter((artist) => normalizeArtistName(artist.name).includes(query));
  }, [artistQuery, artists]);

  const selectedArtist = artists.find((artist) => artist.id === selectedArtistId) || null;
  const selectedTracks = selectedArtist?.tracks || [];
  const maxRounds = Math.min(state.settings.rounds, selectedTracks.length);
  const track = selectedTracks[round - 1];
  const progressPercent = Math.max(0, (timeLeft / ROUND_TIME_SECONDS) * 100);

  const resetRoundState = () => {
    setAnswer("");
    setFeedback(null);
    setIsPlaying(false);
    setTimeLeft(ROUND_TIME_SECONDS);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const startArtistSession = (artistId) => {
    setSelectedArtistId(artistId);
    setRound(1);
    setScore(0);
    resetRoundState();
  };

  useEffect(() => {
    if (!selectedArtist || !track || feedback) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setFeedback({
            type: "error",
            text: `Время вышло. Правильный ответ: ${track.answer || track.title}`,
            advance: true
          });
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedArtist, track, feedback]);

  useEffect(() => {
    if (!state.settings.autoPlay || !track || !audioRef.current) {
      return;
    }

    const playPromise = audioRef.current.play();

    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  }, [track, round, state.settings.autoPlay]);

  useEffect(() => {
    if (!feedback?.advance) {
      return;
    }

    if (nextRoundTimeoutRef.current) {
      clearTimeout(nextRoundTimeoutRef.current);
    }

    nextRoundTimeoutRef.current = setTimeout(() => {
      if (round >= maxRounds) {
        setState((currentState) => ({
          ...currentState,
          game: {
            score
          },
          leaderboard: [...currentState.leaderboard, {
            playerId: currentState.currentPlayer?.id || currentPlayer.id,
            name: currentState.currentPlayer?.name || playerName,
            role: currentState.currentPlayer?.role || currentPlayer.role || "user",
            score
          }].sort((a, b) => b.score - a.score)
        }));

        goTo("result");
        return;
      }

      setAnswer("");
      setFeedback(null);
      setIsPlaying(false);
      setTimeLeft(ROUND_TIME_SECONDS);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      setRound((currentRound) => currentRound + 1);
    }, 1200);

    return () => {
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  }, [currentPlayer.id, currentPlayer.role, feedback, goTo, maxRounds, playerName, round, score, setState]);

  useEffect(() => {
    return () => {
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  }, []);

  const submitAnswer = (value) => {
    if (!track) {
      return;
    }

    const normalizedUserAnswer = normalizeAnswer(value);
    if (!normalizedUserAnswer) {
      setFeedback({
        type: "error",
        text: "Введите ответ, прежде чем отправлять.",
        advance: false
      });
      return;
    }

    const validAnswers = [
      track.answer,
      track.title,
      selectedArtist?.name ? `${selectedArtist.name} ${track.title}` : ""
    ]
      .map(normalizeAnswer)
      .filter(Boolean);

    const isCorrect = validAnswers.some(
      (validAnswer) => normalizedUserAnswer.includes(validAnswer) || validAnswer.includes(normalizedUserAnswer)
    );

    const nextScore = isCorrect ? score + POINTS_PER_CORRECT : score;

    if (isCorrect) {
      setScore(nextScore);
    }

    setFeedback(
      isCorrect
        ? {
            type: "success",
            text: `Правильно! +${POINTS_PER_CORRECT} очков`,
            advance: true
          }
        : {
            type: "error",
            text: `Неверно. Правильный ответ: ${track.answer || track.title}`,
            advance: true
          }
    );
  };

  const skipRound = () => {
    if (!track) {
      return;
    }

    setFeedback({
      type: "error",
      text: `Раунд пропущен. Это был трек: ${track.answer || track.title}`,
      advance: true
    });
  };

  if (!playableTracks.length && !hasArtistCards) {
    return (
      <div className="game game--empty">
        <h1>Нечего угадывать</h1>
        <p>Сначала создай исполнителя или добавь хотя бы один трек и заполни правильный ответ.</p>
        <button type="button" className="game__secondary" onClick={() => goTo("upload")}>
          Перейти к загрузке
        </button>
      </div>
    );
  }

  if (!selectedArtist) {
    return (
      <section className="game game--artists">
        <div className="game__hero">
          <p className="game__eyebrow">Режим по исполнителю</p>
          <h1>Выбери артиста</h1>
          <p className="game__hint">
            После выбора будут играть только его песни. Так можно собирать отдельные каталоги под
            каждого исполнителя.
          </p>
        </div>

        <div className="game__artist-toolbar">
          <input
            type="text"
            value={artistQuery}
            placeholder="Поиск по имени исполнителя"
            onChange={(e) => setArtistQuery(e.target.value)}
          />
          <span>{filteredArtists.length} найдено</span>
        </div>

        {filteredArtists.length ? (
          <div className="game__artist-grid">
            {filteredArtists.map((artist) => (
              <button
                key={artist.id}
                type="button"
                className="game__artist-card"
                onClick={() => {
                  if (!artist.tracks.length) {
                    setNotification({
                      text: "У этого исполнителя пока нет песен. Добавь их в библиотеке.",
                      type: "error"
                    });
                    return;
                  }

                  startArtistSession(artist.id);
                }}
              >
                <img
                  src={getArtistImageSrc(artist.image)}
                  alt={artist.name}
                  className="game__artist-image"
                />

                <div className="game__artist-copy">
                  <strong>{artist.name}</strong>
                  <span>{artist.tracks.length} песен в библиотеке</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="game__empty-search">
            <h2>Ничего не найдено</h2>
            <p>Попробуй другое написание имени или сначала добавь песни этого исполнителя.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="game">
      <div className="game__topline">
        <span>Раунд {round} / {maxRounds}</span>
        <strong>{score} очков</strong>
      </div>

      {state.settings.showProgress && (
        <div className="game__status">
          <div className="game__status-grid">
            <div className="game__status-card">
              <span>Осталось времени</span>
              <strong>{timeLeft} сек</strong>
            </div>
            <div className="game__status-card">
              <span>Цена ответа</span>
              <strong>{POINTS_PER_CORRECT} pts</strong>
            </div>
          </div>

          <div className="game__timer" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      <div className="game__artist-pill">
        <img
          src={getArtistImageSrc(selectedArtist.image)}
          alt={selectedArtist.name}
          className="game__artist-pill-image"
        />
        <div>
          <p>Исполнитель</p>
          <strong>{selectedArtist.name}</strong>
        </div>
      </div>

      <h1>Угадай трек</h1>
      <p className="game__hint">
        Напиши название песни. Исполнителя можно добавить тоже, мы это нормально обработаем.
      </p>

      <div className="game__player">
        <div className="game__player-shell">
          <button
            type="button"
            onClick={() => {
              if (!audioRef.current) {
                return;
              }

              if (audioRef.current.paused) {
                audioRef.current.play();
                setIsPlaying(true);
              } else {
                audioRef.current.pause();
                setIsPlaying(false);
              }
            }}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>

          <div className="game__player-copy">
            <strong>{isPlaying ? "Сейчас играет фрагмент" : "Готов к прослушиванию"}</strong>
            <span>
              {state.settings.autoPlay
                ? "Автостарт включён, но ты всегда можешь поставить трек на паузу."
                : "Нажми play и угадай песню до конца таймера."}
            </span>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={track.audioUrl}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      </div>

      <form
        className="game__form"
        onSubmit={(e) => {
          e.preventDefault();
          submitAnswer(answer);
        }}
      >
        <input
          type="text"
          value={answer}
          placeholder="Введите ответ"
          onChange={(e) => setAnswer(e.target.value)}
        />

        <button type="submit" className="game__submit">
          Ответить
        </button>
      </form>

      {state.settings.allowSkip && (
        <button type="button" className="game__secondary game__skip" onClick={skipRound}>
          Пропустить раунд
        </button>
      )}

      <div className={`game__feedback ${feedback ? `is-${feedback.type}` : ""}`} aria-live="polite">
        {feedback ? feedback.text : " "}
      </div>

      <button
        type="button"
        className="game__secondary game__change-artist"
        onClick={() => {
          setSelectedArtistId(null);
          resetRoundState();
        }}
      >
        Выбрать другого исполнителя
      </button>
    </div>
  );
}
