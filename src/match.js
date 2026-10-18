'use strict';

const WINS_NEEDED = 3;
const MARKS = ['X', 'O'];
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** Returns { winner, line } for a finished board, { draw: true } for a full board, or null. */
function evaluateBoard(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every(Boolean)) return { draw: true };
  return null;
}

function other(mark) {
  return mark === 'X' ? 'O' : 'X';
}

/**
 * A best-of-five championship between two players.
 * Players are identified by an opaque id (e.g. a connection id).
 */
class Match {
  constructor() {
    this.players = { X: null, O: null };
    this.reset();
  }

  reset() {
    this.scores = { X: 0, O: 0, draws: 0 };
    this.round = 1;
    this.starter = 'X';
    this.history = [];
    this.champion = null;
    this.startRound();
  }

  startRound() {
    this.board = Array(9).fill(null);
    this.turn = this.starter;
    this.roundResult = null;
  }

  /** Seats a player in the first free slot. Returns the assigned mark or null if full. */
  join(id, name) {
    const existing = this.markOf(id);
    if (existing) return existing;
    const mark = MARKS.find((m) => !this.players[m]);
    if (!mark) return null;
    this.players[mark] = { id, name };
    return mark;
  }

  leave(id) {
    const mark = this.markOf(id);
    if (mark) this.players[mark] = null;
    return mark;
  }

  markOf(id) {
    return MARKS.find((m) => this.players[m] && this.players[m].id === id) || null;
  }

  get ready() {
    return Boolean(this.players.X && this.players.O);
  }

  get phase() {
    if (!this.ready) return 'waiting';
    if (this.champion) return 'match-over';
    if (this.roundResult) return 'round-over';
    return 'playing';
  }

  /** Applies a move. Returns { ok: true } or { ok: false, error }. */
  move(id, cell) {
    const mark = this.markOf(id);
    if (!mark) return { ok: false, error: 'You are not a player in this match.' };
    if (this.phase !== 'playing') return { ok: false, error: 'The round is not in progress.' };
    if (mark !== this.turn) return { ok: false, error: 'It is not your turn.' };
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
      return { ok: false, error: 'That cell is outside the board.' };
    }
    if (this.board[cell]) return { ok: false, error: 'That cell is already taken.' };

    this.board[cell] = mark;
    const outcome = evaluateBoard(this.board);
    if (!outcome) {
      this.turn = other(mark);
      return { ok: true };
    }

    this.turn = null;
    if (outcome.draw) {
      this.scores.draws += 1;
      this.roundResult = { round: this.round, draw: true };
    } else {
      this.scores[outcome.winner] += 1;
      this.roundResult = {
        round: this.round,
        winner: outcome.winner,
        winnerName: this.players[outcome.winner].name,
        line: outcome.line,
      };
      if (this.scores[outcome.winner] >= WINS_NEEDED) {
        this.champion = { mark: outcome.winner, name: this.players[outcome.winner].name };
      }
    }
    this.history.push(this.roundResult);
    return { ok: true };
  }

  nextRound(id) {
    if (!this.markOf(id)) return { ok: false, error: 'You are not a player in this match.' };
    if (this.phase !== 'round-over') return { ok: false, error: 'The current round is not finished.' };
    this.round += 1;
    this.starter = other(this.starter);
    this.startRound();
    return { ok: true };
  }

  newMatch(id) {
    if (!this.markOf(id)) return { ok: false, error: 'You are not a player in this match.' };
    this.reset();
    return { ok: true };
  }

  toJSON() {
    const publicPlayer = (p) => (p ? { name: p.name } : null);
    return {
      phase: this.phase,
      players: { X: publicPlayer(this.players.X), O: publicPlayer(this.players.O) },
      board: this.board,
      turn: this.turn,
      round: this.round,
      starter: this.starter,
      scores: this.scores,
      roundResult: this.roundResult,
      history: this.history,
      champion: this.champion,
      winsNeeded: WINS_NEEDED,
    };
  }
}

module.exports = { Match, evaluateBoard, WINS_NEEDED };
