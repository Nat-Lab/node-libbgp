const { Builders, StreamParser } = require('../src/libbgp') || require('libbgp');
const net = require('net');

// UPDATE example.

var bgpd = net.createServer(socket => {
  var bgp_stream = new StreamParser();

  socket.pipe(bgp_stream).on('data', data => {
    console.log(JSON.stringify(data));
    if (data.header.type == 1) { // got OPEN
      socket.write(new Builders.message.open(
        {my_asn: 65000, hold_time: 180, bgp_id: '172.17.0.243'}
      )); // reply OPEN
      socket.write(new Builders.message.keepalive()); // send KEEPALIVE

      socket.write(new Builders.message.update({
        withdraw_routes: new Builders.component.withdraw_routes([]), // nothing to withdraw
        path_attr: new Builders.component.path_attrs([
          new Builders.component.path_attr.origin(2), // origin: INCOMPLETE
          new Builders.component.path_attr.as_path([65200, 65100]), // as_path
          new Builders.component.path_attr.nexthtop('172.17.0.239') // nexthop
        ]),
        nlri: new Builders.component.prefixes(['172.16.0.0/12', '10.35.0.0/22'])
      }));

      setInterval(() => socket.write(new Builders.message.keepalive()), 59000); // send keepalive every 59 sec.
    }
  });
});

bgpd.listen({ host: '0.0.0.0', port: 179 });
