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
11. Run `011_keep_sales_history_when_removing_cards.sql` tenth. This lets you remove cards from Cardstock without deleting their completed sales from the Bücher.
12. Run `012_public_card_market.sql` next. This makes cards visible in the Card Market even when a visitor is not signed in.
13. Run `013_auto_publish_feedback.sql` next. This keeps legacy feedback records available while the new Community system replaces the old Feedback page.
14. In **Authentication → Providers → Email**, enable email/password login and turn off email confirmation.
15. Create your account through the website. Then, in the SQL Editor, make Kalenski the administrator:

```sql
update public.profiles
set role = 'admin'
where username = 'YOUR_KALENSKI_USERNAME';
```

The website only shows a username and password. It uses an internal technical email address in the background because Supabase requires one. Never add a service-role key to the frontend.


## Minimal Discord login without a personal email

17. Run `017_discord_login_and_notification_cleanup.sql` if you have not already done so.
18. Run `018_minimal_discord_identity.sql`, `019_harden_minimal_discord_identity.sql` and `020_lock_down_discord_helper_permissions.sql` in that order. Existing installations may already have these migrations.
19. Keep **Authentication → Providers → Anonymous Sign-Ins** disabled. Card Empire no longer needs anonymous users.
20. Keep the Supabase **Email** provider enabled for the private internal session only. Players never enter an email address, no personal Discord email is requested and no confirmation email is sent.
21. In the [Discord Developer Portal](https://discord.com/developers/applications) open your application → **OAuth2** and add this exact redirect:

```text
https://card-empire-vault.vercel.app/api/discord-callback
```

22. Remove the old Supabase callback if it is no longer needed:

```text
https://ewpqnrhhrqvlywmdbral.supabase.co/auth/v1/callback
```

23. Disable the built-in Discord provider in Supabase. Card Empire uses its own callback and requests Discord's mandatory `identify` scope only.
24. In Vercel open **card-empire-vault → Settings → Environment Variables** and add these server-only variables for Production and Preview:

```text
DISCORD_CLIENT_ID          = Discord application Client ID
DISCORD_CLIENT_SECRET      = Discord application Client Secret
SUPABASE_SERVICE_ROLE_KEY  = Supabase Project Settings → API → service_role key
APP_URL                    = https://card-empire-vault.vercel.app
```

Never prefix secret variables with `VITE_` and never paste them into GitHub or chat. Only Vercel server functions may read them.

25. Deploy the newest `main` commit to Production.
26. On the first Discord connection, Card Empire creates or reuses one stable player profile. It stores the Discord ID and username, then asks once for the exact DMO player name.
27. The same Discord account opens the same Card Empire profile on every device, preserving the role, record and loyalty points.
28. If the linked profile should be Kalenski's admin profile, restore the role once if necessary:

```sql
update public.profiles
set role = 'admin'
where dmo_name = 'YOUR_DMO_NAME';
```

## Cardstock profile, wishlist and Community

29. Run `021_cardstock_community.sql`. This adds profile XP/ranks, order-history support, wishlists, the new Community system, polls, reviews, comments and live wishlist events. Existing cards, purchases and profiles are preserved.
30. Run `023_pause_wishlist_discord.sql` after `022_secure_wishlist_discord.sql`. Wishlist updates remain available inside Card Empire, while direct Discord delivery is paused and no new Discord queue entries are created.
