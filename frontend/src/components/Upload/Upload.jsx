import { useMemo, useState } from "react";
import "./Upload.css";

const ARTIST_PLACEHOLDER = "/artists/placeholder.svg";

function normalizeArtistName(value) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function slugifyArtistName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseTrackName(fileName) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const parts = baseName.split(" - ");

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim()
    };
  }

  return {
    artist: "",
    title: baseName.trim()
  };
}

function getArtistImageSrc(image) {
  return image?.trim() || ARTIST_PLACEHOLDER;
}

function getCatalogArtworkSrc(item) {
  return item.artworkUrl?.trim() || ARTIST_PLACEHOLDER;
}

export default function Upload({ state, setState, goTo, setNotification }) {
  const [artistDraft, setArtistDraft] = useState({
    name: "",
    image: ""
  });
  const [trackDraft, setTrackDraft] = useState({
    title: "",
    answer: "",
    audioUrl: "",
    artistId: ""
  });
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogArtistId, setCatalogArtistId] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [uploadArtistId, setUploadArtistId] = useState("auto");

  const artistTrackCounts = useMemo(() => {
    const counts = new Map();

    state.tracks.forEach((track) => {
      if (!track.artistId) {
        return;
      }

      counts.set(track.artistId, (counts.get(track.artistId) || 0) + 1);
    });

    return counts;
  }, [state.tracks]);

  const readyTracks = state.tracks.filter((track) => track.title.trim() && track.answer.trim()).length;
  const orphanTracksCount = state.tracks.filter((track) => !track.artistId).length;
  const artistsWithCounts = state.artists.map((artist) => ({
    ...artist,
    tracksCount: artistTrackCounts.get(artist.id) || 0
  }));

  const addArtistCard = () => {
    const name = artistDraft.name.trim();

    if (!name) {
      setNotification({ text: "Укажи имя исполнителя", type: "error" });
      return;
    }

    const exists = state.artists.some(
      (artist) => normalizeArtistName(artist.name) === normalizeArtistName(name)
    );

    if (exists) {
      setNotification({ text: "Такой исполнитель уже есть", type: "error" });
      return;
    }

    setState((currentState) => ({
      ...currentState,
      artists: [
        ...currentState.artists,
        {
          id: crypto.randomUUID(),
          name,
          image: artistDraft.image.trim()
        }
      ]
    }));

    setArtistDraft({ name: "", image: "" });
    setNotification({ text: "Карточка исполнителя создана", type: "success" });
  };

  const addTrackByUrl = () => {
    const title = trackDraft.title.trim();
    const answer = trackDraft.answer.trim() || title;
    const audioUrl = trackDraft.audioUrl.trim();

    if (!title || !audioUrl) {
      setNotification({ text: "Для песни по ссылке нужны название и URL аудио", type: "error" });
      return;
    }

    setState((currentState) => ({
      ...currentState,
      tracks: [
        ...currentState.tracks,
        {
          id: crypto.randomUUID(),
          title,
          artistId: trackDraft.artistId || null,
          answer,
          audioUrl
        }
      ]
    }));

    setTrackDraft({
      title: "",
      answer: "",
      audioUrl: "",
      artistId: trackDraft.artistId
    });
    setNotification({ text: "Песня добавлена по ссылке", type: "success" });
  };

  const suggestArtistImagePath = (artistName, ext = "jpg") => {
    const slug = slugifyArtistName(artistName);

    return slug ? `/artists/${slug}.${ext}` : ARTIST_PLACEHOLDER;
  };

  const updateArtist = (artistId, patch) => {
    setState((currentState) => ({
      ...currentState,
      artists: currentState.artists.map((artist) =>
        artist.id === artistId ? { ...artist, ...patch } : artist
      )
    }));
  };

  const removeArtist = (artistId) => {
    setState((currentState) => ({
      ...currentState,
      artists: currentState.artists.filter((artist) => artist.id !== artistId),
      tracks: currentState.tracks.map((track) =>
        track.artistId === artistId ? { ...track, artistId: null } : track
      )
    }));

    if (uploadArtistId === artistId) {
      setUploadArtistId("auto");
    }

    setNotification({ text: "Карточка исполнителя удалена", type: "success" });
  };

  const searchCatalog = async () => {
    setCatalogLoading(true);

    try {
      const artistName = catalogArtistId ? getArtistName(catalogArtistId) : "";
      const params = new URLSearchParams();

      if (catalogQuery.trim()) {
        params.set("q", catalogQuery.trim());
      }

      if (artistName) {
        params.set("artist", artistName);
      }

      const response = await fetch(`/api/catalog/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Catalog search failed");
      }

      const data = await response.json();
      setCatalogResults(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Failed to search catalog", error);
      setCatalogResults([]);
      setNotification({ text: "Не удалось загрузить результаты каталога", type: "error" });
    } finally {
      setCatalogLoading(false);
    }
  };

  const addCatalogTrack = (item) => {
    const normalizedArtistName = normalizeArtistName(item.artistName);
    const existingArtist = catalogArtistId
      ? state.artists.find((artist) => artist.id === catalogArtistId) || null
      : state.artists.find(
          (artist) => normalizeArtistName(artist.name) === normalizedArtistName
        ) || null;

    const artistId = existingArtist?.id || crypto.randomUUID();

    const exists = state.tracks.some(
      (track) =>
        track.title === item.title &&
        track.audioUrl === item.audioUrl &&
        (track.artistId || "") === (artistId || "")
    );

    if (exists) {
      setNotification({ text: "Эта песня уже есть в библиотеке", type: "error" });
      return;
    }

    setState((currentState) => ({
      ...currentState,
      artists: existingArtist
        ? currentState.artists
        : [
            ...currentState.artists,
            {
              id: artistId,
              name: item.artistName,
              image: suggestArtistImagePath(item.artistName)
            }
          ],
      tracks: [
        ...currentState.tracks,
        {
          id: crypto.randomUUID(),
          title: item.title,
          artistId,
          answer: item.answer || item.title,
          audioUrl: item.audioUrl
        }
      ]
    }));

    setNotification({ text: "Песня добавлена из каталога", type: "success" });
  };

  const handleFiles = async (files) => {
    const valid = [...files].filter((file) => file.type.startsWith("audio/"));

    if (!valid.length) {
      setNotification({ text: "Добавь аудиофайлы, чтобы собрать раунд", type: "error" });
      return;
    }

    try {
      const loadedFiles = await Promise.all(
        valid.map(async (file) => ({
          file,
          audioUrl: await readFileAsDataUrl(file)
        }))
      );

      const artistsToCreate = [];
      const draftArtistsByName = new Map();

      const findArtistByName = (artistName) => {
        const normalizedName = normalizeArtistName(artistName);

        if (!normalizedName) {
          return null;
        }

        return (
          state.artists.find((artist) => normalizeArtistName(artist.name) === normalizedName) ||
          draftArtistsByName.get(normalizedName) ||
          null
        );
      };

      const newTracks = loadedFiles.map(({ file, audioUrl }) => {
        const parsed = parseTrackName(file.name);
        let artistId = null;

        if (uploadArtistId === "") {
          artistId = null;
        } else if (uploadArtistId !== "auto") {
          artistId = uploadArtistId;
        } else {
          const existingArtist = findArtistByName(parsed.artist);

          if (existingArtist) {
            artistId = existingArtist.id;
          } else if (parsed.artist.trim()) {
            const newArtist = {
              id: crypto.randomUUID(),
              name: parsed.artist.trim(),
              image: ""
            };

            artistsToCreate.push(newArtist);
            draftArtistsByName.set(normalizeArtistName(newArtist.name), newArtist);
            artistId = newArtist.id;
          }
        }

        return {
          id: crypto.randomUUID(),
          title: parsed.title || "Без названия",
          artistId,
          answer: parsed.title || "Без названия",
          audioUrl
        };
      });

      setState((currentState) => ({
        ...currentState,
        artists: [...currentState.artists, ...artistsToCreate],
        tracks: [...currentState.tracks, ...newTracks]
      }));

      setNotification({ text: "Треки добавлены", type: "success" });
    } catch {
      setNotification({ text: "Не удалось прочитать аудиофайлы", type: "error" });
    }
  };

  const updateTrack = (id, patch) => {
    setState((currentState) => ({
      ...currentState,
      tracks: currentState.tracks.map((track) =>
        track.id === id ? { ...track, ...patch } : track
      )
    }));
  };

  const removeTrack = (id) => {
    setState((currentState) => ({
      ...currentState,
      tracks: currentState.tracks.filter((track) => track.id !== id)
    }));

    setNotification({ text: "Трек удалён", type: "success" });
  };

  const getArtistName = (artistId) => {
    return state.artists.find((artist) => artist.id === artistId)?.name || "";
  };

  const getArtistImage = (artistId) => {
    return state.artists.find((artist) => artist.id === artistId)?.image || "";
  };

  return (
    <section className="upload">
      <div className="upload__hero">
        <p className="upload__eyebrow">Библиотека</p>
        <h1>Сначала исполнители, потом песни</h1>
        <p className="upload__lead">
          Создавай карточки артистов отдельно, даже если у них пока нет треков. Потом спокойно
          прикрепишь к ним песни, ссылки на аудио и фотографии.
        </p>
      </div>

      <div className="upload__artist-builder">
        <div className="upload__artist-form">
          <h2>Новый исполнитель</h2>

          <label>
            <span>Имя исполнителя</span>
            <input
              type="text"
              value={artistDraft.name}
              placeholder="Например, Kai Angel"
              onChange={(e) =>
                setArtistDraft((current) => ({
                  ...current,
                  name: e.target.value
                }))
              }
            />
          </label>

          <label>
            <span>Фото карточки</span>
            <input
              type="text"
              value={artistDraft.image}
              placeholder="/artists/kai-angel.jpg"
              onChange={(e) =>
                setArtistDraft((current) => ({
                  ...current,
                  image: e.target.value
                }))
              }
            />
          </label>

          <div className="upload__helper-row">
            <button
              type="button"
              className="upload__ghost"
              onClick={() =>
                setArtistDraft((current) => ({
                  ...current,
                  image: suggestArtistImagePath(current.name)
                }))
              }
            >
              Подставить путь по имени
            </button>
            <button
              type="button"
              className="upload__ghost"
              onClick={() =>
                setArtistDraft((current) => ({
                  ...current,
                  image: ARTIST_PLACEHOLDER
                }))
              }
            >
              Поставить плейсхолдер
            </button>
          </div>

          <button type="button" className="upload__primary" onClick={addArtistCard}>
            Создать карточку
          </button>
        </div>

        <div className="upload__summary">
          <div>
            <span>Исполнителей</span>
            <strong>{state.artists.length}</strong>
          </div>
          <div>
            <span>Всего треков</span>
            <strong>{state.tracks.length}</strong>
          </div>
          <div>
            <span>Без артиста</span>
            <strong>{orphanTracksCount}</strong>
          </div>
        </div>
      </div>

      {artistsWithCounts.length ? (
        <div className="upload__artist-grid">
          {artistsWithCounts.map((artist) => (
            <article key={artist.id} className="upload__artist-card">
              <img
                src={getArtistImageSrc(artist.image)}
                alt={artist.name}
                className="upload__artist-image"
              />

              <label>
                <span>Имя карточки</span>
                <input
                  type="text"
                  value={artist.name}
                  onChange={(e) => updateArtist(artist.id, { name: e.target.value })}
                />
              </label>

              <label>
                <span>Фото карточки</span>
                <input
                  type="text"
                  value={artist.image || ""}
                  onChange={(e) => updateArtist(artist.id, { image: e.target.value })}
                />
              </label>

              <div className="upload__helper-row">
                <button
                  type="button"
                  className="upload__ghost"
                  onClick={() =>
                    updateArtist(artist.id, {
                      image: suggestArtistImagePath(artist.name)
                    })
                  }
                >
                  Подставить путь по имени
                </button>
                <button
                  type="button"
                  className="upload__ghost"
                  onClick={() =>
                    updateArtist(artist.id, {
                      image: ARTIST_PLACEHOLDER
                    })
                  }
                >
                  Плейсхолдер
                </button>
              </div>

              <div className="upload__artist-meta">
                <span>{artist.tracksCount} песен</span>
                <button type="button" className="upload__remove" onClick={() => removeArtist(artist.id)}>
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="upload__empty">
          <h2>Пока нет карточек исполнителей</h2>
          <p>Создай первую карточку, а музыку можно будет добавить уже потом.</p>
        </div>
      )}

      <div className="upload__toolbar">
        <label className="upload__dropzone">
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span>Выбрать аудиофайлы</span>
          <small>Опционально: если у тебя уже есть локальные файлы, их тоже можно добавить.</small>
        </label>

        <div className="upload__assign">
          <label>
            <span>Кому добавить новые песни</span>
            <select value={uploadArtistId} onChange={(e) => setUploadArtistId(e.target.value)}>
              <option value="auto">Определять по имени файла</option>
              <option value="">Без исполнителя</option>
              {state.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>

          <p>Если выбрать карточку здесь, все новые песни сразу прикрепятся к ней.</p>
        </div>
      </div>

      <div className="upload__track-form">
        <h2>Найти песню в каталоге</h2>
        <p className="upload__track-form-note">
          Поиск идёт через backend во внешний каталог iTunes. Ты ищешь треки по артисту или названию
          и добавляешь их в библиотеку по клику.
        </p>

        <div className="upload__fields">
          <label>
            <span>Поиск</span>
            <input
              type="text"
              value={catalogQuery}
              placeholder="Например, Kai Angel или название трека"
              onChange={(e) => setCatalogQuery(e.target.value)}
            />
          </label>

          <label>
            <span>Фильтр по карточке</span>
            <select value={catalogArtistId} onChange={(e) => setCatalogArtistId(e.target.value)}>
              <option value="">Все исполнители</option>
              {state.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="upload__actions upload__actions--inline">
          <button type="button" onClick={searchCatalog}>
            {catalogLoading ? "Ищу..." : "Искать в каталоге"}
          </button>
        </div>

        {catalogResults.length ? (
          <div className="upload__catalog-list">
            {catalogResults.map((item) => (
              <article key={item.id} className="upload__catalog-card">
                <div className="upload__catalog-head">
                  <img
                    src={getCatalogArtworkSrc(item)}
                    alt={item.title}
                    className="upload__catalog-artwork"
                  />

                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.artistName}</p>
                    <span className="upload__catalog-source">
                      {item.source === "itunes" ? "iTunes preview" : "Внешний каталог"}
                    </span>
                  </div>
                </div>

                <audio controls src={item.audioUrl} className="upload__audio">
                  Ваш браузер не поддерживает воспроизведение аудио.
                </audio>

                <div className="upload__helper-row">
                  <button type="button" className="upload__primary" onClick={() => addCatalogTrack(item)}>
                    Добавить в библиотеку
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="upload__track-form">
        <h2>Добавить песню по ссылке</h2>
        <p className="upload__track-form-note">
          Это основной удобный путь для backend-сценария: храним метаданные и URL аудио, а не сам
          скачанный файл.
        </p>

        <div className="upload__fields">
          <label>
            <span>Название песни</span>
            <input
              type="text"
              value={trackDraft.title}
              placeholder="Например, Miami"
              onChange={(e) =>
                setTrackDraft((current) => ({
                  ...current,
                  title: e.target.value
                }))
              }
            />
          </label>

          <label>
            <span>Карточка исполнителя</span>
            <select
              value={trackDraft.artistId}
              onChange={(e) =>
                setTrackDraft((current) => ({
                  ...current,
                  artistId: e.target.value
                }))
              }
            >
              <option value="">Без исполнителя</option>
              {state.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="upload__answer">
          <span>Правильный ответ</span>
          <input
            type="text"
            value={trackDraft.answer}
            placeholder="Если пусто, возьмём название песни"
            onChange={(e) =>
              setTrackDraft((current) => ({
                ...current,
                answer: e.target.value
              }))
            }
          />
        </label>

        <label className="upload__answer">
          <span>Ссылка на аудио</span>
          <input
            type="text"
            value={trackDraft.audioUrl}
            placeholder="https://.../preview.mp3"
            onChange={(e) =>
              setTrackDraft((current) => ({
                ...current,
                audioUrl: e.target.value
              }))
            }
          />
          <small>Подходит для preview URL, CDN-ссылок и ваших backend-источников.</small>
        </label>

        <div className="upload__actions upload__actions--inline">
          <button type="button" onClick={addTrackByUrl}>
            Добавить по ссылке
          </button>
        </div>
      </div>

      {state.tracks.length ? (
        <div className="upload__list">
          {state.tracks.map((track, index) => (
            <article key={track.id} className="upload__card">
              <div className="upload__card-head">
                <div>
                  <span className="upload__index">Трек {index + 1}</span>
                  <h2>{track.title || "Без названия"}</h2>
                </div>

                <button type="button" className="upload__remove" onClick={() => removeTrack(track.id)}>
                  Удалить
                </button>
              </div>

              <audio controls src={track.audioUrl} className="upload__audio">
                Ваш браузер не поддерживает воспроизведение аудио.
              </audio>

              <div className="upload__fields">
                <label>
                  <span>Название песни</span>
                  <input
                    type="text"
                    value={track.title}
                    onChange={(e) => updateTrack(track.id, { title: e.target.value })}
                  />
                </label>

                <label>
                  <span>Карточка исполнителя</span>
                  <select
                    value={track.artistId || ""}
                    onChange={(e) => updateTrack(track.id, { artistId: e.target.value || null })}
                  >
                    <option value="">Без исполнителя</option>
                    {state.artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="upload__answer">
                <span>Исполнитель</span>
                <input type="text" value={getArtistName(track.artistId)} readOnly />
                <small>Исполнитель теперь задаётся через отдельную карточку.</small>
              </label>

              <label className="upload__answer">
                <span>Фото исполнителя</span>
                <input type="text" value={getArtistImage(track.artistId)} readOnly />
                <small>Фото подтягивается автоматически из карточки исполнителя.</small>
              </label>

              <label className="upload__answer">
                <span>Правильный ответ</span>
                <input
                  type="text"
                  value={track.answer}
                  onChange={(e) => updateTrack(track.id, { answer: e.target.value })}
                />
                <small>Именно это значение будет использоваться при проверке ответа.</small>
              </label>
            </article>
          ))}
        </div>
      ) : (
        <div className="upload__empty">
          <h2>Пока нет песен</h2>
          <p>Это нормально: теперь можно сначала собрать исполнителей, а треки подгрузить позже.</p>
        </div>
      )}

      <div className="upload__actions">
        <button
          type="button"
          onClick={() => {
            if (!readyTracks) {
              setNotification({ text: "Сначала добавь хотя бы один готовый трек", type: "error" });
              return;
            }

            goTo("game");
          }}
        >
          Играть
        </button>
      </div>
    </section>
  );
}
