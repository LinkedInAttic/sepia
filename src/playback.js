var fs = require('fs');
var sepiaUtil = require('./util');
var EventEmitter = require('events').EventEmitter;

['http', 'https'].forEach(function(protocol) {
  var protocolModule = require(protocol);

  // don't preserve the old request function
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
    };

    return req;
  };
});
