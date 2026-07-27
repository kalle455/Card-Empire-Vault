import { useEffect, useState } from 'react'

export default function ChatWindow({ currentUser, card, onClose, onSend, conversation }) {
  const [message, setMessage] = useState('')

  useEffect(() => {
    setMessage('')
  }, [conversation])

  const handleSend = () => {
    if (!message.trim()) return
    const msg = {
      id: Date.now().toString(),
      sender: currentUser.id,
      text: message.trim(),
      ts: new Date().toISOString(),
    }
    onSend(msg)
    setMessage('')
  }

  if (!card) return null

  return (
    <div className="chat-window">
      <div className="chat-header">
        <strong>{card.name}</strong>
        <button type="button" className="ghost-button" onClick={onClose}>Schließen</button>
      </div>
      <div className="chat-body">
        {conversation?.messages?.length ? (
          conversation.messages.map((m) => (
            <div key={m.id} className={`chat-msg ${m.sender === currentUser.id ? 'me' : 'them'}`}>
              <div className="chat-text">{m.text}</div>
              <div className="chat-ts">{new Date(m.ts).toLocaleString()}</div>
            </div>
          ))
        ) : (
          <div className="chat-empty">Keine Nachrichten</div>
        )}
      </div>

      <div className="chat-input">
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Nachricht schreiben..." />
        <button type="button" className="primary-button" onClick={handleSend}>Senden</button>
      </div>
    </div>
  )
}
