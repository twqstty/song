import "./Header.css";

export default function Header({ goTo, current, currentPlayer, onLogout }) {
  const isAdmin = currentPlayer?.role === "admin";
  const tabs = ["home", ...(isAdmin ? ["upload"] : []), "game", "leaderboard", "settings"];

  return (
    <nav>
      <div className="logo">
        🎵 <span>SOUND</span>QUIZ
        <small>{currentPlayer?.role || "user"}</small>
      </div>

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

      <button type="button" className="nav-logout" onClick={onLogout}>
        Выйти
      </button>
    </nav>
  );
}
