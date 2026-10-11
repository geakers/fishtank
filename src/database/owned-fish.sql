-- Goldfish: the fish each player owns, so their tank survives closing the app.
-- Run in Supabase > SQL Editor > New query > Run, after the profiles table SQL.
--
-- One row per fish a player owns. fish_id is the fish's id in the app's
-- catalog (src/frontend/data.ts, e.g. 'goldfish'), so adding new kinds of fish
-- needs no database change. Nobody can own the same fish twice, and buying
-- one saves the points spent (buy_fish), so they stay spent after a restart.
-- (This replaces the unused "Fish Tank" table, which can be deleted by hand.)
--
-- Everything runs in one transaction: if any step fails, nothing changes.

begin;

-- 1. Owned fish. in_tank says whether it's swimming in the tank right now.
create table public.owned_fish (
  owner_id    uuid not null default auth.uid() references public.profiles(uid) on delete cascade,
  fish_id     text not null check (fish_id ~ '^[a-z0-9-]{1,40}$'),
  in_tank     boolean not null default true,
  adopted_at  timestamptz not null default now(),
  primary key (owner_id, fish_id)   -- no duplicates
);

-- 2. Security rules: you can only see and change your own fish. There's no
--    rule for adding fish: the only way to get one is buy_fish() below, which
--    takes the points for it in the same step.
alter table public.owned_fish enable row level security;

create policy "see my fish" on public.owned_fish for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "move my fish in or out of the tank" on public.owned_fish for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "release my fish" on public.owned_fish for delete to authenticated
  using (owner_id = (select auth.uid()));

-- 3. The avatar is one of your own fish, or none. The link means it can't be
--    a fish you don't own, and it clears itself if that fish is ever removed.
alter table public.profiles add column avatar_fish_id text;
alter table public.profiles
  add constraint profiles_avatar_fish_fkey
  foreign key (uid, avatar_fish_id) references public.owned_fish (owner_id, fish_id)
  on delete set null (avatar_fish_id);

-- 4. Buy a fish: takes its price off your points and adds it to your tank, in
--    one step, so you never pay without getting the fish or get it for free,
--    and two quick clicks can't spend the same points twice. Returns your new
--    balance. The price comes from the app's catalog (src/frontend/data.ts).
--    The messages show up in the app.
create function public.buy_fish(fish text, price integer) returns double precision
language plpgsql security definer set search_path = '' as $$
declare
  balance double precision;
begin
  if auth.uid() is null then
    raise exception 'log in first';
  end if;
  if fish is null or fish !~ '^[a-z0-9-]{1,40}$' or price is null or price < 0 then
    raise exception 'that isn''t a fish you can buy';
  end if;
  if exists (select 1 from public.owned_fish where owner_id = auth.uid() and fish_id = fish) then
    raise exception 'you already have this fish';
  end if;
  -- Takes the points only if there are enough; the row lock makes this safe
  -- against two purchases at once.
  update public.profiles set points = points - price
   where uid = auth.uid() and points >= price
  returning points into balance;
  if not found then
    raise exception 'not enough points';
  end if;
  insert into public.owned_fish (owner_id, fish_id) values (auth.uid(), fish);
  return balance;
end;
$$;

revoke execute on function public.buy_fish(text, integer) from public, anon;
grant  execute on function public.buy_fish(text, integer) to authenticated;

commit;

-- Let the API see the new table and column right away.
notify pgrst, 'reload schema';
