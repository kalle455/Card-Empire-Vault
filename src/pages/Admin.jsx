import { useMemo, useState } from 'react'
import UserTable from '../components/admin/UserTable.jsx'
import CardAdminPanel from '../components/admin/CardAdminPanel.jsx'
import EventAdminPanel from '../components/admin/EventAdminPanel.jsx'
import AdminChats from '../components/chat/AdminChats.jsx'

export default function Admin({ currentUser, t, cards, setCards, users, setUsers, events, setEvents, chats, setChats }) {
  const [usersState, setUsersState] = useState(users)
  const [eventsState, setEventsState] = useState(events)

  // conversations come from props.chat(s)
  const [conversations] = useState(chats || [])

  const isAdmin = currentUser.role === 'ADMIN'

  const handleRoleChange = (userId, newRole) => {
    setUsersState((prev) =>
      prev.map((item) => (item.id === userId ? { ...item, role: newRole } : item))
    )
  }

  const handleCardDelete = (cardId) => {
    setCards((prev) => prev.filter((item) => item.id !== cardId))
  }

  const handleCardSave = (cardData) => {
    setCards((prev) => {
      const exists = prev.some((item) => item.id === cardData.id)
      if (exists) {
        return prev.map((item) => (item.id === cardData.id ? cardData : item))
      }
      return [cardData, ...prev]
    })
  }

  const handleEventSave = (eventData) => {
    setEvents((prev) => {
      const exists = prev.some((item) => item.id === eventData.id)
      if (exists) {
        return prev.map((item) => (item.id === eventData.id ? eventData : item))
      }
      return [eventData, ...prev]
    })
    setEventsState((prev) => {
      const exists = prev.some((item) => item.id === eventData.id)
      if (exists) {
        return prev.map((item) => (item.id === eventData.id ? eventData : item))
      }
      return [eventData, ...prev]
    })
  }

  const adminPanels = useMemo(() => {
    if (!isAdmin) {
      return (
        <div className="admin-denied shell">
          <p>{t('admin.accessDenied')}</p>
        </div>
      )
    }

    return (
      <div className="admin-grid">
        <section className="admin-panel shell">
          <h2>{t('admin.userManagement')}</h2>
          <UserTable users={usersState} onRoleChange={handleRoleChange} t={t} />
        </section>

        <section className="admin-panel shell">
          <h2>{t('admin.cardManagement')}</h2>
          <CardAdminPanel cards={cards} onSave={handleCardSave} onDelete={handleCardDelete} t={t} />
        </section>

        <section className="admin-panel shell">
          <h2>{t('admin.eventManagement')}</h2>
          <EventAdminPanel events={eventsState} onSave={handleEventSave} t={t} />
        </section>

        <section className="admin-panel shell">
          <h2>{t('admin.chatManagement') || 'Nachrichten'}</h2>
          <AdminChats conversations={conversations} onSelect={(id) => { /* handled in chat host */ }} />
        </section>
      </div>
    )
  }, [isAdmin, usersState, cards, eventsState, t])

  return (
    <main className="page-shell admin-page">
      <section className="section-header shell">
        <div>
          <span className="eyebrow">{t('admin.title')}</span>
          <h1>{t('admin.title')}</h1>
          <p>{t('admin.subtitle')}</p>
        </div>
      </section>
      {adminPanels}
    </main>
  )
}
