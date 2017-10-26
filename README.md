node-libbgp
---

node-libbgp is a simple BGPv4 (Border Gateway Protocol) library for Node.js. It is still under development.

Example usage:

```Javascript
const { Builders, StreamParser } = require('libbgp');
const net = require('net');

// Examples: A BGPd use AS65000, accept peer with any AS and print received message.

var bgpd = net.createServer(socket => {
  var bgp_stream = new StreamParser();
  socket.pipe(bgp_stream).on('data', data => {
    console.log(data);
    if (data.header.type == 1) { // got OPEN
      socket.write(new Builders.message.open(
        {my_asn: 65000, hold_time: 180, bgp_id: '172.17.0.243'}
      )); // reply OPEN
      socket.write(new Builders.message.keepalive()); // send KEEPALIVE
      setInterval(() => socket.write(new Builders.message.keepalive()), 59000); // send KEEPALIVE every 59 sec.
    }
  });
});

bgpd.listen({ host: '0.0.0.0', port: 179 });
```
