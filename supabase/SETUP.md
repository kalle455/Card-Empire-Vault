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


## Minimal Discord login without email

17. Run `017_discord_login_and_notification_cleanup.sql` if you have not already done so.
18. Run `018_minimal_discord_identity.sql` in the Supabase SQL Editor.
19. In Supabase open **Authentication → Providers → Anonymous Sign-Ins** and enable anonymous sign-ins. This creates the private Supabase session before Discord is linked.
20. In the [Discord Developer Portal](https://discord.com/developers/applications) open your application → **OAuth2** and add this exact redirect:

```text
https://card-empire-vault.vercel.app/api/discord-callback
```

21. Remove the old Supabase callback from the Discord application if it is no longer needed:

```text
https://ewpqnrhhrqvlywmdbral.supabase.co/auth/v1/callback
```

22. Disable the built-in Discord provider in Supabase. The website now uses its own minimal Discord callback with the mandatory `identify` scope only.
23. In Vercel open **card-empire-vault → Settings → Environment Variables** and add these server-only variables for Production and Preview:

```text
DISCORD_CLIENT_ID          = Discord application Client ID
DISCORD_CLIENT_SECRET      = Discord application Client Secret
SUPABASE_SERVICE_ROLE_KEY  = Supabase Project Settings → API → service_role key
APP_URL                    = https://card-empire-vault.vercel.app
```

Never prefix the secret variables with `VITE_` and never paste them into GitHub. Only Vercel server functions may read them.

24. Deploy the newest `main` commit to Production.
25. Sign in with Discord. Card Empire stores only the Discord ID and username, then asks once for the exact DMO player name. It does not request or store email, avatar, banner, messages, friends or servers.
26. If an old Card Empire session is still active, the Discord identity is linked to that same profile so its role, record and loyalty points stay intact.
27. If you linked a completely new profile, restore the admin role once:

```sql
update public.profiles
set role = 'admin'
where dmo_name = 'YOUR_DMO_NAME';
```
