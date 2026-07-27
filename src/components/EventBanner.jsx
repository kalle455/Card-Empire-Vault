export default function EventBanner({ event, t }) {
  return (
    <article className="event-banner">
      <div className="event-meta">
        <strong>{event.date}</strong>
        <span className="pill">{event.location}</span>
      </div>
      <div className="event-content">
        <h3>{event.name}</h3>
        <p>{t('events.participants')}: {event.participants}</p>
        {event.winner && <p>{t('events.winner')}: {event.winner}</p>}
        <p>{t('events.prize')}: {event.prize}€</p>
      </div>
      <button type="button" className="ghost-button">{t('events.moreInfo')}</button>
    </article>
  )
}
