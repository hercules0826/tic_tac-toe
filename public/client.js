'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const roomName = new URLSearchParams(location.search).get('room') || 'lobby';
  const savedName = sessionStorage.getItem('ttt-name') || '';

  let ws;
  let state = null;
  let you = null;
  let joinedName = null;

  const cells = [];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.setAttribute('aria-label', `Cell ${i + 1}`);
    cell.addEventListener('click', () => send({ type: 'move', cell: i }));
    $('board').appendChild(cell);
    cells.push(cell);
  }

  $('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('name-input').value.trim();
    if (!name) return;
    sessionStorage.setItem('ttt-name', name);
    joinedName = name;
    send({ type: 'join', name });
  });
  $('next-round').addEventListener('click', () => send({ type: 'next-round' }));
  $('new-match').addEventListener('click', () => send({ type: 'new-match' }));
  $('name-input').value = savedName;

  function send(message) {
    $('error').textContent = '';
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}/?room=${encodeURIComponent(roomName)}`);

    ws.addEventListener('open', () => {
      $('connection').textContent = 'online';
      $('connection').classList.add('online');
      // Reclaim a seat after a dropped connection.
      if (joinedName) send({ type: 'join', name: joinedName });
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'error') {
        $('error').textContent = msg.error;
        return;
      }
      if (msg.room) $('room-name').textContent = msg.room;
      state = msg.state;
      you = msg.you;
      render();
    });

    ws.addEventListener('close', () => {
      $('connection').textContent = 'reconnecting…';
      $('connection').classList.remove('online');
      you = null;
      setTimeout(connect, 1500);
    });
  }

  function nameOf(mark) {
    return state.players[mark] ? state.players[mark].name : null;
  }

  function statusText() {
    switch (state.phase) {
      case 'waiting':
        return you ? 'Waiting for an opponent to join…' : 'Waiting for players to join…';
      case 'playing':
        if (state.turn === you) return `Your turn (${you})`;
        return `${nameOf(state.turn)}'s turn (${state.turn})`;
      case 'round-over': {
        const r = state.roundResult;
        return r.draw
          ? `Round ${r.round} is a draw.`
          : `${r.winnerName} wins round ${r.round}!`;
      }
      case 'match-over':
        return `🏆 ${state.champion.name} (${state.champion.mark}) is the champion!`;
      default:
        return '';
    }
  }

  function render() {
    $('wins-needed').textContent = state.winsNeeded;
    $('join-form').hidden = Boolean(you) || (state.players.X && state.players.O);

    for (const mark of ['X', 'O']) {
      $(`name-${mark}`).textContent = nameOf(mark) || 'Waiting…';
      $(`score-${mark}`).textContent = state.scores[mark];
      $(`player-${mark}`).classList.toggle('active', state.phase === 'playing' && state.turn === mark);
      $(`player-${mark}`).classList.toggle('me', you === mark);
    }
    $('round').textContent = state.round;
    $('draws').textContent = state.scores.draws;

    const status = $('status');
    status.textContent = statusText();
    status.classList.toggle('champion', state.phase === 'match-over');

    const winLine = state.roundResult && state.roundResult.line ? state.roundResult.line : [];
    const myTurn = state.phase === 'playing' && state.turn === you;
    state.board.forEach((value, i) => {
      const cell = cells[i];
      cell.textContent = value || '';
      cell.className = 'cell';
      if (value) cell.classList.add(value.toLowerCase());
      if (winLine.includes(i)) cell.classList.add('win');
      const playable = myTurn && !value;
      if (playable) cell.classList.add('playable');
      cell.disabled = !playable;
    });

    $('next-round').hidden = !(you && state.phase === 'round-over');
    $('new-match').hidden = !(you && state.phase === 'match-over');

    $('history').innerHTML = '';
    for (const r of state.history) {
      const li = document.createElement('li');
      li.textContent = r.draw ? `Round ${r.round}: Draw` : `Round ${r.round}: ${r.winnerName} (${r.winner}) won`;
      $('history').appendChild(li);
    }
  }

  connect();
})();
