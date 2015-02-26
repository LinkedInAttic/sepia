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
 * -- LANGUAGES ----------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=record   node examples/languages
 * VCR_MODE=playback node examples/languages
 *
 * Exercises the language-specific fixture directory functionality. This is a
 * feature that is useful when the server dynamically returns different data
 * based on the client's Accept-Language header. This functionality is built in
 * to sepia because it is a common use case.
 */

var http = require('http');
var request = require('request');
var _ = require('lodash');
var step = require('step');
require('should');
var common = require('./common');

common.ensureNonCacheMode('languages.js');

require('..');

// -- TEST SERVER --------------------------------------------------------------

// 1. Returns a different string based on the Accept-Language header
// 2. Uppercases the request body
var httpServer = http.createServer(function(req, res) {
  var headers = { 'Content-Type': 'text/plain' };

  var lang = req.headers['accept-language'];
  lang = lang.split(',')[0];

  var resBody;

  switch (lang) {
  case 'en':
    resBody = 'Hello';
    break;
  case 'sp':
    resBody = 'Hola';
    break;
  }

  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, headers);
    res.end(resBody);
  }, 500);
}).listen(1337, '0.0.0.0');

// -- HTTP REQUEST -------------------------------------------------------------

function makeHttpRequest(lang, expectedBody, next) {
  var start = Date.now();

  request({
    url: 'http://localhost:1337/lang/',
    method: 'GET',
    headers: {
      'accept-language': lang
    }
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('LANGUAGES:', lang);
    console.log('  status:', data.statusCode);
    console.log('  body  :', body);
    console.log('  time  :', time);

    common.verify(function() {
      body.should.eql(expectedBody);
      common.shouldBeDynamicallyTimed(time);
    });

    console.log();

    next();
  });
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { makeHttpRequest('en,sp', 'Hello', this); },
  function() { makeHttpRequest('sp,en', 'Hola' , this); },
  _.bind(httpServer.close, httpServer)
);
