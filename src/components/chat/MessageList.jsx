export default function MessageList({ messages = [], currentUser }) {
  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="empty">No messages</div>
      ) : (
        messages.map((m) => (
          <div key={m.id} className={`msg ${m.sender === currentUser?.id ? 'me' : 'them'}`}>
            <div className="msg-text">{m.text}</div>
            <div className="msg-ts">{new Date(m.ts).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  )
}
