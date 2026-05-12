import "./Settings.css";

const roundOptions = [3, 5, 7, 10];
const timeOptions = [10, 15, 20, 30];

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

  const resetSettings = () => {
    updateSettings({
      rounds: 5,
      time: 15,
      name: "Игрок"
    });
  };

  return (
    <section className="settings">
      <div className="settings__hero">
        <p className="settings__eyebrow">Настройки игры</p>
        <h1>Собери свой режим</h1>
        <p className="settings__lead">
          Выбери темп игры, количество раундов и имя, которое увидят в таблице лидеров.
        </p>
      </div>

      <div className="settings__layout">
        <div className="settings__panel">
          <div className="settings__section">
            <div className="settings__section-header">
              <div>
                <h2>Профиль игрока</h2>
                <p>Имя сохранится в результатах и лидерборде.</p>
              </div>
            </div>

            <label className="settings__field">
              <span>Имя</span>
              <input
                type="text"
                maxLength={20}
                value={settings.name}
                placeholder="Введите имя"
                onChange={(e) =>
                  updateSettings({
                    name: e.target.value.slice(0, 20)
                  })
                }
              />
            </label>
          </div>

          <div className="settings__section">
            <div className="settings__section-header">
              <div>
                <h2>Раунды</h2>
                <p>Короткая партия или полноценный забег.</p>
              </div>
              <strong>{settings.rounds}</strong>
            </div>

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

          <div className="settings__section">
            <div className="settings__section-header">
              <div>
                <h2>Время на ответ</h2>
                <p>Сколько секунд даём на угадывание трека.</p>
              </div>
              <strong>{settings.time} сек</strong>
            </div>

            <input
              className="settings__range"
              type="range"
              min={10}
              max={30}
              step={5}
              value={settings.time}
              onChange={(e) =>
                updateSettings({
                  time: Number(e.target.value)
                })
              }
            />

            <div className="settings__ticks">
              {timeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={settings.time === option ? "is-active" : ""}
                  onClick={() => updateSettings({ time: option })}
                >
                  {option}s
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="settings__summary">
          <p className="settings__summary-label">Превью</p>
          <h2>{settings.name}</h2>

          <div className="settings__summary-grid">
            <div>
              <span>Раундов</span>
              <strong>{settings.rounds}</strong>
            </div>
            <div>
              <span>На ответ</span>
              <strong>{settings.time} сек</strong>
            </div>
          </div>

          <div className="settings__mode">
            <span className="settings__mode-badge">
              {settings.time <= 10 ? "Hardcore" : settings.time <= 20 ? "Classic" : "Chill"}
            </span>
            <p>
              {settings.time <= 10
                ? "Быстрый режим для тех, кто узнаёт трек с первой секунды."
                : settings.time <= 20
                  ? "Сбалансированный режим для обычной игры с друзьями."
                  : "Спокойный режим, когда хочется больше времени на обсуждение."}
            </p>
          </div>

          <button type="button" className="settings__reset" onClick={resetSettings}>
            Сбросить к стандартным
          </button>
        </aside>
      </div>
    </section>
  );
}
