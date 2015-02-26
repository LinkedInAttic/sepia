// Copyright 2013 LinkedIn Corp.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
  _.bind(httpServer.close, httpServer)
);
