import React from 'react'

export default function SellerDashboard({ chats = [], offers = [], cards = [], t }) {
  const unread = (chats || []).filter((c) => c.status === 'open').length
  return (
    <section className="seller-dashboard shell">
      <div className="section-header">
        <h2>Seller Dashboard</h2>
        <p>Overview of messages, offers and sales.</p>
      </div>

      <div className="seller-panels grid">
        <div className="panel">
          <h3>Incoming Messages</h3>
          <div className="muted">{unread} unread conversations</div>
        </div>

        <div className="panel">
          <h3>Offers</h3>
          <div className="muted">{(offers || []).length} offers</div>
        </div>

        <div className="panel">
          <h3>Your Listings</h3>
          <div className="muted">{(cards || []).length} cards</div>
        </div>
      </div>
    </section>
  )
}
