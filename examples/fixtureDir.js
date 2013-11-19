/**
 * -- FIXTURE DIR --------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=record   node examples/fixtureDir
 * VCR_MODE=playback node examples/fixtureDir
 *
 * Demonstrates setting a different directory for the fixtures to be placed
 * into, as opposed to using the default directory set by sepia.
 */

var http = require('http');
var request = require('request');
var _ = require('lodash');
var step = require('step');
var fs = require('fs');
var path = require('path');
require('should');
var common = require('./common');

common.ensureNonCacheMode('fixtureDir.js');

var sepia = require('..');

// -- TEST SERVER --------------------------------------------------------------

// 1. Returns a constant string.

var httpServer = http.createServer(function(req, res) {
  var headers = { 'Content-Type': 'text/plain' };
  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, headers);
    res.end('hello');
  }, 500);
}).listen(1337, '0.0.0.0');

// -- HTTP REQUEST -------------------------------------------------------------

function makeHttpRequest(next) {
  var start = Date.now();

  sepia.fixtureDir(path.join(process.cwd(), 'fixtures/custom'));

  request({
    url: 'http://localhost:1337',
    method: 'GET'
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('FIXTURE DIR');
    console.log('  status:', data.statusCode);
    console.log('  body  :', body);
    console.log('  time  :', time);

    common.verify(function() {
      fs.existsSync('fixtures/custom').should.equal(true);
      common.shouldBeDynamicallyTimed(time);
    });

    console.log();

    next();
  });
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { makeHttpRequest(this); },
  _.bind(httpServer.close, httpServer),
  function() { process.exit(0); }
);
