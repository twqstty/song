import "./Home.css";

export default function Home({ goTo, isAdmin }) {
  return (
    <div className="home">
      <h1>УГАДАЙ МЕЛОДИЮ</h1>

      <button className="home__primary" onClick={() => goTo("game")}>▶ Начать</button>
      {isAdmin ? (
        <button className="home__secondary" onClick={() => goTo("upload")}>+ Добавить</button>
      ) : (
        <p className="home__locked">Загрузка треков доступна только администратору.</p>
      )}
    </div>
  );
}
