import "./Result.css";

export default function Results({ state, goTo }) {
  return (
    <div className="results">
      <p>Игрок</p>
      <h2>{state.settings.name}</h2>
      <h1>{state.game?.score || 0}</h1>
      <button onClick={() => goTo("game")}>Снова</button>
    </div>
  );
}
