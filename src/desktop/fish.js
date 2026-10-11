const { request, rpc } = require('./supabase');
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

// Buys a fish for the logged-in user: takes the price off their saved points
// and adds the fish to their tank in one step (buy_fish in the database).
// Resolves with their new balance. Rejects with Supabase's reason, e.g. "not
// enough points" or "you already have this fish", and then nothing changes.
async function buyFish(fishId, price) {
  checkFishId(fishId);
  if (!Number.isInteger(price) || price < 0) throw new Error('A price is required');
  requireUser();
  return rpc('buy_fish', { fish: fishId, price });
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

module.exports = { listFish, buyFish, setFishInTank, setAvatarFish };
