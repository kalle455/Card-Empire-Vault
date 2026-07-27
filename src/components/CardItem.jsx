export default function CardItem({ card, userRole, t, onSelect, onMessage }) {
  const discount = userRole === 'V.I.P' ? 0.25 : 0
  const originalPrice = card.price.toFixed(0)
  const vipPrice = (card.price * (1 - discount)).toFixed(0)
  const isSold = card.status === 'sold'

  return (
    <article className="card-item">
      <div className="card-hero">
        <img src={card.image} alt={card.name} />
        <span className={`status-badge ${card.status}`}>{t(`cards.${card.status}`)}</span>
      </div>
      <div className="card-body">
        <h3>{card.name}</h3>
        <div className="card-meta">
          <div className="price-block">
            {discount > 0 ? (
              <>
                <span className="price-original">{originalPrice}€</span>
                <strong className="price-final">{vipPrice}€</strong>
              </>
            ) : (
              <strong className="price-final">{originalPrice}€</strong>
            )}
          </div>
          {discount > 0 && <span className="badge">{t('buttons.vipPrice')}</span>}
        </div>
        <div className="card-item-actions">
          <button type="button" className="ghost-button" onClick={() => onSelect(card.id)}>
            {t('cards.viewDetails')}
          </button>
          <button type="button" className="primary-button" disabled={isSold} onClick={() => onMessage && onMessage(card)}>
            {t('cards.contactSeller') || 'Nachricht'}
          </button>
        </div>
      </div>
    </article>
  )
}
