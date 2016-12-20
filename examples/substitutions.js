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
var sepiaUtil = require('../src/util');

require('..');

// -- ECHO SERVER --------------------------------------------------------------

var httpServer = http.createServer(function(req, res) {
  req.setEncoding('utf-8');
  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });

  req.on('end', function() {
    req.headers.authorization.should.equal('CLIENT:TheActualSecret1');
    body.should.equal('Hello from client => TheActualSecret2');

    // simulate server latency
    setTimeout(function() {
      res.writeHead(200,  { 'authorization': 'SERVER:TheActualSecret3' });
      res.end('Hello from server => TheActualSecret4');
    }, 500);
  });
}).listen(1337, '0.0.0.0');

// -- HTTP REQUESTS ------------------------------------------------------------

function makeRequest(title, next) {
  var start = Date.now();

  request({
    method: 'post',
    headers: { authorization: 'CLIENT:TheActualSecret1'},
    url: 'http://localhost:1337/',
    body: 'Hello from client => TheActualSecret2'
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log(title);
    console.log('  status:', data.statusCode);
    console.log('  time  :', time);

    common.verify(function() {
      data.headers.authorization.should.equal('SERVER:TheActualSecret3');
      body.should.equal('Hello from server => TheActualSecret4');
    });

    next();
  });
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() {
    sepia.substitute('<OPAQUE_SECRET1>', function() { return 'TheActualSecret1'; });
    sepia.substitute('<OPAQUE_SECRET2>', function() { return 'TheActualSecret2'; });
    sepia.substitute('<OPAQUE_SECRET3>', function() { return 'TheActualSecret3'; });
    sepia.substitute('<OPAQUE_SECRET4>', function() { return 'TheActualSecret4'; });

    setTimeout(this, 100);
  }, // let the server start up
  function() { makeRequest('NO FIXTURES' , this); },
  function() { makeRequest('YES FIXTURES', this); },
  httpServer.close.bind(httpServer)
);
