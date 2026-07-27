export default function UserTable({ users, onRoleChange, t }) {
  return (
    <div className="admin-table user-table">
      <div className="table-row table-head">
        <span>{t('admin.users')}</span>
        <span>{t('admin.roleLabel')}</span>
      </div>
      {users.length === 0 ? (
        <div className="table-row empty-row">{t('admin.noUsers')}</div>
      ) : (
        users.map((user) => (
          <div className="table-row" key={user.id}>
            <span>{user.name}</span>
            <select value={user.role} onChange={(e) => onRoleChange(user.id, e.target.value)}>
              <option value="ADMIN">ADMIN</option>
              <option value="V.I.P">V.I.P</option>
              <option value="POTM">POTM</option>
              <option value="REGULAR">REGULAR</option>
              <option value="CUSTOMER">CUSTOMER</option>
            </select>
          </div>
        ))
      )}
    </div>
  )
}
