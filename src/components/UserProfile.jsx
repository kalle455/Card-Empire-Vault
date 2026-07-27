import { roleLabels } from '../data/roleLabels.js'

export default function UserProfile({ user, t }) {
  const isPotm = user.role === 'POTM'

  return (
    <section className="profile-panel shell">
      <div className="profile-top">
        <div className="profile-avatar-large">{user.name.charAt(0)}</div>
        <div>
          <h2>{user.name}</h2>
          <p className="profile-role">{roleLabels[user.role] || user.role}</p>
          {isPotm && <span className="pill premium">{t('profile.playerOfTheMonth')}</span>}
        </div>
      </div>

      <div className="profile-summary">
        <div>
          <strong>{t('profile.vaultScore')}</strong>
          <span>Elite Collector</span>
        </div>
        <div>
          <strong>{t('profile.collectorValue')}</strong>
          <span>Gold-Rang</span>
        </div>
      </div>

      <p className="profile-bio">{user.bio}</p>

      <div className="profile-details">
        <div>
          <strong>{t('profile.memberSince')}</strong>
          <span>{user.joined}</span>
        </div>
        <div>
          <strong>{t('profile.rewards')}</strong>
          <span>{user.rewards}</span>
        </div>
        <div>
          <strong>{t('profile.role')}</strong>
          <span>{roleLabels[user.role] || user.role}</span>
        </div>
      </div>
    </section>
  )
}
