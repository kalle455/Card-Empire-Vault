import { useMemo, useState } from 'react'
import { fetchCardMetadataByName } from '../../services/cardApi.js'

const emptyCard = {
  id: '',
  name: '',
  price: 0,
  status: 'available',
  image: '/cards/placeholder-card.svg',
}

export default function CardAdminPanel({ cards, onSave, onDelete, t }) {
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id || null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [formData, setFormData] = useState(emptyCard)

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  )

  const openEditor = (card) => {
    setFormData(card || emptyCard)
    setEditorOpen(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' ? Number(value) : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const meta = await fetchCardMetadataByName(formData.name)
    const normalized = {
      ...formData,
      id: formData.id.trim() || meta.id,
      image: meta.image || `/cards/${(formData.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`,
    }
    onSave(normalized)
    setEditorOpen(false)
  }

  return (
    <div className="admin-card-panel">
      <div className="admin-card-list">
        <div className="panel-header">
          <h3>{t('admin.cards')}</h3>
          <button type="button" className="secondary-button" onClick={() => openEditor(emptyCard)}>
            {t('cards.addCard')}
          </button>
        </div>
        {cards.length === 0 ? (
          <div className="empty-row">{t('admin.noCards')}</div>
        ) : (
          cards.map((card) => (
            <div className="table-row" key={card.id}>
              <span onClick={() => setSelectedCardId(card.id)}>{card.name}</span>
              <div className="row-actions">
                <button type="button" className="ghost-button" onClick={() => openEditor(card)}>
                  {t('cards.editCard')}
                </button>
                <button type="button" className="ghost-button" onClick={() => onDelete(card.id)}>
                  {t('cards.deleteCard')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editorOpen && (
        <section className="card-editor admin-card-editor">
          <h4>{formData.id ? t('cards.editCard') : t('cards.addCard')}</h4>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label htmlFor="name">{t('cards.nameLabel')}</label>
              <input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-row">
              <label htmlFor="price">{t('cards.priceLabel')}</label>
              <input id="price" name="price" type="number" min="0" value={formData.price} onChange={handleChange} />
            </div>
              <div className="form-row">
                <label htmlFor="status">{t('cards.statusLabel')}</label>
                <select id="status" name="status" value={formData.status} onChange={handleChange}>
                  <option value="available">{t('cards.available')}</option>
                  <option value="sold">{t('cards.sold')}</option>
                </select>
              </div>
            <div className="editor-actions">
              <button type="submit" className="primary-button">{t('cards.saveCard')}</button>
              <button type="button" className="ghost-button" onClick={() => setEditorOpen(false)}>
                {t('cards.cancel')}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
