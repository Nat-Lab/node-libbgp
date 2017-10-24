const bgparse = require('./bgparse').Parse,
      net = require('net');

// TODO

const server = net.createServer(socket => {
  socket.on('data', dat => {
    console.log(bgparse(dat));
  })
});

server.listen({
  host: '0.0.0.0',
  port: 179
});
