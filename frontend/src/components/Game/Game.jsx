import { useEffect, useMemo, useRef, useState } from "react";
import "./Game.css";

const ARTIST_PLACEHOLDER = "/artists/placeholder.svg";

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
  const [answer, setAnswer] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState(null);
  const audioRef = useRef(null);
  const hasArtistCards = state.artists.length > 0;

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

  useEffect(() => {
    if (selectedArtistId && !artists.some((artist) => artist.id === selectedArtistId)) {
      setSelectedArtistId(null);
    }
  }, [artists, selectedArtistId]);

  useEffect(() => {
    setAnswer("");

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [round]);

  useEffect(() => {
    setRound(1);
    setScore(0);
    setAnswer("");

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [selectedArtistId]);

  const finishGame = (finalScore) => {
    setState((currentState) => ({
      ...currentState,
      game: {
        score: finalScore
      },
      leaderboard: [...currentState.leaderboard, {
        name: currentState.settings.name,
        score: finalScore
      }].sort((a, b) => b.score - a.score)
    }));

    goTo("result");
  };

  const submitAnswer = (answer) => {
    if (!track) {
      return;
    }

    const normalizedUserAnswer = normalizeAnswer(answer);
    if (!normalizedUserAnswer) {
      setNotification({ text: "Введите ответ, прежде чем отправлять", type: "error" });
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
      (validAnswer) =>
        normalizedUserAnswer.includes(validAnswer) || validAnswer.includes(normalizedUserAnswer)
    );

    const nextScore = isCorrect ? score + 500 : score;

    if (isCorrect) {
      setNotification({ text: "Правильно!", type: "success" });
    } else {
      setNotification({ text: "Неверно", type: "error" });
    }

    setScore(nextScore);

    if (round >= maxRounds) {
      finishGame(nextScore);
    } else {
      setRound(round + 1);
    }
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

                  setSelectedArtistId(artist.id);
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
        <button
          type="button"
          onClick={() => {
            if (!audioRef.current) {
              return;
            }

            if (audioRef.current.paused) {
              audioRef.current.play();
            } else {
              audioRef.current.pause();
            }
          }}
        >
          ▶
        </button>

        <audio ref={audioRef} src={track.audioUrl} preload="metadata" />
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

      <button type="button" className="game__secondary game__change-artist" onClick={() => setSelectedArtistId(null)}>
        Выбрать другого исполнителя
      </button>
    </div>
  );
}
