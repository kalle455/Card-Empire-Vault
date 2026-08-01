-- Internal Discord helper functions must not be exposed as public RPC endpoints.

revoke execute on function public.create_profile() from public, anon, authenticated;
revoke execute on function public.protect_player_profile_fields() from public, anon, authenticated;
revoke execute on function public.is_discord_user() from public, anon;
grant execute on function public.is_discord_user() to authenticated;

