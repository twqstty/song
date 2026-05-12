import "./Home.css";

export default function Home({ goTo }) {
  return (
    <div className="home">
      <h1>УГАДАЙ МЕЛОДИЮ</h1>

      <button onClick={() => goTo("game")}>▶ Начать</button>
      <button onClick={() => goTo("upload")}>+ Добавить</button>
    </div>
  );
}