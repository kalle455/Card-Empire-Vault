import UserProfile from '../components/UserProfile.jsx'

export default function Profile({ currentUser, t }) {
  return (
    <main className="page-shell">
      <section className="section-header shell">
        <div>
          <span className="eyebrow">{t('profile.title')}</span>
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.description')}</p>
        </div>
      </section>

      <UserProfile user={currentUser} t={t} />
    </main>
  )
}
