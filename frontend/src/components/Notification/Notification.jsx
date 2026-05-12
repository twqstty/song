import "./Notification.css";

export default function Notification({ data }) {
  if (!data) return null;

  return (
    <div className={`notification ${data.type}`}>
      {data.text}
    </div>
  );
}