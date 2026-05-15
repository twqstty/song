import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const stateFile = path.join(dataDir, "state.json");
const port = Number(process.env.PORT || 3001);

const defaultState = {
  artists: [],
  tracks: [],
  settings: {
    rounds: 5,
    time: 15,
    name: "Игрок"
  },
  leaderboard: [],
  game: {
    score: 0
  }
};

async function ensureStorage() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(stateFile, "utf8");
  } catch {
    await writeFile(stateFile, JSON.stringify(defaultState, null, 2));
  }
}

async function readState() {
  try {
    const raw = await readFile(stateFile, "utf8");
    const parsed = JSON.parse(raw);

    return {
      ...defaultState,
      ...parsed,
      artists: Array.isArray(parsed.artists) ? parsed.artists : defaultState.artists,
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks : defaultState.tracks,
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : defaultState.leaderboard,
      settings: {
        ...defaultState.settings,
        ...(parsed.settings || {})
      },
      game: {
        ...defaultState.game,
        ...(parsed.game || {})
      }
    };
  } catch {
    return defaultState;
  }
}

async function writeState(nextState) {
  await writeFile(stateFile, JSON.stringify(nextState, null, 2));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function buildSearchTerm(query, artistFilter) {
  return [artistFilter, query].filter(Boolean).join(" ").trim();
}

function toCatalogItem(item) {
  return {
    id: String(item.id),
    artistName: item.artistName,
    title: item.title,
    answer: item.answer,
    audioUrl: item.audioUrl,
    artworkUrl: item.artworkUrl,
    source: item.source,
    storeUrl: item.storeUrl
  };
}

function toCatalogArtist(item) {
  return {
    id: String(item.id),
    name: item.name,
    artworkUrl: item.artworkUrl,
    source: item.source,
    trackCount: item.trackCount ?? null
  };
}

async function searchItunesCatalog(query, artistFilter) {
  const searchTerm = buildSearchTerm(query, artistFilter);

  if (!searchTerm) {
    return [];
  }

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", searchTerm);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "30");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`iTunes search failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results
    .filter((item) => item.previewUrl && item.trackName && item.artistName)
    .map((item) =>
      toCatalogItem({
      id: String(item.trackId || item.collectionId || item.previewUrl),
      artistName: item.artistName,
      title: item.trackName,
      answer: item.trackCensoredName || item.trackName,
      audioUrl: item.previewUrl,
      artworkUrl: item.artworkUrl100 || item.artworkUrl60 || "",
      source: "itunes",
      storeUrl: item.trackViewUrl || item.collectionViewUrl || ""
      })
    );
}

async function searchItunesArtists(query) {
  if (!query) {
    return [];
  }

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "musicArtist");
  url.searchParams.set("attribute", "artistTerm");
  url.searchParams.set("limit", "15");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`iTunes artist search failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results
    .filter((item) => item.artistId && item.artistName)
    .map((item) =>
      toCatalogArtist({
        id: item.artistId,
        name: item.artistName,
        artworkUrl: "",
        source: "itunes",
        trackCount: null
      })
    );
}

async function searchDeezerCatalog(query, artistFilter) {
  const searchTerm = buildSearchTerm(query, artistFilter);

  if (!searchTerm) {
    return [];
  }

  const url = new URL("https://api.deezer.com/search/track");
  url.searchParams.set("q", searchTerm);
  url.searchParams.set("limit", "30");
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Deezer search failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.data) ? payload.data : [];

  return results
    .filter((item) => item.preview && item.title && item.artist?.name)
    .map((item) =>
      toCatalogItem({
        id: String(item.id || item.preview),
        artistName: item.artist.name,
        title: item.title_short || item.title,
        answer: item.title_short || item.title,
        audioUrl: item.preview,
        artworkUrl:
          item.album?.cover_medium || item.album?.cover || item.artist?.picture_medium || "",
        source: "deezer",
        storeUrl: item.link || item.album?.link || item.artist?.link || ""
      })
    );
}

async function searchDeezerArtists(query) {
  if (!query) {
    return [];
  }

  const url = new URL("https://api.deezer.com/search/artist");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "15");
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Deezer artist search failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.data) ? payload.data : [];

  return results
    .filter((item) => item.id && item.name)
    .map((item) =>
      toCatalogArtist({
        id: item.id,
        name: item.name,
        artworkUrl: item.picture_medium || item.picture || "",
        source: "deezer",
        trackCount: item.nb_fan ?? null
      })
    );
}

async function fetchItunesArtistTracks(artistId) {
  const url = new URL("https://itunes.apple.com/lookup");
  url.searchParams.set("id", artistId);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "200");
  url.searchParams.set("sort", "recent");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`iTunes artist tracks failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  const tracks = results
    .filter(
      (item) =>
        item.wrapperType === "track" && item.previewUrl && item.trackName && item.artistName
    )
    .map((item) =>
      toCatalogItem({
        id: String(item.trackId || item.collectionId || item.previewUrl),
        artistName: item.artistName,
        title: item.trackName,
        answer: item.trackCensoredName || item.trackName,
        audioUrl: item.previewUrl,
        artworkUrl: item.artworkUrl100 || item.artworkUrl60 || "",
        source: "itunes",
        storeUrl: item.trackViewUrl || item.collectionViewUrl || ""
      })
    );

  return {
    items: tracks,
    nextOffset: null,
    hasMore: false
  };
}

async function fetchDeezerArtistTracks(artistName, offset = 0, limit = 30) {
  const url = new URL("https://api.deezer.com/search/track");
  url.searchParams.set("q", `artist:"${artistName}"`);
  url.searchParams.set("index", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Deezer artist tracks failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.data) ? payload.data : [];
  const tracks = results
    .filter((item) => item.preview && item.title && item.artist?.name)
    .map((item) =>
      toCatalogItem({
        id: String(item.id || item.preview),
        artistName: item.artist.name,
        title: item.title_short || item.title,
        answer: item.title_short || item.title,
        audioUrl: item.preview,
        artworkUrl:
          item.album?.cover_medium || item.album?.cover || item.artist?.picture_medium || "",
        source: "deezer",
        storeUrl: item.link || item.album?.link || item.artist?.link || ""
      })
    );
  const total = Number(payload.total || 0);
  const nextOffset = offset + tracks.length;

  return {
    items: tracks,
    nextOffset: nextOffset < total ? nextOffset : null,
    hasMore: nextOffset < total
  };
}

async function searchCatalog(query, artistFilter, source) {
  const providers = {
    itunes: searchItunesCatalog,
    deezer: searchDeezerCatalog
  };

  if (source && source !== "all") {
    const provider = providers[source];

    if (!provider) {
      throw new Error(`Unknown catalog source: ${source}`);
    }

    return provider(query, artistFilter);
  }

  const settled = await Promise.allSettled(
    Object.values(providers).map((provider) => provider(query, artistFilter))
  );
  const items = settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  if (!items.length && settled.every((result) => result.status === "rejected")) {
    throw new Error("All catalog providers failed");
  }

  return items;
}

async function searchCatalogArtists(query, source) {
  const providers = {
    itunes: searchItunesArtists,
    deezer: searchDeezerArtists
  };

  if (source && source !== "all") {
    const provider = providers[source];

    if (!provider) {
      throw new Error(`Unknown catalog source: ${source}`);
    }

    return provider(query);
  }

  const settled = await Promise.allSettled(Object.values(providers).map((provider) => provider(query)));
  const items = settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  if (!items.length && settled.every((result) => result.status === "rejected")) {
    throw new Error("All catalog artist providers failed");
  }

  return items;
}

async function fetchArtistTracks({ source, artistId, artistName, offset, limit }) {
  if (source === "itunes") {
    return fetchItunesArtistTracks(artistId);
  }

  if (source === "deezer") {
    return fetchDeezerArtistTracks(artistName, offset, limit);
  }

  throw new Error(`Unknown catalog source: ${source}`);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      resolve(body);
    });

    req.on("error", reject);
  });
}

await ensureStorage();

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.url === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.url === "/api/state" && req.method === "GET") {
    const state = await readState();
    sendJson(res, 200, state);
    return;
  }

  if (req.url === "/api/state" && req.method === "PUT") {
    try {
      const body = await readRequestBody(req);
      const nextState = JSON.parse(body || "{}");

      const normalizedState = {
        ...defaultState,
        ...nextState,
        artists: Array.isArray(nextState.artists) ? nextState.artists : defaultState.artists,
        tracks: Array.isArray(nextState.tracks) ? nextState.tracks : defaultState.tracks,
        leaderboard: Array.isArray(nextState.leaderboard) ? nextState.leaderboard : defaultState.leaderboard,
        settings: {
          ...defaultState.settings,
          ...(nextState.settings || {})
        },
        game: {
          ...defaultState.game,
          ...(nextState.game || {})
        }
      };

      await writeState(normalizedState);
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
    }

    return;
  }

  if (req.url.startsWith("/api/catalog/search") && req.method === "GET") {
    const url = new URL(req.url, `http://localhost:${port}`);
    const query = normalizeText(url.searchParams.get("q"));
    const artistFilter = normalizeText(url.searchParams.get("artist"));
    const source = normalizeText(url.searchParams.get("source")) || "all";

    try {
      const results = await searchCatalog(query, artistFilter, source);
      sendJson(res, 200, { items: results });
    } catch (error) {
      console.error("Catalog search error:", error);
      sendJson(res, 502, { error: "Failed to fetch external catalog" });
    }

    return;
  }

  if (req.url.startsWith("/api/catalog/artists") && req.method === "GET") {
    const url = new URL(req.url, `http://localhost:${port}`);
    const query = normalizeText(url.searchParams.get("q"));
    const source = normalizeText(url.searchParams.get("source")) || "all";

    try {
      const results = await searchCatalogArtists(query, source);
      sendJson(res, 200, { items: results });
    } catch (error) {
      console.error("Catalog artist search error:", error);
      sendJson(res, 502, { error: "Failed to fetch catalog artists" });
    }

    return;
  }

  if (req.url.startsWith("/api/catalog/artist-tracks") && req.method === "GET") {
    const url = new URL(req.url, `http://localhost:${port}`);
    const source = normalizeText(url.searchParams.get("source"));
    const artistId = normalizeText(url.searchParams.get("artistId"));
    const artistName = String(url.searchParams.get("artistName") || "").trim();
    const offset = Number(url.searchParams.get("offset") || "0");
    const limit = Number(url.searchParams.get("limit") || "30");

    try {
      const results = await fetchArtistTracks({
        source,
        artistId,
        artistName,
        offset: Number.isFinite(offset) ? offset : 0,
        limit: Number.isFinite(limit) ? limit : 30
      });
      sendJson(res, 200, results);
    } catch (error) {
      console.error("Catalog artist tracks error:", error);
      sendJson(res, 502, { error: "Failed to fetch artist tracks" });
    }

    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`SoundQuiz backend listening on http://localhost:${port}`);
});
