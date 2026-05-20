.headers on
.mode box

.print '1. SELECT with WHERE'
SELECT track_id, title
FROM tracks
WHERE artist_id = 'd4a67379-9b3f-4dad-88b4-2c9461d1cd2b';

.print '2. INSERT'
INSERT INTO players (player_name, role, registered_at)
SELECT 'Тестовый игрок', 'user', '2026-05-19 10:00:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM players
  WHERE player_name = 'Тестовый игрок'
);

SELECT player_id, player_name, role
FROM players
WHERE player_name = 'Тестовый игрок';

.print '3. UPDATE'
UPDATE player_settings
SET points_per_correct = 600,
    answer_mode = 'strict'
WHERE player_id = 2;

SELECT player_id, points_per_correct, answer_mode
FROM player_settings
WHERE player_id = 2;

.print '4. DELETE'
DELETE FROM session_tracks
WHERE session_id = 4
  AND round_number = 1;

SELECT COUNT(*) AS remaining_rows
FROM session_tracks
WHERE session_id = 4;

.print '5. SELECT with JOIN'
SELECT
  gs.session_id,
  p.player_name,
  p.role,
  gs.played_at,
  gs.total_score,
  COUNT(st.session_track_id) AS answered_tracks
FROM game_sessions AS gs
JOIN players AS p
  ON p.player_id = gs.player_id
LEFT JOIN session_tracks AS st
  ON st.session_id = gs.session_id
GROUP BY gs.session_id, p.player_name, p.role, gs.played_at, gs.total_score
ORDER BY gs.total_score DESC;
