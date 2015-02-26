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
 * -- FORCE LIVE ---------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=cache node examples/forceLive
 *
 * Demonstrates the ability to have certain requests bypass the fixture system
 * and hit the live downstream servers, regardless of the VCR_MODE.
 *
 * There are two sets of requests made, each time with two requests. The first
 * set is to a URL that is configured to be live, and thus the two requests
 * don't encounter a cache hit. The second set is to a URL that is not
 * configured to be live, and thus the two requests do encounter a cache hit.
 */

var http = require('http');
var request = require('request');
var _ = require('lodash');
require('should');
var step = require('step');
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

function liveRequests(next) {
  var firstBody;

  function once(cb) {
    var start = Date.now();

    request({
      url: 'http://localhost:1337/randomLive/'
    }, function(err, data, body) {
      var time = Date.now() - start;

      console.log('LIVE REQUEST');
      console.log('  status:', data.statusCode);
      console.log('  body  :', body);
      console.log('  time  :', time);

      common.verify(function() {
        if (firstBody) {
          // ...technically, the two requests could return the same number, but
          // that would be exceedingly rare...
          body.should.not.equal(firstBody);
        } else {
          firstBody = body;
        }

        common.shouldBeSlow(time);
      });

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
  var firstBody;

  function once(cacheHitExpected, cb) {
    var start = Date.now();

    request({
      url: 'http://localhost:1337/randomCached/'
    }, function(err, data, body) {
      var time = Date.now() - start;

      console.log('CACHEABLE REQUEST');
      console.log('  status:', data.statusCode);
      console.log('  body  :', body);
      console.log('  time  :', time);

      common.verify(function() {
        if (firstBody) {
          // ...technically, the two requests could return the same number, but
          // that would be exceedingly rare...
          body.should.equal(firstBody);
        } else {
          firstBody = body;
        }

        common.shouldUseCache(cacheHitExpected, time);
      });

      cb();
    });
  }

  step(
    function() { once(false, this); },
    function() { once(true, this); },
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
  _.bind(httpServer.close, httpServer)
);
