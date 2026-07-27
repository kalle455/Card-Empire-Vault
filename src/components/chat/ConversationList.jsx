export default function ConversationList({ conversations = [], onSelect }) {
  return (
    <div className="conversation-list">
      {conversations.length === 0 ? (
        <div className="empty">No conversations</div>
      ) : (
        conversations.map((c) => (
          <div key={c.id} className="conversation-row" onClick={() => onSelect(c)}>
            <div className="conv-title">{c.card?.name} — {c.customer?.name}</div>
            <div className="conv-meta">{c.messages?.length || 0} msgs • {c.status}</div>
          </div>
        ))
      )}
    </div>
  )
}
