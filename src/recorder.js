var fs = require('fs');
var sepiaUtil = require('./util');

['http', 'https'].forEach(function(protocol) {
  var protocolModule = require(protocol);

  var oldRequest = protocolModule.request;
  protocolModule.request = function(options, callback) {
    var reqUrl = sepiaUtil.urlFromHttpRequestOptions(options, protocol);
    var reqBody = '';

    var req = oldRequest(options, function(res) {
      var filename = sepiaUtil.constructFilename(reqUrl, reqBody,
        options.headers);

      // It's important that we don't respect the encoding set by application
      // because we want to treat the incoming data as a buffer. When body data
      // is treated as a string, there are issues writing it to a file. With
      // non-ASCII messages, the string's length (in characters) is not
      // necessarily the same as the buffer's length (in bytes). Thus, the
      // solution is to treat the data as a buffer without allowing conversion
      // into a string.
      res.setEncoding = function() {};

      var resBodyChunks = [];
      res.on('data', function(chunk) {
        resBodyChunks.push(chunk);
      });

      res.on('end', function() {
        var resBody = Buffer.concat(resBodyChunks);

        var fd = fs.openSync(filename, 'w');
        fs.writeSync(fd, resBody, 0, resBody.length, null);
        fs.closeSync(fd);

        var headersfd = fs.openSync(filename + '.headers', 'w');
        var headers = JSON.parse(JSON.stringify(res.headers));
        headers.statusCode = res.statusCode;
        var headerstr = JSON.stringify(headers);
        fs.writeSync(headersfd, headerstr, 0, headerstr.length, null);
        fs.closeSync(headersfd);
      });

      if (callback) {
        callback(res);
      }
    });

    // construct the body that's being sent to the remote server
    var oldReqWrite = req.write.bind(req);
    req.write = function(chunk, encoding) {
      oldReqWrite(chunk, encoding);
      reqBody += chunk.toString(encoding);
    };

    req.on('error', function(err) {
      // TODO: adas, figure out a strategy for handling these types of errors, e.g. ECONNREFUSED
      var filename = sepiaUtil.constructFilename(reqUrl, '', options.headers);
      var resBody = err.toString();
      var fd = fs.openSync(filename, 'w');
      fs.writeSync(fd, resBody, 0, resBody.length, null);
      fs.closeSync(fd);

      var headersfd = fs.openSync(filename + '.headers', 'w');
      var headers = { statusCode: 500 };
      var headerstr = JSON.stringify(headers);
      fs.writeSync(headersfd, headerstr, 0, headerstr.length, null);
      fs.closeSync(headersfd);
    });

    return req;
  };
});
