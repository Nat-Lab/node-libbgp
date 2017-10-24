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


var Parse = function (buf) {
  var header = buf.slice(16, 19),
      data = buf.slice(19);

  var header_parsed = RawParser.header(header),
      type = header_parsed.type;

   switch (type) {
     case 1: {
       body_prased = RawParser.open(data);
       break;
     }
   };

   return {header: header_parsed, body: body_prased};
};
