import { useEffect, useState } from 'react'
import './App.css'
import Navbar from './components/Navbar.jsx'
import ChatHost from './components/ChatHost.jsx'
import Home from './pages/Home.jsx'
import Shop from './pages/Shop.jsx'
import Events from './pages/Events.jsx'
import Profile from './pages/Profile.jsx'
import Admin from './pages/Admin.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import { users as initialUsers } from './data/users.js'
import { cards as initialCards } from './data/cards.js'
import { events as initialEvents } from './data/events.js'
import { chats as initialChats } from './data/chats.js'
import { translate } from './data/translations.js'

const pages = {
  home: Home,
  shop: Shop,
  events: Events,
  profile: Profile,
  admin: Admin,
  login: Login,
  register: Register,
}

const defaultUser = initialUsers.find((user) => user.role === 'ADMIN') || initialUsers.find((user) => user.id === 'vip-024') || initialUsers[0]

function App() {
  const [activePage, setActivePage] = useState('home')
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('kalenskiUser')
      return saved ? JSON.parse(saved) : defaultUser
    }
    return defaultUser
  })

  const [cards, setCards] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('kalenskiCards') || window.localStorage.getItem('vaultCards')
      return saved ? JSON.parse(saved) : initialCards
    }
    return initialCards
  })

  const [events, setEvents] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('kalenskiEvents')
      return saved ? JSON.parse(saved) : initialEvents
    }
    return initialEvents
  })

  const [chats, setChats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('kalenskiChats')
      return saved ? JSON.parse(saved) : initialChats
    }
    return initialChats
  })

  const [usersState, setUsersState] = useState(initialUsers)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kalenskiCards', JSON.stringify(cards))
    }
  }, [cards])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kalenskiEvents', JSON.stringify(events))
    }
  }, [events])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kalenskiChats', JSON.stringify(chats))
    }
  }, [chats])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kalenskiUser', JSON.stringify(currentUser))
    }
  }, [currentUser])

  const t = (path, params) => translate('en', path, params)
  const PageComponent = pages[activePage]

  return (
    <div className="app-shell">
      <Navbar
        activePage={activePage}
        onNav={setActivePage}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        t={t}
      />
      <main className="content-shell">
        <PageComponent
          currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            t={t}
          cards={cards}
          setCards={setCards}
          events={events}
          setEvents={setEvents}
          chats={chats}
          setChats={setChats}
          users={usersState}
          setUsers={setUsersState}
        />
      </main>
      <ChatHost currentUser={currentUser} chats={chats} setChats={setChats} />
    </div>
  )
}

export default App
