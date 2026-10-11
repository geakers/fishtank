const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TEST_POINT_PER_SECOND,
  POINTS_PER_MINUTE,
  MIN_COMMIT_MINUTES,
  MAX_COMMIT_MINUTES,
  isValidCommitment,
  sessionEarnings,
} = require('../src/desktop/profiles');

// What a finished session of this many committed minutes should earn.
function fullEarnings(minutes) {
  return TEST_POINT_PER_SECOND ? minutes * 60 : minutes * POINTS_PER_MINUTE;
}

test('a commitment is a whole number of minutes in range', () => {
  assert.equal(isValidCommitment(MIN_COMMIT_MINUTES), true);
  assert.equal(isValidCommitment(25), true);
  assert.equal(isValidCommitment(MAX_COMMIT_MINUTES), true);
  assert.equal(isValidCommitment(0), false);
  assert.equal(isValidCommitment(MAX_COMMIT_MINUTES + 1), false);
  assert.equal(isValidCommitment(2.5), false);
  assert.equal(isValidCommitment('25'), false);
  assert.equal(isValidCommitment(null), false);
});

test('a session that lasts its commitment earns points for the time committed', () => {
  assert.deepEqual(sessionEarnings(25 * 60, 25), { completed: true, minutes: 25, pointsEarned: fullEarnings(25) });
});

test('running past the commitment earns no more than the commitment', () => {
  assert.deepEqual(sessionEarnings(40 * 60, 25), { completed: true, minutes: 25, pointsEarned: fullEarnings(25) });
});

test('a session a second or two short of its commitment still counts as finished', () => {
  assert.equal(sessionEarnings(25 * 60 - 2, 25).completed, true);
  assert.equal(sessionEarnings(25 * 60 - 3, 25).completed, false);
});

test('ending early keeps the minutes studied but earns no points', () => {
  const early = sessionEarnings(10 * 60, 25);
  assert.equal(early.completed, false);
  assert.equal(early.minutes, 10);
  assert.equal(early.pointsEarned, 0);
});

test('a session with no valid commitment never earns points', () => {
  for (const commitment of [null, undefined, 0, 999]) {
    const result = sessionEarnings(30 * 60, commitment);
    assert.equal(result.completed, false);
    assert.equal(result.pointsEarned, 0);
  }
});

test('a session that never ran adds nothing', () => {
  assert.deepEqual(sessionEarnings(0, 25), { completed: false, minutes: 0, pointsEarned: 0 });
});
