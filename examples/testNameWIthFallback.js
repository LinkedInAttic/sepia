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
 * -- TEST NAME WITH FALLBACK ----------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=cache node examples/testNameWithFallback
 *
 * Exercise setting a test name in order to record fixtures into namespaced
 * directories, while falling back to root level fixtures if the namespaced
 * fixture does not exist.
 *
 * Additionally, setting the test name is done via an HTTP request, so that
 * request must be cofigured to be live.
 *
 * Global Enpoints are created without a namespace "/globalEndpoint<...>"
 * Regular Endpoints are created with a test namespace "/endpoint<...>"
 *
 * The order of the requests:
 *
 *  1.  Fire request to /globalEndpoint1 (global, cache miss)
 *  2.  Fire request to /globalEndpoint2 (global, cache miss)
 *
 *  3.  Set the test name to "test1"     (has to be live).
 *  4.  Fire request to /globalEndpoint1 (fallback,   cache hit)
 *  5.  Fire request to /endpointA       (namespaced, cache miss)
 *
 *  6.  Set the test name to "test2" (has to be live).
 *  7.  Fire request to /endpointB   (namespaced, cache miss)
 *  8.  Fire request to /endpointB   (namespaced, cache hit)
 *
 *  9.  Fire request with test header "test1" to /endpointA       (namespace,  cache hit)
 *  10. Fire request with test header "test1" to /globalEndpoint2 (fallback,   cache hit)
 *  11. Fire request with test header "test1" to /endpointC       (namespaced, cache miss)
 *
 *  12. Fire request with test header "test2" to /endpointB       (namespaced, cache hit)
 *  13. Fire request with test header "test2" to /globalEndpoint1 (fallback,   cache hit)
 *  14. Fire request with test header "test2" to /endpointD       (namespaced, cache miss)
 *
 *  15. Fire request with test header "test3" to /globalEndpoint1 (fallback,   cache hit)
 */

var http = require('http');
var request = require('request');
var _ = require('lodash');
var step = require('step');
require('should');
var common = require('./common');

var sepia = require('..')
  .withSepiaServer();

// -- ECHO SERVER --------------------------------------------------------------

// 1. Returns a random number.

var httpServer = http.createServer(function(req, res) {
  var headers = {
    'Content-type': 'text/plain'
  };

  // One piece of functionality being tested is the use of the
  // x-sepia-test-name header, which is not meant to be passed along to
  // downstream services. For that reason, we pass that header back to the
  // client so that it can test the absence of the header.
  if (req.headers['x-sepia-test-name']) {
    headers['x-sepia-test-name'] = req.headers['x-sepia-test-name'];
  }

  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, headers);
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

function normalRequest(url, cacheHitExpected, next) {
  var start = Date.now();

  request({
    url: 'http://localhost:1337/' + url
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('REQUEST TO: http://localhost:1337/' + url);
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

function requestWithHeader(testName, url, cacheHitExpected, next) {
  var start = Date.now();

  request({
    url: 'http://localhost:1337/' + url,
    headers: {
      'x-sepia-test-name': testName
    }
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('REQUEST TO WITH TEST HEADER: http://localhost:1337/'+ url);
    console.log('  status:', data.statusCode);
    console.log('  body  :', body);
    console.log('  time  :', time);

    common.verify(function() {
      common.shouldUseCache(cacheHitExpected, time);
      data.headers.should.not.have.property('x-sepia-test-name');
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

sepia.configure({
  fallbackToGlobal: true
});

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { normalRequest('globalEndpoint1', false, this); },
  function() { normalRequest('globalEndpoint2', false, this);   },

  function() { setTestName('test1', this); },
  function() { normalRequest('globalEndpoint1', true, this);  },
  function() { normalRequest('endpointA', false, this); },

  function() { setTestName('test2', this); },
  function() { normalRequest('endpointB', false, this); },

  function() { requestWithHeader('test1', 'endpointA', true,  this); },
  function() { requestWithHeader('test1', 'globalEndpoint2',  true,  this); },
  function() { requestWithHeader('test1', 'endpointC', false, this); },

  function() { requestWithHeader('test2', 'endpointB', true,  this); },
  function() { requestWithHeader('test2', 'globalEndpoint1', true,  this); },
  function() { requestWithHeader('test2', 'endpointD', false, this); },

  function() { requestWithHeader('test3', 'globalEndpoint1', true,  this); },
  _.bind(httpServer.close, httpServer),
  _.bind(sepia.shutdown, sepia)
);
