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
    .map((item) => ({
      id: String(item.trackId || item.collectionId || item.previewUrl),
      artistName: item.artistName,
      title: item.trackName,
      answer: item.trackCensoredName || item.trackName,
      audioUrl: item.previewUrl,
      artworkUrl: item.artworkUrl100 || item.artworkUrl60 || "",
      source: "itunes",
      storeUrl: item.trackViewUrl || item.collectionViewUrl || ""
    }));
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

    try {
      const results = await searchItunesCatalog(query, artistFilter);
      sendJson(res, 200, { items: results });
    } catch (error) {
      console.error("Catalog search error:", error);
      sendJson(res, 502, { error: "Failed to fetch external catalog" });
    }

    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`SoundQuiz backend listening on http://localhost:${port}`);
});
