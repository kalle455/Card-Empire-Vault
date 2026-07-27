import './Navbar.css'
import { roleLabels } from '../data/roleLabels.js'

export default function Navbar({ activePage, onNav, currentUser, setCurrentUser, t }) {
  const navItems = ['home', 'shop', 'events', 'profile']
  if (currentUser && currentUser.role === 'ADMIN') {
    navItems.push('admin')
  }

  return (
    <header className="navbar shell">
      <div className="brand">
        <div className="brand-mark">K</div>
        <div>
          <p>{t('brand.name')}</p>
          <span>{t('brand.tagline')}</span>
        </div>
      </div>

      <nav className="nav-links" aria-label="Primary navigation">
        {navItems.map((key) => (
          <button
            key={key}
            type="button"
            className={key === activePage ? 'nav-link active' : 'nav-link'}
            onClick={() => onNav(key)}
          >
            {t(`nav.${key}`)}
          </button>
        ))}
      </nav>

      <div className="nav-right">
        
        <div className="user-panel">
          {currentUser ? (
            <>
              <div className="user-avatar">{currentUser.name.charAt(0)}</div>
              <div>
                <span className="user-name">{currentUser.name}</span>
                <span className="user-role">{roleLabels[currentUser.role] || currentUser.role}</span>
              </div>
              <div className="user-actions">
                <button type="button" className="ghost-button" onClick={() => onNav('profile')}>{t('nav.profile')}</button>
                <button type="button" className="ghost-button" onClick={() => { window.localStorage.removeItem('kalenskiUser'); setCurrentUser(null); onNav('home') }}>{t('auth.logout') || 'Logout'}</button>
              </div>
            </>
          ) : (
            <div className="auth-links">
              <button type="button" className="ghost-button" onClick={() => onNav('login')}>{t('auth.login')}</button>
              <button type="button" className="ghost-button" onClick={() => onNav('register')}>{t('auth.register')}</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
