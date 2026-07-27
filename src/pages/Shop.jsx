import { useEffect, useMemo, useState } from 'react'
import CardItem from '../components/CardItem.jsx'
import CardDetail from '../components/CardDetail.jsx'
import CardEditor from '../components/CardEditor.jsx'
import { roleLabels } from '../data/roleLabels.js'

export default function Shop({ currentUser, t, cards, setCards }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id || null)
  const [editorCard, setEditorCard] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return cards
    return cards.filter((card) => {
      return card.name.toLowerCase().includes(query)
    })
  }, [cards, searchQuery])

  const selectedCard = cards.find((card) => card.id === selectedCardId)
  const isAdmin = currentUser.role === 'ADMIN'

  const handleSearch = (event) => {
    setSearchQuery(event.target.value)
  }

  const handleSelect = (id) => setSelectedCardId(id)

  const handleOpenEditor = (card = null) => {
    setEditorCard(card)
    setEditorOpen(true)
  }

  const handleDelete = (cardId) => {
    const nextCards = cards.filter((card) => card.id !== cardId)
    setCards(nextCards)
    if (selectedCardId === cardId) {
      setSelectedCardId(nextCards[0]?.id || null)
    }
  }

  const handleSave = (cardData) => {
    setCards((prev) => {
      const exists = prev.some((card) => card.id === cardData.id)
      if (exists) {
        return prev.map((card) => (card.id === cardData.id ? cardData : card))
      }
      return [cardData, ...prev]
    })
    setSelectedCardId(cardData.id)
    setEditorOpen(false)
    setEditorCard(null)
  }

  const handleCancel = () => {
    setEditorOpen(false)
    setEditorCard(null)
  }

  useEffect(() => {
    if (!cards.find((card) => card.id === selectedCardId)) {
      setSelectedCardId(cards[0]?.id || null)
    }
  }, [cards, selectedCardId])

  return (
    <main className="page-shell shop-page">
      <section className="hero-market hero-bg shell">
        <div className="hero-market-copy">
          <span className="eyebrow">{t('shop.promoTitle')}</span>
          <h1>{t('shop.title')}</h1>
          <p>{t('shop.description')}</p>
          <div className="hero-actions">
            <button type="button" className="btn-gold" onClick={() => setSearchQuery('')}>Browse Marketplace</button>
            <button type="button" className="btn-crimson" onClick={() => handleOpenEditor()}>{t('cards.addCard')}</button>
          </div>
          <div className="hero-metrics">
            <div>
              <strong>1,200+</strong>
              <span>Premium cards</span>
            </div>
            <div>
              <strong>5.0/5</strong>
              <span>Seller rating</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Live support</span>
            </div>
          </div>
        </div>
        <div className="hero-market-panel shell glass">
          <div className="hero-card-preview">
            <span className="card-label">Featured drop</span>
            <h3>{selectedCard?.name || 'First Edition Lord'} </h3>
            <p>Discover the rarest premium cards with automatic pricing and VIP access.</p>
            <div className="hero-card-stats">
              <div>
                <strong>Price</strong>
                <span>{selectedCard ? `${selectedCard.price}€` : '199€'}</span>
              </div>
              <div>
                <strong>Status</strong>
                <span>{selectedCard ? t(`cards.${selectedCard.status}`) : 'Available'}</span>
              </div>
            </div>
            <div className="hero-panel-actions">
              <button type="button" className="btn-gold">View collection</button>
              <button type="button" className="ghost-button" onClick={() => setSearchQuery('vip')}>VIP Picks</button>
            </div>
          </div>
        </div>
      </section>

      <section className="shop-heading shell">
        <div>
          <span className="eyebrow">{t('shop.title')}</span>
          <h2>Market Vault</h2>
          <p>Shop rare cards, edit your drops, and connect to sellers instantly.</p>
        </div>
      </section>

      <div className="shop-layout shop-card-management">
        <aside className="shop-aside shell">
          <div className="promo-card glass">
            <span className="eyebrow">{t('shop.promoTitle')}</span>
            <h3>{t('shop.promoText')}</h3>
            <p>{t('shop.description')}</p>
            <button type="button" className="btn-gold">Start Trading</button>
          </div>
          <div className="stock-summary glass">
            <div>
              <strong>{t('shop.shopAccess')}</strong>
              <span>4</span>
            </div>
            <div>
              <strong>{t('shop.vipAccess')}</strong>
              <span>3</span>
            </div>
            <div>
              <strong>{t('home.vipAccess')}</strong>
              <span>{currentUser.role === 'V.I.P' ? roleLabels['V.I.P'] : roleLabels[currentUser.role] || currentUser.role}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="promo-card admin-card glass">
              <strong>{t('cards.adminIntro')}</strong>
              <button type="button" className="secondary-button" onClick={() => handleOpenEditor()}>
                {t('cards.addCard')}
              </button>
            </div>
          )}
        </aside>

        <section className="catalogue-column shell">
          <div className="card-toolbar">
            <input
              type="search"
              value={searchQuery}
              onChange={handleSearch}
              placeholder={t('cards.searchPlaceholder')}
              className="card-search"
            />
          </div>

          {filteredCards.length === 0 ? (
            <div className="empty-state shell">
              <p>{t('cards.noCardsFound')}</p>
            </div>
          ) : (
            <div className="catalogue grid shop-cards">
              {filteredCards.map((card) => (
                <CardItem
                  key={card.id}
                  card={card}
                  userRole={currentUser.role}
                  t={t}
                  onSelect={handleSelect}
                  onMessage={(c) => window.dispatchEvent(new CustomEvent('openChat', { detail: { card: c } }))}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="card-detail-shell shell">
          <CardDetail
            card={selectedCard}
            userRole={currentUser.role}
            onEdit={isAdmin ? () => handleOpenEditor(selectedCard) : null}
            onDelete={isAdmin ? () => handleDelete(selectedCard?.id) : null}
            t={t}
          />
          {editorOpen && (
            <CardEditor card={editorCard} onSave={handleSave} onCancel={handleCancel} t={t} />
          )}
        </aside>
      </div>

      <section className="feedback-shell shell">
        <div className="feedback-copy">
          <span className="eyebrow">Trusted Reviews</span>
          <h2>What card empire members say</h2>
          <p>Real feedback from buyers and sellers in the Kalenski market.</p>
        </div>
        <div className="feedback-grid">
          <article className="review-card glass">
            <div className="review-stars">★★★★★</div>
            <p>„The marketplace interface feels premium and the cards look incredible. Every drop is easy to navigate."</p>
            <strong>— Kai, VIP Seller</strong>
          </article>
          <article className="review-card glass">
            <div className="review-stars">★★★★★</div>
            <p>„I love the automatic previews and the VIP pricing system. The card design is exactly what I wanted."</p>
            <strong>— Luna, Collector</strong>
          </article>
          <article className="review-card glass">
            <div className="review-stars">★★★★★</div>
            <p>„The shop looks like a real premium trading floor. Messaging sellers is smooth and the cards have a top-tier feel."</p>
            <strong>— Alex, Trader</strong>
          </article>
        </div>
      </section>
    </main>
  )
}
