const BinaryParse = require('binary-parser').Parser,
      through2 = require('through2');

var Parsers = {
  header: buf => new BinaryParse().endianess('big') // parse header
    .skip(16)
    .uint16('length')
    .bit8('type')
    .parse(buf),
  open: buf => new BinaryParse().endianess('big') // parse OPEN message
    .skip(19)
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
    .skip(19)
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
              length: 1,
              formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
            }),
            16: new BinaryParse().endianess('big').array('', {
              type: 'uint8',
              length: 2,
              formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
            }),
            24: new BinaryParse().endianess('big').array('', {
              type: 'uint8',
              length: 3,
              formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
            }),
            32: new BinaryParse().endianess('big').array('', {
              type: 'uint8',
              length: 4,
              formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
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
        .choice('', {
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
                    length: 1,
                    formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
                  }),
                  16: new BinaryParse().endianess('big').array('', {
                    type: 'uint8',
                    length: 2,
                    formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
                  }),
                  24: new BinaryParse().endianess('big').array('', {
                    type: 'uint8',
                    length: 3,
                    formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
                  }),
                  32: new BinaryParse().endianess('big').array('', {
                    type: 'uint8',
                    length: 4,
                    formatter: arr => arr.concat([0, 0, 0]).slice(0, 4).join('.')
                  })
                }
              })
    })
    .parse(buf)
};

/**
 * Prase BGP messages
 * @constructor
 * @param {Buffer} buf - The raw message buffer received.
 * @return {Objects} prased messages
 */
var Parse = function (buf) {
  if (buf.length < 19) {
    console.log(`[${Date.now()}] Got funny thing (buffer length < 19).`)
    return [];
  }

  var ParsersList = [
    Parsers.header,
    Parsers.open, // Type 1: OPEN
    Parsers.update, // Type 2: UPDATE
    console.log, // Type 3: NOTIFY TODO
    Parsers.header // Type 4: KEEPALIVE
  ];

  var header = ParsersList[0](buf.slice(0, 19));
  var data = ParsersList[header.type](buf.slice(0, header.length));

  return {header, data};
};

var StreamParser = function () {
  var messages = Buffer.alloc(0);

  var stream = through2({ objectMode: true }, function(chunk, enc, next) {
    messages = Buffer.concat([messages, chunk]);
    var msg_header = Parsers.header(messages),
        msg_len = msg_header.length;

    if (messages.length >= msg_len) {
      stream.push(Parse(messages.slice(0, msg_len)))
      messages = messages.slice(msg_len);
    }

    next();
  });

  return stream;
}

module.exports = { Parse, Parsers, StreamParser };
