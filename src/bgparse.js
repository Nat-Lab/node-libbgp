const BinaryParse = require('binary-parser').Parser;

var Parsers = {
  header: buf => new BinaryParse().endianess('big') // parse header
    .uint16('length')
    .bit8('type')
    .parse(buf),
  open: buf => new BinaryParse().endianess('big') // parse OPEN message
    .uint8('version')
    .uint16('my_asn')
    .uint16('hold_time')
    .array('bgp_id', {
      type: 'uint8',
      length: 4,
      formatter: arr => arr.join('.')
    })
    .uint8('param_len')
    .array('param', {
      lengthInBytes: 'param_len',
      type: new BinaryParse()
        .endianess('big')
        .bit8('type')
        .uint8('length')
        .buffer('vaule', {
          length: function() { return this.length; }
        }),
    })
    .parse(buf),
  update: buf => new BinaryParse().endianess('big') // parse UPDATE message
    .uint16('withdraw_routes_len')
    .array('withdraw_routes', {
      lengthInBytes: 'withdraw_routes_len',
      type: new BinaryParse()
        .endianess('big')
        .uint8('length')
        .choice('prefix', {
          tag: function () { return Math.ceil(this.length / 8) * 8 },
          choices: {
            0: new BinaryParse(),
            8: new BinaryParse().endianess('big').array('', {
              type: 'uint8',
              length: 1
            }),
            16: new BinaryParse().endianess('big').array('', {
              type: 'uint8',
              length: 2
            }),
            24: new BinaryParse().endianess('big').array('', {
              type: 'uint8',
              length: 3
            }),
            32: new BinaryParse().endianess('big').array('', {
              type: 'uint8',
              length: 4
            })
          }
        })
    })
    .uint16('total_path_attr_len')
    .array('path_attr', {
      lengthInBytes: 'total_path_attr_len',
      type: new BinaryParse()
        .endianess('big')
        .bit1('is_optional')
        .bit1('is_transitive')
        .bit1('is_partial')
        .bit1('is_extened')
        .bit4('reserved')
        .uint8('attr_type')
        .choice('length', {
          tag: 'is_extened',
          choices: { // if extend, length attr has 2 octets.
            0: new BinaryParse().endianess('big').uint8(),
            1: new BinaryParse().endianess('big').uint16()
          }
        })
        .choice('value', {
          tag: function () {
            if (this.length == 0 && this.attr_type != 6) return 0;
            return this.attr_type;
          },
          choices: {
            0: new BinaryParse(), // length is 0, do nothing
            1: new BinaryParse().endianess('big').uint8('origin'),
            2: new BinaryParse().endianess('big')
                 .uint8('as_path_type')
                 .uint8('as_path_len')
                 .array('as_path', {
                   length: 'as_path_len',
                   type: new BinaryParse().endianess('big').uint16()
                 }),
            3: new BinaryParse().endianess('big')
                 .array('nexthop', {
                   type: 'uint8',
                   length: 4,
                    formatter: arr => arr.join('.')
                 }),
            4: new BinaryParse().endianess('big').uint32('med'),
            5: new BinaryParse().endianess('big').uint32('local_pref'),
            6: new BinaryParse(), // TODO ATOMIC_AGGREGATE
            7: new BinaryParse().endianess('big')
                 .uint16('aggregator_asn')
                 .array('aggregator', {
                   type: 'uint8',
                   length: 4,
                   formatter: arr => arr.join('.')
                 })
          },
          defaultChoice: new BinaryParse() // what?
        })
    })
    .array('nlri', {
      readUntil: 'eof',
      type: new BinaryParse().endianess('big')
              .uint8('length')
              .choice('prefix', {
                tag: function () { return Math.ceil(this.length / 8) * 8 },
                choices: {
                  0: new BinaryParse(),
                  8: new BinaryParse().endianess('big').array('', {
                    type: 'uint8',
                    length: 1
                  }),
                  16: new BinaryParse().endianess('big').array('', {
                    type: 'uint8',
                    length: 2
                  }),
                  24: new BinaryParse().endianess('big').array('', {
                    type: 'uint8',
                    length: 3
                  }),
                  32: new BinaryParse().endianess('big').array('', {
                    type: 'uint8',
                    length: 4
                  })
                }
              })
    })
    .parse(buf)
};

/**
 * Prase BGP messages
 * @constructor
 * @param {Buffer} buf - The raw buffer received from tcp server.
 * @return {Objects[]} prased messages
 */
var Parse = function (buf) {
  if (buf.length < 19) {
    console.log(`[${Date.now()}] Got funny thing (buffer length < 19).`)
    return [];
  }

  var msgs = [];

  while (buf.length > 0) {
    var ParsersList = [Parsers.header, Parsers.open, Parsers.update];

    buf = buf.slice(16); // remove marker
    var header = buf.slice(0, 3);

    var header_parsed = ParsersList[0](header),
        body_prased,
        type = header_parsed.type,
        msg_length = header_parsed.length - 16, // msg_len (w/o marker, w/ header)
        data = buf.slice(3, msg_length);

     buf = buf.slice(msg_length); // move to next msg.

     body_prased = ParsersList[type](data);

     if (!body_prased || !header_parsed) {
       console.log(`[${Date.now()}] Got something I don't understand.`)
       return [];
     }

     msgs.push({header: header_parsed, body: body_prased});
  }

  return msgs;
};

module.exports = { Parse };
