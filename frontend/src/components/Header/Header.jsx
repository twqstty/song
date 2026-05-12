import "./Header.css";

export default function Header({ goTo, current }) {
  const tabs = ["home", "upload", "game", "leaderboard", "settings"];

  return (
    <nav>
      <div className="logo">🎵 <span>SOUND</span>QUIZ</div>

      <ul className="nav-tabs">
        {tabs.map(tab => (
          <li key={tab}>
            <button
              className={current === tab ? "active" : ""}
              onClick={() => goTo(tab)}
            >
              {tab}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}