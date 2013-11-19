/**
 * -- FILTERS ------------------------------------------------------------------
 *
 * rm -r fixtures
 * VCR_MODE=record   node examples/filters
 * VCR_MODE=playback node examples/filters
 *
 * Exercises URL and body filters, used for treating multiple distinct requests
 * as the same for the purposes of fixture filename construction.
 *
 * In this example, the current timestamp is embedded in the URL and in the
 * request body, and obviously, the timestamp won't remain the same when the
 * request is made again in playback mode. However, by filtering out the
 * timestamp, we can treat these requests as identical.
 */

var http = require('http');
var request = require('request');
var _ = require('lodash');
var step = require('step');
require('should');
var common = require('./common');

common.ensureNonCacheMode('filters.js');

var sepia = require('..');

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
    headers['Content-Type'] = 'text/plain';

    // simulate server latency
    setTimeout(function() {
      res.writeHead(200, headers);
      res.end(body);
    }, 500);
  });
}).listen(1337, '0.0.0.0');

// -- HTTP REQUEST -------------------------------------------------------------

function makeHttpRequest(next) {
  var start = Date.now();

  var timestamp = Date.now();
  var reqBody = 'time * 2 = ' + (timestamp * 2);

  sepia.filter({
    url: /.*/,
    urlFilter: function(url) {
      // disregard the timestamp in the query parameter
      return url.replace(/time\=[0-9]+/, '');
    },
    bodyFilter: function(body) {
      // disregard the timestamp in the request body
      return body.replace(/\= [0-9]+/, '');
    }
  });

  request({
    url: 'http://localhost:1337',
    method: 'POST',
    qs: {
      time: timestamp
    },
    body: reqBody
  }, function(err, data, body) {
    var time = Date.now() - start;

    console.log('FILTERS');
    console.log('  status:', data.statusCode);
    console.log('  body  :', body);
    console.log('  time  :', time);

    common.verify(function() {
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
  _.bind(httpServer.close, httpServer),
  function() { process.exit(0); }
);
