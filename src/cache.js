var fs = require('fs');
var sepiaUtil = require('./util');
var EventEmitter = require('events').EventEmitter;

var playbackHits = true;
var recordMisses = true;
var emulateTiming = false;


module.exports.configure = function(options) {
  playbackHits = options.playback;
  recordMisses = options.record;
  emulateTiming = options.emulateTiming;
};

['http', 'https'].forEach(function(protocol) {

  var protocolModule = require(protocol);
  var oldRequest = protocolModule.request;

  //ensures there are enough agents to handle timeout issues that arise due to slow servers or unaccessible
  //servers in development environment.
  protocolModule.globalAgent.maxSockets = 1000;

  protocolModule.request = function(options, callback) {
    var reqUrl = sepiaUtil.urlFromHttpRequestOptions(options, protocol);
    var reqBody = [];

    var req = new EventEmitter();
    req.setTimeout = req.abort = function() {};

    req.write = function(chunk) {
      reqBody.push(chunk);
    };

    req.end = function(lastChunk) {
      if (lastChunk) {
        reqBody.push(lastChunk);
      }

      reqBody = Buffer.concat(reqBody);
      var filename = sepiaUtil.constructFilename(options.method, reqUrl,
                                                  reqBody.toString(), options.headers);


      function playback(doneTimeout) {
        var headerContent = fs.readFileSync(filename + '.headers');
        var resHeaders = JSON.parse(headerContent);


        if (emulateTiming && !doneTimeout) {

          var time = resHeaders.time;
          setTimeout(function () {
            playback(true);
          }, time);

          return;
        }

        var socket = new EventEmitter();
        ['setTimeout', 'setEncoding'].forEach(function (funcName) {
          socket[funcName] = function () {};
        });
        req.socket = socket;
        req.emit('socket', socket);

        if (resHeaders.timeout) {
          socket.emit('timeout');
          req.emit('error', new Error('Timeout'));
          return;
        }

        if (resHeaders.error) {
          req.emit('error', resHeaders.error);
          return;
        }

        var res = new EventEmitter();
        res.headers = resHeaders.headers || {};
        res.statusCode = resHeaders.statusCode;

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

        var resBody = fs.readFileSync(filename);
        req.emit('response', res);
        res.emit('data', resBody);
        res.emit('end');
      }

      //if the file exists and we allow playback (we are not in record only mode)
      //then playback the call.
      if (fs.existsSync(filename + '.headers') && playbackHits) {
        playback();
        return;
      }


      //if we are not recording and the fixtures does not exist, then throw an exception
      if (!recordMisses) {
        throw new Error('Fixture ' + filename + ' not found.');
      }

      //Remember how long it took to perform this action.
      var startTime = new Date().getTime();
      var timedOut = false;


      function writeHeaderFile(headers) {
        var timeLength = new Date().getTime() - startTime;
        headers.url = reqUrl;
        headers.time = timeLength;
        fs.writeFileSync(filename + '.headers', JSON.stringify(headers, null, 2));
      }

      // Write the header file with a timeout first then update with the real value.
      // Otherwise if this times out after a few seconds, and the request stops waiting
      // and the recording is over, then this will not ever get writen to a file and
      // on playback the fixture file won't be found.
      writeHeaderFile({
        timeout: true,
        time: 30000
      });


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

          fs.writeFileSync(filename, resBody);

          writeHeaderFile({
            statusCode: res.statusCode,
            headers: res.headers
          });

          playback();
        });

      });
      realReq.on('error', function (error) {

        var header = {
          error: error
        };
        if (timedOut) {
          header.timeout = true;
        }
        writeHeaderFile(header);

        playback();
      });
      realReq.on('socket', function (socket) {
        socket.on('timeout', function () {
          timedOut = true;
        });
      });

      realReq.end(reqBody);
    };

    return req;
  };
});
