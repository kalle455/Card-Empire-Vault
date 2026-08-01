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
11. Run `011_keep_sales_history_when_removing_cards.sql` tenth. This lets you remove cards from the Vault without deleting their completed sales from the Bücher.
12. Run `012_public_card_market.sql` next. This makes cards visible in the Card Market even when a visitor is not signed in.
13. Run `013_auto_publish_feedback.sql` next. This automatically approves feedback and shows it live on the Feedback page.
14. In **Authentication → Providers → Email**, enable email/password login and turn off email confirmation.
15. Create your account through the website. Then, in the SQL Editor, make Kalenski the administrator:

```sql
update public.profiles
set role = 'admin'
where username = 'YOUR_KALENSKI_USERNAME';
```

The website only shows a username and password. It uses an internal technical email address in the background because Supabase requires one. Never add a service-role key to the frontend.


## Discord-only login upgrade

17. Run `017_discord_login_and_notification_cleanup.sql` in the SQL Editor.
18. Open the [Discord Developer Portal](https://discord.com/developers/applications), create an application and open **OAuth2**.
19. Add this exact Discord redirect URL:

```text
https://ewpqnrhhrqvlywmdbral.supabase.co/auth/v1/callback
```

20. In Supabase open **Authentication → Providers → Discord**, enable Discord and paste the Discord **Client ID** and **Client Secret**. The secret stays in Supabase and must never be added to GitHub.
21. In Supabase open **Authentication → URL Configuration**:
    - Site URL: `https://card-empire-vault.onrender.com`
    - Redirect URL: `https://card-empire-vault.onrender.com/**`
22. Deploy the newest `main` commit on Render.
23. Sign out of the old account and sign in through Discord. Then restore the admin role for the new Discord profile:

```sql
update public.profiles
set role = 'admin'
where username = 'YOUR_DISCORD_NAME';
```

24. After the Discord login works, disable the Email provider in **Authentication → Providers → Email**.
