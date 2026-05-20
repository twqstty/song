DROP TABLE IF EXISTS session_tracks;
DROP TABLE IF EXISTS game_sessions;
DROP TABLE IF EXISTS player_settings;
DROP TABLE IF EXISTS tracks;
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS players;

CREATE TABLE players (
  player_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_name VARCHAR(50) NOT NULL UNIQUE,
  role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  registered_at TIMESTAMP NOT NULL
);

CREATE TABLE player_settings (
  player_id INTEGER PRIMARY KEY,
  rounds_count INTEGER NOT NULL CHECK (rounds_count BETWEEN 1 AND 20),
  round_time_sec INTEGER NOT NULL CHECK (round_time_sec BETWEEN 5 AND 120),
  points_per_correct INTEGER NOT NULL CHECK (points_per_correct >= 100),
  answer_mode VARCHAR(10) NOT NULL CHECK (answer_mode IN ('flex', 'strict')),
  auto_play BOOLEAN NOT NULL,
  allow_skip BOOLEAN NOT NULL,
  show_progress BOOLEAN NOT NULL,
  CONSTRAINT fk_player_settings_player
    FOREIGN KEY (player_id) REFERENCES players (player_id) ON DELETE CASCADE
);

CREATE TABLE artists (
  artist_id UUID PRIMARY KEY,
  artist_name VARCHAR(100) NOT NULL UNIQUE,
  image_path TEXT
);

CREATE TABLE tracks (
  track_id UUID PRIMARY KEY,
  artist_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  correct_answer VARCHAR(200) NOT NULL,
  audio_url TEXT NOT NULL,
  CONSTRAINT fk_tracks_artist
    FOREIGN KEY (artist_id) REFERENCES artists (artist_id) ON DELETE RESTRICT
);

CREATE TABLE game_sessions (
  session_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id INTEGER NOT NULL,
  played_at TIMESTAMP NOT NULL,
  rounds_planned INTEGER NOT NULL CHECK (rounds_planned BETWEEN 1 AND 20),
  total_score INTEGER NOT NULL CHECK (total_score >= 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('finished', 'cancelled')),
  CONSTRAINT fk_game_sessions_player
    FOREIGN KEY (player_id) REFERENCES players (player_id) ON DELETE CASCADE
);

CREATE TABLE session_tracks (
  session_track_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id INTEGER NOT NULL,
  track_id UUID NOT NULL,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 20),
  is_correct BOOLEAN NOT NULL,
  awarded_points INTEGER NOT NULL CHECK (awarded_points >= 0),
  CONSTRAINT fk_session_tracks_session
    FOREIGN KEY (session_id) REFERENCES game_sessions (session_id) ON DELETE CASCADE,
  CONSTRAINT fk_session_tracks_track
    FOREIGN KEY (track_id) REFERENCES tracks (track_id) ON DELETE RESTRICT,
  CONSTRAINT uq_session_round UNIQUE (session_id, round_number),
  CONSTRAINT uq_session_track UNIQUE (session_id, track_id)
);

INSERT INTO players (player_name, role, registered_at) VALUES
  ('Игрок', 'user', '2026-05-01 18:00:00'),
  ('Босс', 'admin', '2026-05-02 19:10:00'),
  ('DJ Student', 'user', '2026-05-03 20:30:00');

INSERT INTO player_settings (
  player_id,
  rounds_count,
  round_time_sec,
  points_per_correct,
  answer_mode,
  auto_play,
  allow_skip,
  show_progress
) VALUES
  (1, 5, 15, 500, 'flex', TRUE, TRUE, TRUE),
  (2, 5, 15, 500, 'flex', TRUE, TRUE, TRUE),
  (3, 7, 20, 400, 'strict', TRUE, FALSE, TRUE);

INSERT INTO artists (artist_id, artist_name, image_path) VALUES
  ('d4a67379-9b3f-4dad-88b4-2c9461d1cd2b', 'Kai Angel', '/artists/kai-angel.jpg'),
  ('cc455c97-8ae5-4f5b-a9b5-80928bd3fbf1', '9mice', '/artists/mice.png'),
  ('5cbfba71-55f7-4759-98be-446b6c5fe4f2', 'Playboy Carti', '/artists/carti.jpg'),
  ('2a09d8ba-068e-43a5-9a2d-c07675534093', 'HERONWATER', '/artists/HERONWATER.jpg'),
  ('f1d6f121-58dc-496f-8daf-0f3253e22162', 'Lil Peep', '/artists/peep.png'),
  ('503a19db-45ab-498f-be04-6029fff8c874', 'Zxcursed', '/artists/zxcursed.jpg');

INSERT INTO tracks (track_id, artist_id, title, correct_answer, audio_url) VALUES
  ('8b702647-3630-4c63-bb3f-1ece0564b4c4', 'd4a67379-9b3f-4dad-88b4-2c9461d1cd2b', 'Limousine Music', 'Limousine Music', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/eb/92/35/eb9235ec-ac6d-dea5-8ebd-9bb9a194f545/mzaf_4931147103712094873.plus.aac.p.m4a'),
  ('10b48486-f687-47ea-8a31-fdfa1fa0232e', 'd4a67379-9b3f-4dad-88b4-2c9461d1cd2b', 'welcome to forever', 'welcome to forever', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/93/75/77/93757752-409e-1e9e-02da-af6f69515c54/mzaf_4440295897619256944.plus.aac.p.m4a'),
  ('3a1b32d0-98e3-48f5-96d4-4275ea59a428', 'd4a67379-9b3f-4dad-88b4-2c9461d1cd2b', '0 tears', '0 tears', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f3/b0/92/f3b09222-f376-cd26-7ca2-638ac81a3310/mzaf_1151974867091945083.plus.aac.p.m4a'),
  ('07da4ca9-2260-4f74-ac5f-1daca98ed601', 'cc455c97-8ae5-4f5b-a9b5-80928bd3fbf1', 'Москва - Владивосток', 'Москва - Владивосток', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5b/f5/0f/5bf50f44-21c8-af6d-75f6-c1baea32b99b/mzaf_8210116308552012983.plus.aac.p.m4a'),
  ('a2fb5ff0-d6c9-48e6-a326-7f3015d2d002', 'cc455c97-8ae5-4f5b-a9b5-80928bd3fbf1', 'sugar', 'sugar', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f3/90/b3/f390b3ee-283b-d8df-0a0f-6681af54a8b7/mzaf_17751664694102821656.plus.aac.p.m4a'),
  ('a8ce324c-94bc-4854-8db7-69ced90a9136', 'cc455c97-8ae5-4f5b-a9b5-80928bd3fbf1', 'NEW-YORK', 'NEW-YORK', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/e1/d2/8c/e1d28cd6-0a90-0af1-1495-a59076c88dd1/mzaf_17746868008521929000.plus.aac.p.m4a'),
  ('8a3ad698-24a4-4d7a-bded-9201b4f1c571', '5cbfba71-55f7-4759-98be-446b6c5fe4f2', 'Popular (feat. Playboi Carti) [Music from the HBO Original Series The Idol]', 'Popular (feat. Playboi Carti) [Music from the HBO Original Series The Idol]', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/39/8a/2e/398a2ec2-1b5e-1808-77f2-0a8976b1c448/mzaf_9444766139330891891.plus.aac.p.m4a'),
  ('e7a9ab6b-1dd9-45c1-baa1-425222ffa254', '5cbfba71-55f7-4759-98be-446b6c5fe4f2', 'ALL RED', 'ALL RED', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/cc/a8/8c/cca88cb7-897c-4949-8ab5-98fddeca6302/mzaf_11222618061394467610.plus.aac.p.m4a'),
  ('4c4d1830-cf82-4d01-b682-04960a293108', '5cbfba71-55f7-4759-98be-446b6c5fe4f2', 'Flex Up', 'Flex Up', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/64/52/0c/64520c00-87c8-98da-9531-d8a034afd0c5/mzaf_7672872643459606915.plus.aac.p.m4a'),
  ('ee470bd0-991f-405e-ac05-ee5efcf3c81c', '2a09d8ba-068e-43a5-9a2d-c07675534093', '2 часа ночи', '2 часа ночи', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8a/36/5b/8a365b7f-77ee-784d-dd46-59c41a9eb3cf/mzaf_11673995594113288981.plus.aac.p.m4a'),
  ('480d2a1c-c2f5-4b9c-8d2b-39f9fd7844c8', '2a09d8ba-068e-43a5-9a2d-c07675534093', 'Тайны', 'Тайны', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b1/65/a1/b165a18e-19b0-ee30-5924-2471570161f1/mzaf_11888469734754770082.plus.aac.p.m4a'),
  ('2183a208-226e-4ef9-bcf2-6cb7130643c3', '2a09d8ba-068e-43a5-9a2d-c07675534093', 'Сияешь 934-8777', 'Сияешь 934-8777', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/0d/46/07/0d460704-3c95-cdb1-0b4b-c20e45fce165/mzaf_1718962489772286516.plus.aac.p.m4a'),
  ('13972e9e-dcfc-483c-8f2e-a1b52b418c17', 'f1d6f121-58dc-496f-8daf-0f3253e22162', 'Awful Things (feat. Lil Tracy)', 'Awful Things (feat. Lil Tracy)', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/fc/0c/96/fc0c9634-01f7-71e4-736d-90a99c39e65b/mzaf_17947397239571893152.plus.aac.p.m4a'),
  ('ffba36eb-4532-4771-bd1c-73ca9d77b16e', 'f1d6f121-58dc-496f-8daf-0f3253e22162', 'Spotlight', 'Spotlight', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/5e/27/a4/5e27a4c6-bfa5-5c76-5d2a-418e806a3a47/mzaf_15579201775084642828.plus.aac.p.m4a'),
  ('9a3b27ba-bf82-4c8c-8d77-17dff3e79756', 'f1d6f121-58dc-496f-8daf-0f3253e22162', 'witchblades', 'witchblades', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/cc/4c/7c/cc4c7cf3-44c2-b5d4-5975-3b7c648e0f6f/mzaf_15394479141055236414.plus.aac.p.m4a'),
  ('6783d33c-78ab-4ae2-820b-d9327da37413', '503a19db-45ab-498f-be04-6029fff8c874', 'haunt', 'haunt', 'https://example.com/audio/haunt.m4a'),
  ('b5f848b4-1723-4397-8339-f419e61a2dda', '503a19db-45ab-498f-be04-6029fff8c874', 'waste', 'waste', 'https://example.com/audio/waste.m4a');

INSERT INTO game_sessions (player_id, played_at, rounds_planned, total_score, status) VALUES
  (1, '2026-05-10 18:45:00', 5, 2500, 'finished'),
  (1, '2026-05-11 19:00:00', 5, 2000, 'finished'),
  (2, '2026-05-12 20:15:00', 5, 500, 'finished'),
  (2, '2026-05-13 20:30:00', 5, 0, 'finished'),
  (3, '2026-05-14 21:00:00', 7, 1600, 'finished');

INSERT INTO session_tracks (
  session_id,
  track_id,
  round_number,
  is_correct,
  awarded_points
) VALUES
  (1, '8b702647-3630-4c63-bb3f-1ece0564b4c4', 1, TRUE, 500),
  (1, '07da4ca9-2260-4f74-ac5f-1daca98ed601', 2, TRUE, 500),
  (1, 'e7a9ab6b-1dd9-45c1-baa1-425222ffa254', 3, TRUE, 500),
  (1, '480d2a1c-c2f5-4b9c-8d2b-39f9fd7844c8', 4, TRUE, 500),
  (1, 'ffba36eb-4532-4771-bd1c-73ca9d77b16e', 5, TRUE, 500),
  (2, '10b48486-f687-47ea-8a31-fdfa1fa0232e', 1, TRUE, 500),
  (2, 'a2fb5ff0-d6c9-48e6-a326-7f3015d2d002', 2, TRUE, 500),
  (2, '4c4d1830-cf82-4d01-b682-04960a293108', 3, TRUE, 500),
  (2, '2183a208-226e-4ef9-bcf2-6cb7130643c3', 4, TRUE, 500),
  (2, '6783d33c-78ab-4ae2-820b-d9327da37413', 5, FALSE, 0),
  (3, '3a1b32d0-98e3-48f5-96d4-4275ea59a428', 1, FALSE, 0),
  (3, 'a8ce324c-94bc-4854-8db7-69ced90a9136', 2, TRUE, 500),
  (3, '13972e9e-dcfc-483c-8f2e-a1b52b418c17', 3, FALSE, 0),
  (4, '9a3b27ba-bf82-4c8c-8d77-17dff3e79756', 1, FALSE, 0),
  (5, '8a3ad698-24a4-4d7a-bded-9201b4f1c571', 1, TRUE, 400),
  (5, 'ee470bd0-991f-405e-ac05-ee5efcf3c81c', 2, TRUE, 400),
  (5, '13972e9e-dcfc-483c-8f2e-a1b52b418c17', 3, TRUE, 400),
  (5, 'b5f848b4-1723-4397-8339-f419e61a2dda', 4, TRUE, 400),
  (5, '07da4ca9-2260-4f74-ac5f-1daca98ed601', 5, FALSE, 0),
  (5, '3a1b32d0-98e3-48f5-96d4-4275ea59a428', 6, FALSE, 0);
