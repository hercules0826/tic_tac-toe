'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Match } = require('./match');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const MAX_NAME_LENGTH = 20;

/** room name -> { match, clients: Set<ws> } */
const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { match: new Match(), clients: new Set() });
  return rooms.get(name);
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(room) {
  const state = room.match.toJSON();
  for (const client of room.clients) {
    send(client, { type: 'state', state, you: room.match.markOf(client.id) });
  }
}

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

function cleanRoom(value) {
  return String(value || 'lobby').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'lobby';
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  ws.id = crypto.randomUUID();
  const roomName = cleanRoom(new URL(req.url, 'http://localhost').searchParams.get('room'));
  const room = getRoom(roomName);
  room.clients.add(ws);
  send(ws, { type: 'state', state: room.match.toJSON(), you: null, room: roomName });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const { match } = room;
    let result = { ok: true };

    switch (msg.type) {
      case 'join': {
        const name = cleanName(msg.name);
        if (!name) {
          result = { ok: false, error: 'Please enter a name.' };
        } else if (!match.join(ws.id, name)) {
          result = { ok: false, error: 'Both seats are taken. You are watching as a spectator.' };
        }
        break;
      }
      case 'move':
        result = match.move(ws.id, msg.cell);
        break;
      case 'next-round':
        result = match.nextRound(ws.id);
        break;
      case 'new-match':
        result = match.newMatch(ws.id);
        break;
      default:
        result = { ok: false, error: 'Unknown action.' };
    }

    if (!result.ok) send(ws, { type: 'error', error: result.error });
    else broadcast(room);
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    if (room.match.leave(ws.id)) {
      // A departing player forfeits the match in progress; start fresh for the next pair.
      room.match.reset();
      broadcast(room);
    }
    if (room.clients.size === 0) rooms.delete(roomName);
  });
});

server.listen(PORT, () => {
  console.log(`Tic-Tac-Toe Championship running at http://localhost:${PORT}`);
});
