export default function CardDetail({ card, userRole, onEdit, onDelete, t }) {
  if (!card) {
    return (
      <section className="card-detail empty shell">
        <p>{t('cards.noCardSelected')}</p>
      </section>
    )
  }

  const isAdmin = userRole === 'ADMIN'

  return (
    <section className="card-detail shell card-common card-gold">
      <div className="detail-hero">
        <img src={card.image} alt={card.name} />
      </div>
      <div className="detail-body">
        <span className="eyebrow">{t('cards.detailTitle')}</span>
        <h2>{card.name}</h2>
        <p>{card.description || 'A premium collectible with market-ready presentation and rich metadata.'}</p>
        <div className="card-details-grid">
          <div>
            <strong>{t('cards.priceLabel')}</strong>
            <span>{card.price}€</span>
          </div>
          <div>
            <strong>{t('cards.statusLabel')}</strong>
            <span>{t(`cards.${card.status}`)}</span>
          </div>
          <div>
            <strong>Rarity</strong>
            <span>{card.rarity || 'Legendary'}</span>
          </div>
        </div>
        {isAdmin ? (
          <div className="detail-actions">
            <button type="button" className="secondary-button" onClick={onEdit}>
              {t('cards.editCard')}
            </button>
            <button type="button" className="ghost-button" onClick={onDelete}>
              {t('cards.deleteCard')}
            </button>
          </div>
        ) : (
          <div className="detail-actions">
            <button type="button" className="btn-gold" onClick={() => window.dispatchEvent(new CustomEvent('openChat', { detail: { card } }))}>
              {t('cards.contactSeller') || 'Nachricht senden'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
