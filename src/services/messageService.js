// messageService.js — local chat/message storage; prepare for Supabase/Firebase
export async function createConversation(conv) {
  // conv: { id, card, customer, messages, status, createdAt }
  return conv
}

export async function addMessage(conversationId, message) {
  // message: { id, sender, text, ts }
  return { conversationId, message }
}

export async function listConversations() {
  return []
}
