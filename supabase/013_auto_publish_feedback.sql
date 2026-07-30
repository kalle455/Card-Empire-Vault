-- Run this once in the Supabase SQL Editor.
-- Feedback is published automatically and can be shown to every visitor.
-- Admins can still hide individual entries later by setting approved = false.

alter table public.feedback
  alter column approved set default true;

update public.feedback
set approved = true
where approved = false;

drop policy if exists "Everyone signed in sees feedback" on public.feedback;
drop policy if exists "Public approved feedback" on public.feedback;
drop policy if exists "Public visible feedback" on public.feedback;
drop policy if exists "Admins view all feedback" on public.feedback;

create policy "Public visible feedback"
on public.feedback
for select
to anon, authenticated
using (approved = true);

create policy "Admins view all feedback"
on public.feedback
for select
to authenticated
using (public.is_admin());

alter publication supabase_realtime add table public.feedback;
