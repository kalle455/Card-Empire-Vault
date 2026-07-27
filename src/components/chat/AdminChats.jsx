import { useState } from 'react'
import MessageList from './MessageList.jsx'

export default function AdminChats({ conversations = [], setChats, currentUser }) {
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState(conversations[0]?.id || null)

  const list = (conversations || []).filter((c) => {
    const name = c.card?.name || c.customer?.name || ''
    return name.toLowerCase().includes(filter.toLowerCase())
  })

  const selected = (conversations || []).find((c) => c.id === selectedId) || list[0] || null

  const handleReply = (text) => {
    if (!selected) return
    const reply = {
      id: `msg-${Date.now()}`,
      sender: currentUser?.id || 'admin',
      text: text.trim(),
      ts: new Date().toISOString(),
    }
    setChats((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? { ...c, messages: [...(c.messages || []), reply], status: 'open' }
          : c
      )
    )
  }

  return (
    <div className="admin-chats-grid">
      <div className="admin-chats-list shell">
        <div className="panel-header">
          <h3>Conversations</h3>
          <input placeholder="Search..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="conversation-list">
          {list.length === 0 ? (
            <div className="empty-row">No conversations</div>
          ) : (
            list.map((c) => (
              <div
                key={c.id}
                className={`table-row ${c.id === selected?.id ? 'active' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div>
                  <strong>{c.card?.name}</strong>
                  <div className="muted">{c.customer?.name} • {(c.messages || []).length} msgs</div>
                </div>
                <div>{c.status}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-chats-detail shell">
        {selected ? (
          <>
            <div className="panel-header">
              <div>
                <h3>{selected.card?.name}</h3>
                <div className="muted">Customer: {selected.customer?.name}</div>
              </div>
            </div>
            <MessageList messages={selected.messages || []} currentUser={currentUser} />
            <div className="chat-input">
              <input id="admin-reply-input" placeholder="Reply to customer..." />
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const el = document.getElementById('admin-reply-input')
                  if (!el || !el.value.trim()) return
                  handleReply(el.value)
                  el.value = ''
                }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="empty-row">Select a conversation to view messages</div>
        )}
      </div>
    </div>
  )
}
