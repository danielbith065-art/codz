import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const root = process.cwd();
const port = Number(process.env.PORT || 4174);
const rooms = new Map();
const clients = new Map();
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filename = resolve(root, `.${requested}`);
  if (filename !== root && !filename.startsWith(root + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (!statSync(filename).isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    createReadStream(filename).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/lan') {
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, client => webSocketServer.emit('connection', client, request));
});

function send(client, message) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
}

function removeFromRoom(client) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;
  room.clients.delete(client.id);
  if (client.id === room.hostId) {
    for (const peerId of room.clients) {
      const peer = clients.get(peerId);
      if (peer) {
        send(peer.socket, { type: 'roomClosed' });
        peer.roomCode = null;
      }
    }
    rooms.delete(client.roomCode);
  } else {
    const host = clients.get(room.hostId);
    if (host) send(host.socket, { type: 'peerLeft', peerId: client.id });
    if (!room.clients.size) rooms.delete(client.roomCode);
  }
  client.roomCode = null;
}

webSocketServer.on('connection', socket => {
  const client = { id: randomBytes(6).toString('hex'), socket, roomCode: null, role: null };
  clients.set(client.id, client);

  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'create') {
      removeFromRoom(client);
      let code;
      do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
      const room = { code, hostId: client.id, clients: new Set([client.id]) };
      rooms.set(code, room);
      client.roomCode = code;
      client.role = 'host';
      send(socket, { type: 'created', roomCode: code, peerId: client.id });
      return;
    }

    if (message.type === 'join') {
      removeFromRoom(client);
      const code = String(message.roomCode || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) { send(socket, { type: 'error', message: 'Room not found. Check the code and server address.' }); return; }
      if (room.clients.size >= 4) { send(socket, { type: 'error', message: 'Room is full (4 players maximum).' }); return; }
      client.roomCode = code;
      client.role = 'guest';
      room.clients.add(client.id);
      const host = clients.get(room.hostId);
      send(socket, { type: 'joined', roomCode: code, peerId: client.id, hostId: room.hostId });
      if (host) send(host.socket, { type: 'peerJoined', peerId: client.id });
      return;
    }

    const room = rooms.get(client.roomCode);
    if (!room || !room.clients.has(client.id)) return;
    if (message.type === 'state' && client.id !== room.hostId) return;
    if (!['state', 'pose', 'shot', 'interact', 'launch', 'map'].includes(message.type)) return;
    if (message.type === 'launch' && client.id !== room.hostId) return;

    for (const peerId of room.clients) {
      if (peerId === client.id) continue;
      const peer = clients.get(peerId);
      if (peer) send(peer.socket, { ...message, from: client.id });
    }
  });

  socket.on('close', () => {
    removeFromRoom(client);
    clients.delete(client.id);
  });
  socket.on('error', () => {});
});

server.listen(port, '0.0.0.0', () => {
  console.log(`LAST LIGHT server listening on http://0.0.0.0:${port}`);
});
