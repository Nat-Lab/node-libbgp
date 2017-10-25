const bgparse = require('./bgparse').Parse,
      bgparser = require('./bgparse').Parsers,
      bgpbuild = require('./bgpbuild').Builders,
      net = require('net');

// A Test: A BGPd use AS65000, accept any peer with any AS and print received message.

var bgpd = net.createServer(socket => {
  var messages = Buffer.alloc(0);

  socket.on('data', dat => {
    messages = Buffer.concat([messages, dat]);
    var msg_header = bgparser.header(messages),
        msg_len = msg_header.length;

    if (messages.length < msg_len) return 0; // messages incomplete, wait.

    var parsed_message = bgparse(messages.slice(0, msg_len));
    messages = messages.slice(msg_len); // move to next message.

    console.log(JSON.stringify(parsed_message));

    if (msg_header.type == 1) { // received OPEN
      socket.write(new bgpbuild.message.open({my_asn: 65000, hold_time: 180, bgp_id: '172.17.0.243'})) // reply OPEN
      socket.write(new bgpbuild.message.keepalive()); // reply KEEPALIVE
      setInterval(() => socket.write(new bgpbuild.message.keepalive()), 59000); // send keepalive every 59 sec.
    }
  })

});

bgpd.listen({ host: '0.0.0.0', port: 179 });
