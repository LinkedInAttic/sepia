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
 * -- HEADERS ------------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=cache node examples/headers
 *
 * Exercises the use of header and cookie names in the generation of fixture
 * names. All of the following requests use the same endpoint, HTTP method and
 * request body (namely none for the last one). However, with various
 * combination of header and cookie names, we can force cache misses.
 *
 * Also demonstrates the ability to specify a whitelist so only specific header
 * and cookie names are used to construct the fixture name.
 */

var http = require('http');
var request = require('request');
var _ = require('lodash');
var step = require('step');
var common = require('./common');

var sepia = require('..');

// -- ECHO SERVER --------------------------------------------------------------

function parseCookies(str) {
  var cookies = {};

  var ary = (str || '').split(/;\s+/);
  _.map(ary, function(ck) {
    var parsed = ck.trim().split('=');
    cookies[parsed[0]] = parsed[1];
  });

  return cookies;
}

var httpServer = http.createServer(function(req, res) {
  var cookies = _(parseCookies(req.headers.cookie))
    .keys()
    .map(function(key) {
      return key.toLowerCase();
    })
    .value()
    .sort();

  var headers = _.chain(req.headers)
    .omit('cookie')
    .keys()
    .map(function(key) {
      return key.toLowerCase();
    })
    .value()
    .sort();

  var body = JSON.stringify({
    headers: headers,
    cookies: cookies
  });

  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  }, 500);
}).listen(1337, '0.0.0.0');

// -- HTTP REQUESTS ------------------------------------------------------------

function makeHttpRequest(reqHeaders, expectedRes, cacheHitExpected, next) {
  reqHeaders.cookie = _.reduce(reqHeaders.cookie, function(memo, val, name) {
    memo.push(name + '=' + val);
    return memo;
  }, []).join('; ');

  var start = Date.now();

  request({
    url: 'http://localhost:1337',
    method: 'GET',
    headers: reqHeaders
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('  status:', data.statusCode);
    console.log('  body  :', body);
    console.log('  time  :', time);

    common.verify(function() {
      JSON.parse(body).should.eql(expectedRes);
      common.shouldUseCache(cacheHitExpected, time);
    });

    next();
  });
}

function makeTwoHttpRequests(title, req1, req2, shouldBeCached, next) {
  step(
    function() { console.log(title); this(); },
    function() {
      // assume that the first request will always result in a cache miss
      makeHttpRequest(req1.headers, req1.res, false, this);
    },
    function() {
      makeHttpRequest(req2.headers, req2.res, shouldBeCached, this);
    },
    function() { console.log(); next(); }
  );
}

function sameHeadersSameCookies(next) {
  var reqHeaders = {
    '1-H1': 'value1',
    '1-H2': 'value2',
    cookie: {
      '1-C1': 'value3',
      '1-C2': 'value4'
    }
  };

  var expectedRes = {
    headers: ['1-h1', '1-h2', 'connection', 'host'],
    cookies: ['1-c1', '1-c2']
  };

  var req1 = {
    headers: _.cloneDeep(reqHeaders),
    res: expectedRes
  };

  var req2 = {
    headers: _.cloneDeep(reqHeaders),
    res: expectedRes
  };

  makeTwoHttpRequests('SAME HEADERS + SAME COOKIES', req1, req2, true, next);
}

function diffHeadersSameCookies(next) {
  var req1 = {
    headers: {
      '2-H1': 'value1',
      '2-H2': 'value2',
      cookie: {
        '2-C1': 'value3',
        '2-C2': 'value4'
      }
    },
    res: {
      headers: ['2-h1', '2-h2', 'connection', 'host'],
      cookies: ['2-c1', '2-c2']
    }
  };

  var req2 = {
    headers: {
      '2-H3': 'value1',
      '2-H4': 'value2',
      cookie: {
        '2-C1': 'value3',
        '2-C2': 'value4'
      }
    },
    res: {
      headers: ['2-h3', '2-h4', 'connection', 'host'],
      cookies: ['2-c1', '2-c2']
    }
  };

  makeTwoHttpRequests('DIFF HEADERS + SAME COOKIES', req1, req2, false, next);
}

function diffHeadersDiffCookies(next) {
  var req1 = {
    headers: {
      '3-H1': 'value1',
      '3-H2': 'value2',
      cookie: {
        '3-C1': 'value3',
        '3-C2': 'value4'
      }
    },
    res: {
      headers: ['3-h1', '3-h2', 'connection', 'host'],
      cookies: ['3-c1', '3-c2']
    }
  };

  var req2 = {
    headers: {
      '3-H3': 'value1',
      '3-H4': 'value2',
      cookie: {
        '3-C3': 'value3',
        '3-C4': 'value4'
      }
    },
    res: {
      headers: ['3-h3', '3-h4', 'connection', 'host'],
      cookies: ['3-c3', '3-c4']
    }
  };

  makeTwoHttpRequests('DIFF HEADERS + DIFF COOKIES', req1, req2, false, next);
}

function sameWhitelisted(next) {
  var req1 = {
    headers: {
      '4-H1': 'value1',
      '4-H2': 'value2',
      '4-H3': 'value3', // ignored for fixture filename purposes
      cookie: {
        '4-C1': 'value4',
        '4-C2': 'value5',
        '4-C3': 'value6' // ignored for fixture filename purposes
      }
    },
    res: {
      headers: ['4-h1', '4-h2', '4-h3', 'connection', 'host'],
      cookies: ['4-c1', '4-c2', '4-c3']
    }
  };

  var req2 = {
    headers: {
      '4-H1': 'value1',
      '4-H2': 'value2',
      '4-H4': 'value4', // ignored for fixture filename purposes
      cookie: {
        '4-C1': 'value4',
        '4-C2': 'value5',
        '4-C4': 'value7' // ignored for fixture filename purposes
      }
    },
    res: {
      // Note that we get back h3 and c3, even though that's not what we
      // specify for this request. This is because the header and cookie
      // whitelists cause a cache hit with the previous request.
      headers: ['4-h1', '4-h2', '4-h3', 'connection', 'host'],
      cookies: ['4-c1', '4-c2', '4-c3']
    }
  };

  sepia.configure({
    headerWhitelist: ['H1', 'h2'], // capitalization doesn't matter
    cookieWhitelist: ['C1', 'c2']  // capitalization doesn't matter
  });

  makeTwoHttpRequests('SAME WHITELISTED HEADERS + SAME WHITELISTED COOKIES',
    req1, req2, true, next);
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { sameHeadersSameCookies(this); },
  function() { diffHeadersSameCookies(this); },
  function() { diffHeadersDiffCookies(this); },
  function() { sameWhitelisted(this); },
  //function() {
  //  sepia.configure({
  //    headerWhitelist: ['H1', 'h2'], // capitalization doesn't matter
  //    cookieWhitelist: ['C1', 'c2']  // capitalization doesn't matter
  //  });

  //  makeRequests('SAME WHITELISTED HEADERS + SAME WHITELISTED COOKIES', {
  //    H1: 'value1',
  //    H2: 'value2',
  //    H3: 'value3',
  //    cookie: {
  //      C1: 'value4',
  //      C2: 'value5',
  //      C3: 'value6'
  //    }
  //  }, {
  //    H1: 'value7',
  //    H2: 'value8',
  //    H4: 'value9', // this header won't be used to determine the fixture
  //    cookie: {
  //      C1: 'value10',
  //      C2: 'value11',
  //      C4: 'value11' // this cookie won't be used to determine the fixture
  //    }
  //  }, false, true, this);
  //},
  _.bind(httpServer.close, httpServer)
);
