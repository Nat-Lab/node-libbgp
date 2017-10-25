const BinParse = require('binary-parser').Parser;

var RawParser = {
  header: buf => new BinParse() // parse header
    .endianess('big')
    .uint16('length')
    .bit8('type')
    .parse(buf)
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
  update: function (buf) { // parse UPDATE message

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
    var header = buf.slice(0, 3),
        data = buf.slice(3);

    var header_parsed = RawParser.header(header),
        body_prased,
        type = header_parsed.type,
        msg_length = header_parsed.length - 19;

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
