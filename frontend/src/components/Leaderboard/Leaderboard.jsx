import "./Leaderboard.css";

export default function Leaderboard({ state }) {
  return (
    <div>
      {state.leaderboard.map((p, i) => (
        <div key={i}>
          {i + 1}. {p.name} — {p.score}
        </div>
      ))}
    </div>
  );
}