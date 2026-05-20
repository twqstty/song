import "./Settings.css";

const roundOptions = [3, 5, 7, 10];
const roundTimeSeconds = 10;
const pointsPerCorrect = 300;
const presets = [
  {
    id: "blitz",
    title: "Blitz",
    description: "",
    patch: {
      rounds: 3,
      autoPlay: true,
      allowSkip: false,
      showProgress: true
    }
  },
  {
    id: "classic",
    title: "Classic",
    description: "",
    patch: {
      rounds: 5,
      autoPlay: true,
      allowSkip: true,
      showProgress: true
    }
  },
  {
    id: "deep-cut",
    title: "Deep Cut",
    description: "",
    patch: {
      rounds: 10,
      autoPlay: false,
      allowSkip: true,
      showProgress: true
    }
  }
];

export default function Settings({ state, setState }) {
  const settings = state.settings;

  const updateSettings = (patch) => {
    setState({
      ...state,
      settings: {
        ...settings,
        ...patch
      }
    });
  };

  const updatePlayerName = (name) => {
    const normalizedName = name.slice(0, 20);
    const currentPlayer = state.currentPlayer
      ? {
          ...state.currentPlayer,
          name: normalizedName
        }
      : null;

    setState({
      ...state,
      currentPlayer,
      players: currentPlayer
        ? state.players.map((player) =>
            player.id === currentPlayer.id ? currentPlayer : player
          )
        : state.players
    });
  };

  const resetSettings = () => {
    updateSettings({
      rounds: 5,
      autoPlay: true,
      allowSkip: true,
      showProgress: true
    });
  };

  const activePreset = presets.find((preset) =>
    Object.entries(preset.patch).every(([key, value]) => settings[key] === value)
  );
  const totalPotentialScore = settings.rounds * pointsPerCorrect;

  return (
    <section className="settings">
      <div className="settings__hero">
        <p className="settings__eyebrow">Control Room</p>
        <h1>Полное меню настройки матча</h1>
        <p className="settings__lead">
          Настрой формат игры под себя
        </p>
      </div>

      <div className="settings__layout">
        <div className="settings__panel">
          <div className="settings__section">
            <div className="settings__section-header">
              <div>
                <h2>Готовые пресеты</h2>
                <p>Быстрый старт для разных сценариев игры.</p>
              </div>
              <strong>{activePreset ? activePreset.title : "Custom"}</strong>
            </div>

            <div className="settings__preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`settings__preset-card ${activePreset?.id === preset.id ? "is-active" : ""}`}
                  onClick={() => updateSettings(preset.patch)}
                >
                  <span>{preset.title}</span>
                  <strong>{preset.patch.rounds} раундов</strong>
                  <p>{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="settings__section">
            <div className="settings__section-header">
              <div>
                <h2>Профиль игрока</h2>
                <p>Имя попадёт в результаты и в таблицу лидеров.</p>
              </div>
            </div>

            <label className="settings__field">
              <span>Имя</span>
              <input
                type="text"
                maxLength={20}
                value={state.currentPlayer?.name || ""}
                placeholder="Введите имя"
                onChange={(e) => updatePlayerName(e.target.value)}
              />
            </label>
          </div>

          <div className="settings__section">
            <div className="settings__section-header">
              <div>
                <h2>Формат матча</h2>
                <p>Длина сессии. Таймер всегда 10 секунд, правильный ответ всегда даёт 300 очков.</p>
              </div>
              <strong>{totalPotentialScore}</strong>
            </div>

            <div className="settings__split">
              <div>
                <p className="settings__mini-label">Раунды</p>
                <div className="settings__chips">
                  {roundOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={settings.rounds === option ? "is-active" : ""}
                      onClick={() => updateSettings({ rounds: option })}
                    >
                      {option} раундов
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="settings__mini-label">Фиксированные правила</p>
                <div className="settings__chips">
                  <button type="button" className="is-active">
                    {roundTimeSeconds} сек
                  </button>
                  <button type="button" className="is-active">
                    {pointsPerCorrect} pts
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="settings__section">
            <div className="settings__section-header">
              <div>
                <h2>Поведение раунда</h2>
                <p>Переключатели, которые влияют на темп самой игры.</p>
              </div>
            </div>

            <div className="settings__toggle-list">
              {[
                {
                  key: "autoPlay",
                  title: "Автостарт превью",
                  description: "Новый фрагмент запускается сам при старте раунда."
                },
                {
                  key: "allowSkip",
                  title: "Разрешить пропуск",
                  description: "Показывает кнопку skip, если трек не узнаётся."
                },
                {
                  key: "showProgress",
                  title: "Показывать прогресс",
                  description: "На экране игры будут таймер и статус текущего режима."
                }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`settings__toggle ${settings[item.key] ? "is-active" : ""}`}
                  onClick={() => updateSettings({ [item.key]: !settings[item.key] })}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <span className="settings__switch" aria-hidden="true">
                    <span />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="settings__summary">
          <p className="settings__summary-label">Live Summary</p>
          <h2>{state.currentPlayer?.name || "Игрок"}</h2>

          <div className="settings__summary-grid">
            <div>
              <span>Формат</span>
              <strong>{settings.rounds}x{roundTimeSeconds}</strong>
            </div>
            <div>
              <span>Награда</span>
              <strong>{pointsPerCorrect}</strong>
            </div>
            <div>
              <span>Пропуск</span>
              <strong>{settings.allowSkip ? "On" : "Off"}</strong>
            </div>
          </div>

          <div className="settings__mode">
            <span className="settings__mode-badge">{activePreset ? activePreset.title : "Custom"}</span>
            <p>
              Время и очки теперь фиксированные: 10 секунд на раунд и 300 очков за правильный ответ.
            </p>
          </div>

          <div className="settings__insights">
            <div>
              <span>Макс. счёт</span>
              <strong>{totalPotentialScore}</strong>
            </div>
            <div>
              <span>Темп</span>
              <strong>Быстрый</strong>
            </div>
          </div>

          <button type="button" className="settings__reset" onClick={resetSettings}>
            Сбросить к стандартным
          </button>
        </aside>
      </div>
    </section>
  );
}
