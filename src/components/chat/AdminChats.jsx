import { useState } from 'react'

export default function AdminChats({ conversations, onSelect }) {
  const [filter, setFilter] = useState('')
  const list = conversations.filter((c) => c.card?.name.toLowerCase().includes(filter.toLowerCase()) || c.customer?.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="admin-chats">
      <div className="panel-header">
        <h3>Konversationen</h3>
        <input placeholder="Suchen..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="chat-list">
        {list.length === 0 ? (
          <div className="empty-row">Keine Gespräche</div>
        ) : (
          list.map((c) => (
            <div key={c.id} className="table-row" onClick={() => onSelect(c.id)}>
              <div>
                <strong>{c.card?.name}</strong>
                <div className="muted">{c.customer?.name} • {c.messages?.length || 0} Nachrichten</div>
              </div>
              <div>{c.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
