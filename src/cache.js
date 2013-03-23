var fs = require('fs');
var sepiaUtil = require('./util');
var EventEmitter = require('events').EventEmitter;

['http', 'https'].forEach(function(protocol) {
  var protocolModule = require(protocol);

  var oldRequest = protocolModule.request;
  protocolModule.request = function(options, callback) {
    var reqUrl = sepiaUtil.urlFromHttpRequestOptions(options, protocol);
    var reqBody = '';

    var req = new EventEmitter();
    req.setTimeout = req.abort = function() {};

    req.write = function(chunk) {
      reqBody += chunk.toString();
    };

    req.end = function(lastChunk) {
      if (lastChunk) {
        reqBody += lastChunk;
      }

      var filename = sepiaUtil.constructFilename(reqUrl, reqBody,
        options.headers);
      if (fs.existsSync(filename)) {
        var resBody = fs.readFileSync(filename);

        var headerContent = fs.readFileSync(filename + '.headers');
        var resHeaders = JSON.parse(headerContent);
        var statusCode = resHeaders.statusCode;
        delete resHeaders.statusCode; // injected in record mode, not necessary

        var res =  new EventEmitter();
        res.headers = resHeaders;
        res.statusCode = statusCode;

        // flesh out the response because the request module expects these
        // properties to be present
        res.connection = {
          listeners: function() { return []; },
          once: function() {},
          client: {
            authorized: true
          }
        };

        res.setEncoding = function() {};
        res.abort = res.pause = res.resume = function() {};

        if (callback) {
          callback(res);
        }

        req.emit('response', res);
        res.emit('data', resBody);
        res.emit('end');
      } else {
        var realReq = oldRequest(options, function(res) {
          // It's important that we don't respect the encoding set by
          // application because we want to treat the incoming data as a
          // buffer. When body data is treated as a string, there are issues
          // writing it to a file. With non-ASCII messages, the string's length
          // (in characters) is not necessarily the same as the buffer's length
          // (in bytes). Thus, the solution is to treat the data as a buffer
          // without allowing conversion into a string.
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

        ['error', 'response'].forEach(function(evt) {
          realReq.on(evt, function() {
            var args = Array.prototype.slice.apply(arguments);
            args.unshift(evt);
            req.emit.apply(req, args);
          });
        });

        realReq.end(reqBody);
      }
    };

    return req;
  };
});
