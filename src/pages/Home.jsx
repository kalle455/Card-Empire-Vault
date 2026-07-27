import EventBanner from '../components/EventBanner.jsx'
import { roleLabels } from '../data/roleLabels.js'

export default function Home({ currentUser, t, cards = [], events = [] }) {
  return (
    <main className="page-shell">
      <section className="hero-panel shell">
        <div className="hero-copy">
          <span className="eyebrow">{t('home.preTitle', { name: currentUser.name })}</span>
          <h1>{t('home.title')}</h1>
          <p>{t('home.subtitle')}</p>
          <div className="hero-actions">
            <button type="button" className="primary-button">{t('buttons.discover')}</button>
            <button type="button" className="secondary-button">{t('buttons.vault')}</button>
          </div>
        </div>
        <div className="hero-panel-aside">
          <div className="hero-card-shell">
            <span>{t('home.preTitle', { name: currentUser.name })}</span>
            <strong>{roleLabels[currentUser.role] || currentUser.role}</strong>
            <p>{currentUser.role === 'POTM' ? t('profile.playerOfTheMonth') : t('profile.premiumMember')}</p>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{t('home.vipAccess')}</strong>
              <span>{currentUser.role === 'V.I.P' ? '25%' : t('home.memberAccess')}</span>
            </div>
            <div>
              <strong>{t('profile.rewards')}</strong>
              <span>{currentUser.rewards}</span>
            </div>
            <div>
              <strong>{t('profile.memberSince')}</strong>
              <span>{currentUser.joined}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="slider-shell shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('home.featuredDrops')}</span>
            <h2>{t('home.featuredDrops')}</h2>
          </div>
          <button type="button" className="ghost-button">{t('buttons.allCards')}</button>
        </div>
        <div className="card-slider">
          {cards.map((card) => (
            <article className="slider-card" key={card.id}>
              <div className="slider-card-image" aria-hidden="true">
                <div className="hero-shine" />
              </div>
              <div className="slider-card-body">
                <h3>{card.name}</h3>
                <strong>{card.price}€</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="featured-events shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('home.eventsTitle')}</span>
            <h2>{t('home.eventsTitle')}</h2>
          </div>
        </div>
        <div className="grid event-list">
          {(events || []).map((event) => (
            <EventBanner key={event.id} event={event} t={t} />
          ))}
        </div>
      </section>
    </main>
  )
}
