var http = require('http');
var request = require('request');
var step = require('step');

require('..');

// -- ECHO SERVER --------------------------------------------------------------

var httpServer = http.createServer(function(req, res) {
  // simulate server latency
  setTimeout(function() {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('hello');
  }, 1000);
}).listen(1337, '0.0.0.0');

// -- HTTP REQUESTS ------------------------------------------------------------

function makeRequest(title, shouldBeFast, next) {
  var start = Date.now();
  request({
    url: 'http://localhost:1337/'
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log(title);
    console.log('  status   :', data.statusCode);
    console.log('  body     :', body);
    console.log('  time (ms):', time);

    if ((shouldBeFast && time > 10) ||
      (!shouldBeFast && time < 500)) {
      console.log('\033[1;31mFAIL\033[0m');
    } else {
      console.log('\033[1;32mSUCCESS\033[0m');
    }

    console.log();

    next();
  });
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { makeRequest('NO FIXTURES' , false, this); },
  function() { makeRequest('YES FIXTURES', true , this); },
  httpServer.close.bind(httpServer),
  function() { process.exit(0); }
);
