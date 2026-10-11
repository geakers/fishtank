const { request } = require('./supabase');
const { currentUser } = require('./session');

// The fish each player owns, kept in the owned_fish table so the tank survives
// closing the app (see src/database/owned-fish.sql). Fish are identified by
// their id in the app's catalog, e.g. 'goldfish'.

// What a catalog id looks like; also keeps ids safe to put in a query.
const FISH_ID = /^[a-z0-9-]{1,40}$/;

function checkFishId(fishId) {
  if (typeof fishId !== 'string' || !FISH_ID.test(fishId)) throw new Error('A fish id is required');
}

function requireUser() {
  const user = currentUser();
  if (!user) throw new Error('Log in first');
  return user;
}

// Returns [{ fish_id, in_tank, adopted_at }] for the logged-in user's fish,
// oldest first.
async function listFish() {
  requireUser();
  return request('/rest/v1/owned_fish?select=fish_id,in_tank,adopted_at&order=adopted_at');
}

// Saves a newly bought fish, swimming in the tank. Owning it already is fine:
// nothing changes and it still resolves.
async function adoptFish(fishId) {
  checkFishId(fishId);
  requireUser();
  await request('/rest/v1/owned_fish?on_conflict=owner_id,fish_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: { fish_id: fishId },
  });
}

// Puts one of the logged-in user's fish in the tank or takes it out.
async function setFishInTank(fishId, inTank) {
  checkFishId(fishId);
  if (typeof inTank !== 'boolean') throw new Error('inTank must be true or false');
  requireUser();
  const updated = await request(`/rest/v1/owned_fish?fish_id=eq.${fishId}&select=fish_id`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: { in_tank: inTank },
  });
  if (!Array.isArray(updated) || updated.length !== 1) throw new Error("You don't own that fish.");
}

// Sets the logged-in user's avatar to one of their fish, or clears it (null).
// The database refuses a fish they don't own.
async function setAvatarFish(fishId) {
  if (fishId !== null) checkFishId(fishId);
  const user = requireUser();
  const updated = await request(`/rest/v1/profiles?uid=eq.${user.uid}&select=avatar_fish_id`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: { avatar_fish_id: fishId },
  });
  if (!Array.isArray(updated) || updated.length !== 1) throw new Error("Couldn't save your avatar.");
}

module.exports = { listFish, adoptFish, setFishInTank, setAvatarFish };
