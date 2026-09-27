import WebSocket from 'ws';

const [url, token] = process.argv.slice(2);
if (!url || !token) {
  console.error('Usage: node scripts/ws-smoke.mjs <ws-url> <access-token>');
  process.exit(1);
}

const socket = new WebSocket(url);
const timeout = setTimeout(() => {
  console.error('WebSocket test timed out');
  socket.terminate();
  process.exit(1);
}, 8_000);

socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', token })));
socket.on('message', (raw) => {
  const event = JSON.parse(raw.toString());
  if (event.type === 'authenticated') {
    socket.send(JSON.stringify({ type: 'message', content: 'Mensaje de validación WebSocket' }));
  }
  if (event.type === 'message') {
    console.log(JSON.stringify({ type: event.type, content: event.data.content }));
    clearTimeout(timeout);
    socket.close();
  }
});
socket.on('error', (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  process.exit(1);
});
