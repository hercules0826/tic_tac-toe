'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Match, evaluateBoard } = require('../src/match');

function setup() {
  const match = new Match();
  assert.equal(match.join('a', 'Alice'), 'X');
  assert.equal(match.join('b', 'Bob'), 'O');
  return match;
}

/** Plays a sequence of cells, alternating whoever's turn it is. */
function play(match, cells) {
  for (const cell of cells) {
    const id = match.players[match.turn].id;
    assert.deepEqual(match.move(id, cell), { ok: true });
  }
}

// Starter takes the top row; opponent plays the middle row.
const STARTER_WINS = [0, 3, 1, 4, 2];
const DRAW = [0, 1, 2, 4, 3, 5, 7, 6, 8];

test('evaluateBoard detects wins, draws, and in-progress boards', () => {
  assert.deepEqual(evaluateBoard(['X', 'X', 'X', null, null, null, null, null, null]), { winner: 'X', line: [0, 1, 2] });
  assert.deepEqual(evaluateBoard(['O', null, null, null, 'O', null, null, null, 'O']), { winner: 'O', line: [0, 4, 8] });
  assert.deepEqual(evaluateBoard(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']), { draw: true });
  assert.equal(evaluateBoard(Array(9).fill(null)), null);
});

test('assigns X and O to the first two players and rejects a third', () => {
  const match = setup();
  assert.equal(match.join('c', 'Carol'), null);
  assert.equal(match.phase, 'playing');
});

test('waits until both players have joined', () => {
  const match = new Match();
  match.join('a', 'Alice');
  assert.equal(match.phase, 'waiting');
  assert.equal(match.move('a', 0).ok, false);
});

test('rejects moves out of turn, into occupied cells, outside the board, and by non-players', () => {
  const match = setup();
  assert.match(match.move('b', 0).error, /not your turn/);
  assert.equal(match.move('a', 4).ok, true);
  assert.match(match.move('b', 4).error, /already taken/);
  assert.match(match.move('b', 9).error, /outside/);
  assert.match(match.move('b', -1).error, /outside/);
  assert.match(match.move('b', '1').error, /outside/);
  assert.match(match.move('z', 0).error, /not a player/);
});

test('records a round win and blocks further moves until the next round', () => {
  const match = setup();
  play(match, STARTER_WINS);
  assert.equal(match.phase, 'round-over');
  assert.deepEqual(match.scores, { X: 1, O: 0, draws: 0 });
  assert.equal(match.roundResult.winnerName, 'Alice');
  assert.deepEqual(match.roundResult.line, [0, 1, 2]);
  assert.equal(match.move('b', 8).ok, false);
});

test('records a draw', () => {
  const match = setup();
  play(match, DRAW);
  assert.equal(match.phase, 'round-over');
  assert.deepEqual(match.roundResult, { round: 1, draw: true });
  assert.deepEqual(match.scores, { X: 0, O: 0, draws: 1 });
});

test('alternates the starting player each round', () => {
  const match = setup();
  const starters = [];
  for (let i = 0; i < 4; i++) {
    starters.push(match.turn);
    play(match, DRAW);
    match.nextRound('a');
  }
  assert.deepEqual(starters, ['X', 'O', 'X', 'O']);
});

test('next round is only allowed once the current round is finished', () => {
  const match = setup();
  assert.equal(match.nextRound('a').ok, false);
});

test('first player to three round wins is champion, then a new match resets scores', () => {
  const match = setup();
  // X starts and wins rounds 1, 3, 5; O starts and wins rounds 2, 4.
  for (let round = 1; round <= 5; round++) {
    play(match, STARTER_WINS);
    if (round < 5) {
      assert.equal(match.champion, null);
      match.nextRound('b');
    }
  }
  assert.deepEqual(match.scores, { X: 3, O: 2, draws: 0 });
  assert.equal(match.phase, 'match-over');
  assert.deepEqual(match.champion, { mark: 'X', name: 'Alice' });
  assert.equal(match.nextRound('a').ok, false);
  assert.equal(match.history.length, 5);

  assert.equal(match.newMatch('b').ok, true);
  assert.equal(match.phase, 'playing');
  assert.deepEqual(match.scores, { X: 0, O: 0, draws: 0 });
  assert.equal(match.round, 1);
  assert.equal(match.turn, 'X');
  assert.equal(match.history.length, 0);
  assert.equal(match.players.X.name, 'Alice');
});

test('a player leaving frees their seat', () => {
  const match = setup();
  assert.equal(match.leave('a'), 'X');
  assert.equal(match.phase, 'waiting');
  assert.equal(match.join('c', 'Carol'), 'X');
});
