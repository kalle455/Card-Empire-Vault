# Supabase setup

1. Open your Supabase project → **SQL Editor**.
2. Run `schema.sql` first.
3. Run `002_empire_catalog.sql` second.
4. Run `004_purchase_card.sql` third. This makes stock reduction safe when players buy cards.
5. Run `005_live_purchase_chat.sql` fourth. This activates the private real-time chat after a purchase.
6. Run `006_complete_purchase_chat.sql` fifth. This lets Kalenski™ mark a deal as completed and closes the chat.
7. Run `007_list_live_chats.sql` sixth. This makes the chat inbox load reliably for both customers and admins.
8. Run `008_live_updates.sql` seventh. This enables instant live updates for cards, chats and notification badges.
9. Run `009_banlist_categories.sql` eighth. This separates Banned and Limited cards in every banlist.
10. Run `010_king_of_1_banlist.sql` ninth. This adds the official **KING OF 1** banlist.
11. In **Authentication → Providers → Email**, enable email/password login and turn off email confirmation.
12. Create your account through the website. Then, in the SQL Editor, make Kalenski the administrator:

```sql
update public.profiles
set role = 'admin'
where username = 'YOUR_KALENSKI_USERNAME';
```

The website only shows a username and password. It uses an internal technical email address in the background because Supabase requires one. Never add a service-role key to the frontend.
