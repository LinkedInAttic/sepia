var http = require('http');
var path = require('path');
var request = require('request');
var _ = require('lodash');
var step = require('step');

var sepia = require('..');

// -- ECHO SERVER --------------------------------------------------------------

var httpServer = http.createServer(function(req, res) {
  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, { 'Content-type': 'text/plain' });
    res.end(Math.random().toString());
  }, 500);
}).listen(1337, '0.0.0.0');

// -- LOGGING ------------------------------------------------------------------

function logTime(shouldBeFast, start) {
  var time = Date.now() - start;
  console.log('  time   :', time);

  if ((shouldBeFast && time > 10) ||
    (!shouldBeFast && time < 500)) {
    console.log('\033[1;31mFAIL\033[0m');
  } else {
    console.log('\033[1;32mSUCCESS\033[0m');
  }
}

// -- HTTP REQUESTS ------------------------------------------------------------

function liveRequests(next) {
  function once(cb) {
    var start = Date.now();

    request({
      url: 'http://localhost:1337/randomLive/'
    }, function(err, data, body) {
      console.log('LIVE REQUEST');
      console.log('  status :', data.statusCode);
      console.log('  body   :', body);
      logTime(false, start);

      cb();
    });
  }

  step(
    function() { once(this); },
    function() { once(this); },
    function() { console.log(); next(); }
  );
}

function cachedRequests(next) {
  var shouldBeFast = false;

  function once(cb) {
    var start = Date.now();

    request({
      url: 'http://localhost:1337/randomCached/'
    }, function(err, data, body) {
      console.log('CACHEABLE REQUEST');
      console.log('  status :', data.statusCode);
      console.log('  body   :', body);
      logTime(shouldBeFast, start);

      shouldBeFast = true;

      cb();
    });
  }

  step(
    function() { once(this); },
    function() { once(this); },
    function() { console.log(); next(); }
  );
}

// -- RUN EVERYTHING -----------------------------------------------------------

sepia.filter({
  url: /live/i,
  forceLive: true
});

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { liveRequests  (this); },
  function() { cachedRequests(this); },
  _.bind(httpServer.close, httpServer),
  function() { process.exit(0); }
);
