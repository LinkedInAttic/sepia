/**
 * -- CACHE --------------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=cache node examples/cache
 *
 * Exercise the cache mode by making an HTTP request without any fixtures, then
 * re-making that request. The request should take substantially less time the
 * second time, since the fixture will be created by the first call.
 */

var http = require('http');
var request = require('request');
var step = require('step');
var common = require('./common');

require('..');

// -- ECHO SERVER --------------------------------------------------------------

var httpServer = http.createServer(function(req, res) {
  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('hello');
  }, 1000);
}).listen(1337, '0.0.0.0');

// -- HTTP REQUESTS ------------------------------------------------------------

function makeRequest(title, cacheHitExpected, next) {
  var start = Date.now();

  request({
    url: 'http://localhost:1337/'
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log(title);
    console.log('  status:', data.statusCode);
    console.log('  body  :', body);
    console.log('  time  :', time);

    common.verify(function() {
      common.shouldUseCache(cacheHitExpected, time);
    });

    console.log();

    next();
  });
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { makeRequest('NO FIXTURES' , false, this); },
  function() { makeRequest('YES FIXTURES', true , this); },
  httpServer.close.bind(httpServer),
  function() { process.exit(0); }
);
