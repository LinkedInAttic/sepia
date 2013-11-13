var http = require('http');
var request = require('request');
var _ = require('lodash');
var step = require('step');

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
  var cookies = parseCookies(req.headers.cookie);
  var body = _.chain(req.headers).omit('cookie').keys().value().join(', ');
  body += ', cookie: (' + _.keys(cookies).join(', ') + ')';

  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(body);
  }, 500);
}).listen(1337, '0.0.0.0');

// -- HTTP REQUESTS ------------------------------------------------------------


function makeRequests(title, headers1, headers2, shouldBeFast1, shouldBeFast2,
  next) {
  function once(headers, shouldBeFast, cb) {
    headers.cookie = _.reduce(headers.cookie, function(memo, val, name) {
      memo.push(name + '=' + val);
      return memo;
    }, []).join('; ');

    var start = Date.now();

    request({
      url: 'http://localhost:1337',
      method: 'GET',
      headers: headers
    }, function(err, data, body) {
      var time = Date.now() - start;

      console.log(title);
      console.log('  status :', data.statusCode);
      console.log('  body   :', body);
      console.log('  time   :', time);

      if ((shouldBeFast && time > 10) ||
        (!shouldBeFast && time < 500)) {
        console.log('\033[1;31mFAIL\033[0m');
      } else {
        console.log('\033[1;32mSUCCESS\033[0m');
      }

      cb();
    });
  }

  step(
    function() { once(headers1, shouldBeFast1, this); },
    function() { once(headers2, shouldBeFast2, this); },
    function() { console.log(); next(); }
  );
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() {
    makeRequests('SAME HEADERS + SAME COOKIES', {
      H1: 'value1',
      H2: 'value2',
      cookie: {
        C1: 'value3',
        C2: 'value4'
      }
    }, {
      H1: 'value5',
      H2: 'value6',
      cookie: {
        C1: 'value7',
        C2: 'value8'
      }
    }, false, true, this);
  },
  function() {
    makeRequests('SAME HEADERS + DIFF COOKIES', {
      H1: 'value1',
      H2: 'value2',
      cookie: {
        C1: 'value3',
        C2: 'value4'
      }
    }, {
      H1: 'value5',
      H2: 'value6',
      cookie: {
        C3: 'value7',
        C4: 'value8'
      }
    }, true, false, this);
  },
  function() {
    makeRequests('DIFF HEADERS + SAME COOKIES', {
      H1: 'value1',
      H2: 'value2',
      cookie: {
        C1: 'value3',
        C2: 'value4'
      }
    }, {
      H3: 'value5',
      H4: 'value6',
      cookie: {
        C1: 'value7',
        C2: 'value8'
      }
    }, true, false, this);
  },
  function() {
    makeRequests('DIFF HEADERS + DIFF COOKIES', {
      H1: 'value1',
      H2: 'value2',
      cookie: {
        C1: 'value3',
        C2: 'value4'
      }
    }, {
      H3: 'value5',
      H4: 'value6',
      cookie: {
        C3: 'value7',
        C4: 'value8'
      }
    }, true, false, this);
  },
  function() {
    sepia.configure({
      headerWhitelist: ['H1', 'h2'], // capitalization doesn't matter
      cookieWhitelist: ['C1', 'c2']  // capitalization doesn't matter
    });

    makeRequests('SAME WHITELISTED HEADERS + SAME WHITELISTED COOKIES', {
      H1: 'value1',
      H2: 'value2',
      H3: 'value3',
      cookie: {
        C1: 'value4',
        C2: 'value5',
        C3: 'value6'
      }
    }, {
      H1: 'value7',
      H2: 'value8',
      H4: 'value9', // this header won't be used to determine the fixture
      cookie: {
        C1: 'value10',
        C2: 'value11',
        C4: 'value11' // this cookie won't be used to determine the fixture
      }
    }, false, true, this);
  },
  _.bind(httpServer.close, httpServer),
  function() { process.exit(0); }
);
