-- Loyalty Level 10: automatic Regular Customer promotion.
-- Run after 014_empire_loyalty.sql.

create or replace function public.apply_loyalty_level_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'customer' and new.loyalty_points >= 10 then
    new.role := 'regular_customer';
  end if;
  return new;
end;
$$;

drop trigger if exists loyalty_level_role_trigger on public.profiles;
create trigger loyalty_level_role_trigger
before insert or update of loyalty_points on public.profiles
for each row
execute function public.apply_loyalty_level_role();

-- Promote customers who already reached Level 10.
update public.profiles
set loyalty_points = loyalty_points
where role = 'customer'
  and loyalty_points >= 10;
