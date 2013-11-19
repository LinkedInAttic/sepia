/**
 * -- TEST NAME ----------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=cache node examples/testName
 *
 * Exercise setting a test name in order to record fixtures into namespaced
 * directories. One of the requests is configured as global, so it won't be
 * namespaced.
 *
 * Additionally, setting the test name is done via an HTTP request, so that
 * request must be cofigured to be live.
 *
 * The order of the requests:
 *
 *  1. Set the test name to "test1" (has to be live).
 *  2. Fire request #1 (set to be global).
 *  3. Fire request #2 (goes into the test1 directory).
 *  4. Set the test name to "test2" (has to be live).
 *  5. Fire request #1 (cache hit).
 *  6. Fire request #2 (goes into the test2 directory, so cache miss).
 */

var http = require('http');
var request = require('request');
var _ = require('lodash');
var step = require('step');
require('should');
var common = require('./common');

var sepia = require('..');

// -- ECHO SERVER --------------------------------------------------------------

// 1. Returns a random number.

var httpServer = http.createServer(function(req, res) {
  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, { 'Content-type': 'text/plain' });
    res.end(Math.random().toString());
  }, 500);
}).listen(1337, '0.0.0.0');

// -- HTTP REQUESTS ------------------------------------------------------------

function setTestName(name, next) {
  request({
    method: 'post',
    url: 'http://localhost:58080/testOptions/',
    json: {
      testName: name
    }
  }, function(err, data) {
    console.log('SETTING TEST NAME TO', name);
    console.log('  status :', data.statusCode);
    console.log();

    next();
  });
}

function globalRequest(cacheHitExpected, next) {
  var start = Date.now();

  request({
    url: 'http://localhost:1337/global'
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('GLOBAL REQUEST');
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

function localRequest(next) {
  var start = Date.now();

  request({
    url: 'http://localhost:1337/local'
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('LOCAL REQUEST');
    console.log('  status:', data.statusCode);
    console.log('  body  :', body);
    console.log('  time  :', time);

    common.verify(function() {
      common.shouldBeSlow(time);
    });

    console.log();

    next();
  });
}

// -- RUN EVERYTHING -----------------------------------------------------------

// To change the test name, we have to be able to access the live server,
// regardless of whether or not we're playing back fixtures.
sepia.filter({
  url: /:58080/,
  forceLive: true
});

sepia.filter({
  url: /global/i,
  global: true
});

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { setTestName('test1', this); },
  function() { globalRequest(false, this); },
  function() { localRequest(this); },
  function() { setTestName('test2', this); },
  function() { globalRequest(true, this); },
  function() { localRequest(this); },
  _.bind(httpServer.close, httpServer),
  function() { process.exit(0); }
);
