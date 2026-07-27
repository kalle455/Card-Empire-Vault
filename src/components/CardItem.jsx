export default function CardItem({ card, userRole, t, onSelect, onMessage }) {
  const discount = userRole === 'V.I.P' ? 0.25 : 0
  const originalPrice = card.price.toFixed(0)
  const vipPrice = (card.price * (1 - discount)).toFixed(0)
  const isSold = card.status === 'sold'

  return (
    <article className="card-item card-common card-gold">
      <div className="card-hero">
        <img src={card.image} alt={card.name} />
        <span className="card-tag">Premium</span>
        <span className={`status-badge ${card.status}`}>{t(`cards.${card.status}`)}</span>
      </div>
      <div className="card-body">
        <div className="card-preview-title">
          <h3>{card.name}</h3>
          <span>{card.rarity || 'Legendary'}</span>
        </div>
        <p>{card.description || 'Rare collectible premium trading card with custom art and VIP price insights.'}</p>
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
          <button type="button" className="btn-gold" disabled={isSold} onClick={() => onMessage && onMessage(card)}>
            {t('cards.contactSeller') || 'Message'}
          </button>
        </div>
      </div>
    </article>
  )
}
