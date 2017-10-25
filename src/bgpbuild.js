var Builders = (function () {

  var header = Buffer.concat([
    Buffer.alloc(16, 0xff), // marker
    Buffer.alloc(3) // length & type field
  ]);

  /* BGP Messages */
  var message = {
    open: function({my_asn, hold_time, bgp_id, param}) {
      header.writeUInt8(1, 18); // Type: OPEN

      var open_fields = Buffer.alloc(5);
      open_fields.writeUInt8(4); // BGPv4
      open_fields.writeUInt16BE(my_asn, 1); // my_asn
      open_fields.writeUInt16BE(hold_time, 3); // hold_timer

      open_fields = Buffer.concat([
        header,
        open_fields,
        Buffer.from(Uint8Array.from(bgp_id.split('.').map(n => Number.parseInt(n)))),
        Buffer.alloc(1) // TODO param
      ]);

      open_fields.writeUInt16BE(open_fields.length, 16);
      return open_fields;
    },
    update: function ({withdraw_routes, path_attr, nlri}) {

    },
    keepalive: function() {
      header.writeUInt8(19, 17); // length: 19
      header.writeUInt8(4, 18); // Type: KEEPALIVE
      return header;
    }
  };

  /* Message Components */
  var component = {
    open_param: function() {

    },
    withdraw_routes: function () {

    },
    path_attr: function () {

    },
    nlri: function () {

    }
  }

  return { message, component };
})();

module.exports = { Builders };
