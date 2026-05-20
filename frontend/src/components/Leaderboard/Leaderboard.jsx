import "./Leaderboard.css";

export default function Leaderboard({ state }) {
  return (
    <div className="leaderboard">
      <h1>Leaderboard</h1>

      {state.leaderboard.length ? (
        state.leaderboard.map((p, i) => (
          <div key={`${p.name}-${p.score}-${i}`} className="leaderboard__row">
            <span>{i + 1}. {p.name}</span>
            <strong>{p.score}</strong>
          </div>
        ))
      ) : (
        <p className="leaderboard__empty">Пока нет участников. Первый результат будет записан после игры.</p>
      )}
    </div>
  );
}
