-- Goldfish: tighten what players can do to fish and profiles directly.
-- Run once in Supabase > SQL Editor > New query > Run, after owned-fish.sql.
-- (owned-fish.sql already includes these lines for new setups.)
--
-- 1. Nobody adds fish directly: buy_fish(), which charges the points, is the
--    only way to get one. (A direct insert was getting through on the live
--    database, so free fish were possible.)
-- 2. The only thing you can change on your own fish is whether it's in the
--    tank. Before, you could change fish_id too, turning a cheap fish into an
--    expensive one for free.
-- 3. You can save your avatar: profiles only allowed updating certain
--    columns, and avatar_fish_id wasn't one of them.
--
-- These are permissions, so they hold whatever row rules the tables have.
-- buy_fish() runs with the owner's rights and keeps working.
-- Everything runs in one transaction: if any step fails, nothing changes.

begin;

revoke insert on public.owned_fish from anon, authenticated;

revoke update on public.owned_fish from anon, authenticated;
grant  update (in_tank) on public.owned_fish to authenticated;

grant  update (avatar_fish_id) on public.profiles to authenticated;

commit;

-- Let the API see the changes right away.
notify pgrst, 'reload schema';
