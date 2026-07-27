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
      <section className="section-header shell">
        <div>
          <span className="eyebrow">{t('shop.promoTitle')}</span>
          <h1>{t('shop.title')}</h1>
          <p>{t('shop.description')}</p>
        </div>
      </section>

      <div className="shop-layout shop-card-management">
        <aside className="shop-aside shell">
          <div className="promo-card">
            <span className="eyebrow">{t('shop.promoTitle')}</span>
            <h3>{t('shop.promoText')}</h3>
            <p>{t('shop.description')}</p>
            <button type="button" className="primary-button">{t('buttons.activateVip')}</button>
          </div>
          <div className="stock-summary">
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
            <div className="promo-card admin-card">
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
            <div className="empty-state">
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
    </main>
  )
}
