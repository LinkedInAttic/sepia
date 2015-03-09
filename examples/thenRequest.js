// Copyright 2015 LinkedIn Corp.
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
 * -- THEN REQUEST -------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=record   node examples/thenRequest
 * VCR_MODE=playback node examples/thenRequest
 *
 * Tests the ability to use the then-request module, which works with sepia
 * because it uses http(s).request internally.
 */

var http = require('http');
var request = require('then-request');
var _ = require('lodash');
var step = require('step');
require('should');
var common = require('./common');

common.ensureNonCacheMode('request.js');

require('..');

// -- TEST SERVER --------------------------------------------------------------

// 1. Reverses the value of the x-to-reverse header
// 2. Uppercases the request body

var httpServer = http.createServer(function(req, res) {
  var headers = { 'Content-Type': 'text/plain' };
  var toReverse = req.headers['x-to-reverse'];
  if (toReverse) {
    headers['x-reversed'] = toReverse.split('').reverse().join('');
  }

  req.setEncoding('utf-8');
  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });

  req.on('end', function() {
    headers['Content-Type'] = 'application/json';
    var resBody = JSON.stringify({ data: body.toUpperCase() });

    // simulate server latency
    setTimeout(function() {
      res.writeHead(200, headers);
      res.end(resBody);
    }, 500);
  });
}).listen(1337, '0.0.0.0');

// -- HTTP REQUEST -------------------------------------------------------------

function makeHttpRequest(next) {
  var start = Date.now();

  request('POST', 'http://localhost:1337/upper', {
    method: 'POST',
    headers: {
      'x-to-reverse': 'hi'
    },
    qs: {
      page: 13
    },
    body: 'goodbye-world'
  }).done(function(res) {
    var time = Date.now() - start;

    var filteredHeaders = _.pick(res.headers, 'x-reversed');
    var body = res.getBody().toString();
    console.log('FROM THEN-REQUEST');
    console.log('  status :', res.statusCode);
    console.log('  headers:', JSON.stringify(filteredHeaders));
    console.log('  body   :', body);
    console.log('  time   :', time);

    common.verify(function() {
      filteredHeaders.should.eql({ 'x-reversed': 'ih' });
      JSON.parse(body).should.eql({ data: 'GOODBYE-WORLD' });
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
