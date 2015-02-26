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
 * -- UNICODE ------------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=record   node examples/unicode
 * VCR_MODE=playback node examples/unicode
 *
 * Automated test for a unicode-related bug.
 *
 * When body data from an HTTP response is treated as a string, there are
 * issues writing it to a file. In this specific case, the character 0xA0
 * (non-breaking space) causes the last character of the body to not be written
 * to the file. We can see that by recording this request, then playing it
 * back; during playback, the body comes back with the last character missing.
 *
 * The reason for this is that if we treat the data as a string, it's length
 * (in characters) is not necessarily the same as the buffer's length (in
 * bytes). Thus, the solution is to treat the data as a buffer without trying
 * to convert it into a string. Now, the problem described above is
 * non-existant.
 *
 * Note that while updating this test, I was unable to reproduce the issue.
 * Perhaps enhancements that were added to sepia later down the line made this
 * a non-issue, but the test is available to prevent a regression.
 */

var http = require('http');
var _ = require('lodash');
var step = require('step');
require('should');
var common = require('./common');

common.ensureNonCacheMode('unicode.js');

require('..');

// -- TEST SERVER --------------------------------------------------------------

// 1. Returns the request body as the response body.

var httpServer = http.createServer(function(req, res) {
  var headers = { 'Content-Type': 'text/plain' };

  req.setEncoding('utf-8');
  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });

  req.on('end', function() {
    headers['Content-Type'] = 'application/json';

    // simulate server latency
    setTimeout(function() {
      res.writeHead(200, headers);
      res.end(body);
    }, 500);
  });
}).listen(1337, '0.0.0.0');

// -- HTTP REQUEST -------------------------------------------------------------

function makeHttpRequest(next) {
  var start;
  var payload = '#\u00A0#';

  var httpReq = http.request({
    host: 'localhost',
    port: 1337,
    method: 'POST',
    path: '/upper'
  }, function(res) {
    res.setEncoding('utf8'); // VCR will ignore this
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });

    res.on('end', function() {
      var time = Date.now() - start;

      console.log('UNICODE');
      console.log('  status:', res.statusCode);
      console.log('  body  :', body);
      console.log('  time  :', time);

      common.verify(function() {
        body.should.eql(payload);
        common.shouldBeDynamicallyTimed(time);
      });

      console.log();

      next();
    });
  });

  start = Date.now();
  httpReq.end(payload);
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { makeHttpRequest(this); },
  _.bind(httpServer.close, httpServer)
);
