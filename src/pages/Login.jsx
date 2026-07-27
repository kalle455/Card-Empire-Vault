import { useState } from 'react'
import { users as initialUsers } from '../data/users.js'

export default function Login({ setCurrentUser, onLogin, t }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    // Simple client-only auth: match name to existing user or create guest
    const existing = initialUsers.find((u) => u.name.toLowerCase() === name.trim().toLowerCase())
    if (existing) {
      setCurrentUser(existing)
      if (typeof onLogin === 'function') onLogin(existing)
      return
    }
    const guest = { id: `guest-${Date.now()}`, name: name || 'Guest', role: 'CUSTOMER' }
    setCurrentUser(guest)
    if (typeof onLogin === 'function') onLogin(guest)
  }

  return (
    <main className="page-shell">
      <section className="section-header shell">
        <div>
          <h1>{t('auth.login')}</h1>
        </div>
      </section>
      <section className="auth-shell shell">
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>{t('auth.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-row">
            <button type="submit" className="primary-button">{t('auth.login')}</button>
          </div>
        </form>
      </section>
    </main>
  )
}
