import { useEffect, useState } from 'react'
import ChatWindow from './chat/ChatWindow.jsx'

export default function ChatHost({ currentUser, chats, setChats }) {
  const [open, setOpen] = useState(false)
  const [card, setCard] = useState(null)
  const [conversation, setConversation] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      const card = e.detail?.card
      if (!card) return
      setCard(card)
      // find or create conversation for this user+card
      const existing = chats.find((c) => c.card?.id === card.id && c.customer?.id === (currentUser?.id || 'guest'))
      if (existing) {
        setConversation(existing)
      } else {
        const conv = { id: `conv-${Date.now()}`, card, customer: currentUser || { id: 'guest', name: 'Guest' }, messages: [], status: 'open', createdAt: new Date().toISOString() }
        setChats((prev) => [conv, ...(prev || [])])
        setConversation(conv)
      }
      setOpen(true)
    }
    window.addEventListener('openChat', handler)
    return () => window.removeEventListener('openChat', handler)
  }, [chats, currentUser, setChats])

  // keep conversation object in sync when chats update
  useEffect(() => {
    if (!conversation) return
    const updated = chats.find((c) => c.id === conversation.id)
    if (updated) setConversation(updated)
  }, [chats])

  const handleClose = () => setOpen(false)

  const handleSend = (msg) => {
    setChats((prev) => {
      const next = prev.map((c) => {
        if (c.id === conversation.id) {
          return { ...c, messages: [...(c.messages || []), msg] }
        }
        return c
      })
      return next
    })
  }

  if (!open) return null

  return (
    <ChatWindow
      currentUser={currentUser || { id: 'guest', name: 'Guest' }}
      card={card}
      conversation={conversation}
      onClose={handleClose}
      onSend={handleSend}
    />
  )
}
