import { useEffect, useMemo, useState } from 'react'
import { fetchCardMetadataByName } from '../services/cardApi.js'

const emptyCard = {
  id: '',
  name: '',
  price: 0,
  status: 'available',
  image: '/cards/placeholder-card.svg',
}

export default function CardEditor({ card, onSave, onCancel, t }) {
  const initialCard = useMemo(() => ({ ...emptyCard, ...(card || {}) }), [card])
  const [formData, setFormData] = useState(initialCard)

  useEffect(() => {
    setFormData(initialCard)
  }, [initialCard])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'price' ? Number(value) : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const meta = await fetchCardMetadataByName(formData.name)
    const normalizedCard = {
      ...formData,
      id: formData.id.trim() || meta.id,
      image: meta.image || `/cards/${(formData.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`,
    }
    onSave(normalizedCard)
  }

  return (
    <section className="card-editor">
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="name">{t('cards.nameLabel') || 'Name'}</label>
          <input id="name" name="name" value={formData.name} onChange={handleChange} required />
        </div>

        <div className="form-row">
          <label htmlFor="price">{t('cards.priceLabel')}</label>
          <input id="price" name="price" type="number" value={formData.price} onChange={handleChange} min="0" />
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
          <button type="button" className="ghost-button" onClick={onCancel}>{t('cards.cancel')}</button>
        </div>
      </form>
    </section>
  )
}
