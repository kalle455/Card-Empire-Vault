import EventBanner from '../components/EventBanner.jsx'

export default function Events({ t, events }) {
  return (
    <main className="page-shell">
      <section className="section-header shell">
        <div>
          <span className="eyebrow">{t('events.title')}</span>
          <h1>{t('events.title')}</h1>
          <p>{t('events.description')}</p>
        </div>
      </section>

      <div className="event-list grid">
        {(events || []).map((event) => (
          <EventBanner key={event.id} event={event} t={t} />
        ))}
      </div>
    </main>
  )
}
