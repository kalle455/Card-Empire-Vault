import { useMemo, useState } from 'react'

const emptyEvent = {
  id: '',
  title: '',
  date: '',
  status: 'Planned',
  price: 0,
  participants: 0,
  description: '',
}

export default function EventAdminPanel({ events, onSave, t }) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [formData, setFormData] = useState(emptyEvent)

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  )

  const openEditor = (event) => {
    setFormData(event || emptyEvent)
    setEditorOpen(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'price' || name === 'participants' ? Number(value) : value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalized = {
      ...formData,
      id: formData.id.trim() || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    }
    onSave(normalized)
    setEditorOpen(false)
  }

  return (
    <div className="admin-event-panel">
      <div className="admin-event-list">
        <div className="panel-header">
          <h3>{t('admin.events')}</h3>
          <button type="button" className="secondary-button" onClick={() => openEditor(emptyEvent)}>
            {t('admin.addEvent')}
          </button>
        </div>
        {events.length === 0 ? (
          <div className="empty-row">{t('admin.noEvents')}</div>
        ) : (
          events.map((eventItem) => (
            <div className="table-row" key={eventItem.id} onClick={() => setSelectedEventId(eventItem.id)}>
              <span>{eventItem.title}</span>
              <span>{eventItem.date}</span>
            </div>
          ))
        )}
      </div>

      {editorOpen && (
        <section className="card-editor admin-event-editor">
          <h4>{formData.id ? t('admin.editEvent') || t('admin.addEvent') : t('admin.addEvent')}</h4>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label htmlFor="title">{t('admin.eventName')}</label>
              <input id="title" name="title" value={formData.title} onChange={handleChange} required />
            </div>
            <div className="form-row">
              <label htmlFor="date">{t('admin.eventDate')}</label>
              <input id="date" name="date" type="text" value={formData.date} onChange={handleChange} />
            </div>
            <div className="form-row">
              <label htmlFor="price">{t('admin.eventPrice')}</label>
              <input id="price" name="price" type="number" min="0" value={formData.price} onChange={handleChange} />
            </div>
            <div className="form-row">
              <label htmlFor="participants">{t('admin.eventParticipants')}</label>
              <input id="participants" name="participants" type="number" min="0" value={formData.participants} onChange={handleChange} />
            </div>
            <div className="form-row">
              <label htmlFor="description">{t('cards.descriptionLabel')}</label>
              <textarea id="description" name="description" value={formData.description} onChange={handleChange} />
            </div>
            <div className="editor-actions">
              <button type="submit" className="primary-button">{t('admin.saveEvent')}</button>
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
