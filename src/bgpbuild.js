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

      open_fields.writeUInt16BE(open_fields.length, 16); // length
      return open_fields;
    },
    update: function ({withdraw_routes, path_attr, nlri}) {
      header.writeUInt8(2, 18); // Type: UPDATE

      var fields = Buffer.concat([
        header,
        withdraw_routes,
        path_attr,
        nlri
      ]);

      fields.writeUInt16BE(fields.length, 16); // length
      return fields;
    },
    keepalive: function() {
      header.writeUInt8(19, 17); // length: 19
      header.writeUInt8(4, 18); // Type: KEEPALIVE
      return header;
    }
  };

  var path_header = function ({optional = 0, trans = 0, partial = 0, extended = 0, type}) {
    var buf = Buffer.alloc(2);
    buf.writeUInt8(parseInt('' + optional + trans + partial + extended + '0000', 2));
    buf.writeUInt8(type, 1);
    return buf;
  };

  /* Message Components */
  var component = {
    open_param: function() {

    },
    withdraw_routes: function (prefixes) {
      var buf = Buffer.alloc(0);
      prefixes.forEach(prefix => {
        var length = Number.parseInt(prefix.split('/')[1]),
            _prefix = prefix.split('/')[0];

        var bytes = Math.ceil(length / 8);
        buf = Buffer.concat([
          buf,
          Buffer.alloc(1, length),
          Uint8Array.from(_prefix.split('.').slice(0, bytes).map(n => Number.parseInt(n)))
        ]);
      });

      var withdraw_len = Buffer.alloc(2);
      withdraw_len.writeUInt16BE(buf.length);

      return Buffer.concat([
        withdraw_len,
        buf
      ]);
    },
    path_attrs: function (attrs) {
      var buf = Buffer.alloc(0);
      attrs.forEach(attr => {
        buf = Buffer.concat([buf, attr]);
      });
      var attrs_len = Buffer.alloc(2);
      attrs_len.writeUInt16BE(buf.length);

      return Buffer.concat([attrs_len, buf]);
    },
    path_attr: {
      header: path_header,
      origin: function (origin) {
        return Buffer.concat([
          path_header({trans: 1, type: 1}),
          Buffer.alloc(1, 1), // length = 1
          Buffer.alloc(1, origin)
        ]);
      },
      as_path: function (as_path, is_4b) { // TODO 4b ASN
        var asn_seq = Buffer.alloc(0);
        as_path.forEach(as => {
          var as_buf = Buffer.alloc(2); // TODO 4b
          as_buf.writeUInt16BE(as);
          asn_seq = Buffer.concat([asn_seq, as_buf]);
        });

        var seq_buf = Buffer.concat([
          Buffer.alloc(1, 2), // AS_SEQUENCE
          Buffer.alloc(1, as_path.length), // # of ASNs in path
          asn_seq
        ]);

        return Buffer.concat([
          path_header({trans: 1, type: 2}),
          Buffer.alloc(1, seq_buf.length),
          seq_buf
        ]);
      },
      nexthtop: function (nexthop) {
        return Buffer.concat([
          path_header({trans: 1, type: 3}),
          Buffer.alloc(1, 4), // length = 4
          Buffer.from(Uint8Array.from(nexthop.split('.').map(n => Number.parseInt(n))))
        ])
      },
      med: function (med) {
        var med_buf = Buffer.alloc(4);
        med_buf.writeUInt32BE(med);

        return Buffer.concat([
          path_header({optional: 1, type: 4}),
          Buffer.alloc(1, 4), // length always 4
          med_buf
        ])
      },
      local_pref: function (local_pref) {
        var lp_buf = Buffer.alloc(4);
        lp_buf.writeUInt32BE(local_pref);

        return Buffer.concat([
          path_header({optional: 1, type: 5}),
          Buffer.alloc(1, 4), // length always 4
          lp_buf
        ])
      },
      automic_aggregate: function () {
        return Buffer.concat([
          path_header({optional: 1, type: 6}),
          Buffer.alloc(1, 0)
        ]);
      },
      aggregator: function ({asn, addr}) {
        var aggr_buf = Buffer.alloc(2);
        aggr_buf.writeUInt16BE(asn);
        return Buffer.concat([
          path_header({trans: 1, type: 7}),
          Buffer.alloc(1, 6),
          aggr_buf,
          Buffer.from(Uint8Array.from(addr.split('.').map(n => Number.parseInt(n))))
        ]);
      }
    },
    prefixes: function (prefixes) {
      var buf = Buffer.alloc(0);
      prefixes.forEach(prefix => {
        var length = Number.parseInt(prefix.split('/')[1]),
            _prefix = prefix.split('/')[0];

        var bytes = Math.ceil(length / 8);
        buf = Buffer.concat([
          buf,
          Buffer.alloc(1, length),
          Uint8Array.from(_prefix.split('.').slice(0, bytes).map(n => Number.parseInt(n)))
        ]);
      });
      return buf;
    }
  }

  return { message, component };
})();

module.exports = { Builders };
