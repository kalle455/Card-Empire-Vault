import { useState } from 'react'

export default function Register({ setCurrentUser, users, setUsers, t }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const id = `user-${Date.now()}`
    const newUser = { id, name: name || `User-${id}`, role: 'CUSTOMER', joined: new Date().toISOString() }
    setUsers((prev) => [newUser, ...(prev || [])])
    setCurrentUser(newUser)
  }

  return (
    <main className="page-shell">
      <section className="section-header shell">
        <div>
          <h1>{t('auth.register')}</h1>
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
            <button type="submit" className="primary-button">{t('auth.register')}</button>
          </div>
        </form>
      </section>
    </main>
  )
}
