const BinParse = require('binary-parser').Parser;

var RawParser = {
  header: buf => new BinParse() // parse header
    .endianess('big')
    .uint16('length')
    .bit8('type')
    .parse(buf),
  open: buf => new BinParse() // parse OPEN message
    .endianess('big')
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
      type: new BinParse()
        .endianess('big')
        .bit8('type')
        .uint8('length')
        .buffer('vaule', {
          length: function() { return this.length; }
        }),
    })
    .parse(buf),
  update: function(buf) {
    var update_msg_len = buf.length;
    return new BinParse() // parse UPDATE message
      .endianess('big')
      .uint16('withdraw_routes_len')
      .array('withdraw_routes', {
        lengthInBytes: 'withdraw_routes_len',
        type: new BinParse()
          .endianess('big')
          .uint8('length')
          .buffer('prefix', { // TODO v4/v6 prefix parse
            length: function() { return this.length; }
          })
      })
      .uint16('total_path_attr_len')
      .array('path_attr', {
        lengthInBytes: 'total_path_attr_len',
        type: new BinParse()
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
              0: new BinParse().endianess('big').uint8(),
              1: new BinParse().endianess('big').uint16()
            }
          })
          .choice('value', {
            tag: function () {
              if (this.length == 0 && this.attr_type != 6) return 0;
              return this.attr_type;
            },
            choices: {
              0: new BinParse(), // length is 0, do nothing
              1: new BinParse().endianess('big').uint8('origin'),
              2: new BinParse().endianess('big')
                   .uint8('as_path_type')
                   .uint8('as_path_len')
                   .array('as_path', {
                     length: 'as_path_len',
                     type: new BinParse().endianess('big').uint16()
                   }),
              3: new BinParse().endianess('big')
                   .array('nexthop', {
                     type: 'uint8',
                     length: 4,
                      formatter: arr => arr.join('.')
                   }),
              4: new BinParse().endianess('big').uint32('med'),
              5: new BinParse().endianess('big').uint32('local_pref'),
              6: new BinParse(), // TODO ATOMIC_AGGREGATE
              7: new BinParse().endianess('big')
                   .uint16('aggregator_asn')
                   .array('aggregator', {
                     type: 'uint8',
                     length: 4,
                     formatter: arr => arr.join('.')
                   })
            },
            defaultChoice: new BinParse() // what?
          })
      })
      .array('nlri', {
        readUntil: 'eof',
        type: new BinParse().endianess('big')
                .uint8('length')
                .buffer('prefix', { // TODO v4/v6 prefix parse
                  length: function() { return this.length; }
                })
      })
      .parse(buf)
  }
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
    buf = buf.slice(16); // remove marker
    var header = buf.slice(0, 3);

    var header_parsed = RawParser.header(header),
        body_prased,
        type = header_parsed.type,
        msg_length = header_parsed.length - 19,
        data = buf.slice(3, msg_length + 3);

     buf = buf.slice(3 + msg_length); // move to next msg.

     switch (type) {
       case 1: {
         body_prased = RawParser.open(data);
         break;
       }
       case 2: {
         body_prased = RawParser.update(data);
         break;
       }
     };

     if (!body_prased || !header_parsed) {
       console.log(`[${Date.now()}] Got something I don't understand.`)
       return [];
     }

     msgs.push({header: header_parsed, body: body_prased});
  }

  return msgs;
};

module.exports = { Parse };
