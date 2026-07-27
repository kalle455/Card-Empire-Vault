// authService.js — client-side stub to prepare for Supabase/Firebase
export async function registerUser({ name, password }) {
  const user = { id: `user-${Date.now()}`, name, role: 'CUSTOMER', joined: new Date().toISOString() }
  return user
}

export async function loginUser({ name, password }) {
  // simple local match is handled in UI; stub kept for future
  return { id: `user-${Date.now()}`, name, role: 'CUSTOMER' }
}

export async function listUsers() {
  return []
}
