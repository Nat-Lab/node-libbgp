const BinParse = require('binary-parser').Parser;

var RawParser = {
  header: function (buf) {
    return new BinParse()
      .endianess('big')
      .uint16('length')
      .bit8('type')
      .parse(buf);
    },
    open: function (buf) {
      var param = buf.slice(10);

      var body_prased = new BinParse()
        .endianess('big')
        .uint8('version')
        .uint16('my_asn')
        .uint16('hold_time')
        .array('bgp_id', {type: 'uint8', length: 4})
        .uint8('param_len')
        .parse(buf);

      var param_len = body_prased.param_len;

      var arr_param = [];

      while (param.length > 0) {
        var this_param = new BinParse()
          .endianess('big')
          .bit8('type')
          .uint8('length')
          .parse(param);

        param = param.slice(2);
        this_param.value = param.slice(0, this_param.length);
        param = param.slice(this_param.length);
        arr_param.push(this_param);
      };

      return Object.assign(body_prased, {param: arr_param});
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
