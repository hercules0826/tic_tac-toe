# Tic-Tac-Toe Championship

Two players compete in a best-of-five tic-tac-toe match over a live,
synchronized board. The first player to win three rounds is crowned champion.

## Features

- Two named players, automatically assigned **X** and **O**
- Real-time 3 × 3 board synchronized over WebSockets
- Server-side validation: no moves into occupied cells, out of turn, or outside the board
- Win and draw detection
- Starting player alternates every round
- Round results, running match score, and champion announcement
- Start a new match without reconnecting
- Rooms: share a link (`?room=name`) to play a separate match; extra visitors watch as spectators

## Getting started

Requires Node.js 18+.

```bash
npm install
npm start
```

Open <http://localhost:3000> in two browser windows (or two devices on the same
network), enter a name in each, and play.

Set `PORT` to use a different port.

## Tests

```bash
npm test
```

## Project structure

```
src/match.js    Pure match/round rules (no I/O)
src/server.js   HTTP static server + WebSocket rooms
public/         Browser client
test/           Unit tests for the match rules (node:test)
```

## Rules notes

- Draws do not count toward the three wins; rounds continue until a player reaches three.
- X starts round 1, O starts round 2, and so on. Each new match starts with X.
- If a player disconnects, the match resets and their seat opens for the next person to join.
  A dropped connection automatically rejoins with the same name.
