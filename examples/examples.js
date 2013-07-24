var http = require('http');
var path = require('path');
var request = require('request');
var _ = require('lodash');
var step = require('step');

var sepia = require('..');

// -- ECHO SERVER --------------------------------------------------------------

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
    var resBody;
    if (/^\/upper/.test(req.url)) {
      headers['Content-Type'] = 'application/json';
      resBody = JSON.stringify({ data: body.toUpperCase() });
    } else if (/^\/lang/.test(req.url)) {
      var lang = req.headers['accept-language'];
      if (lang.indexOf(',') >= 0) {
        lang = lang.split(',')[0];
      }
      switch (lang) {
        case 'en': resBody = 'Hello'; break;
        case 'sp': resBody = 'Hola' ; break;
      }
    }

    // simulate server latency
    setTimeout(function() {
      res.writeHead(200, headers);
      res.end(resBody);
    }, 500);
  });
}).listen(1337, '0.0.0.0');

// -- HTTP REQUESTS ------------------------------------------------------------

function viaHttp(next) {
  var httpReq = http.request({
    host: 'localhost',
    port: 1337,
    method: 'POST',
    path: '/upper?page=12',
    headers: {
      'x-to-reverse': 'hello'
    }
  }, function(res) {
    res.setEncoding('utf8');
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });

    res.on('end', function() {
      var filteredHeaders = _.pick(res.headers, 'x-reversed');
      console.log('FROM HTTP');
      console.log('  status :', res.statusCode);
      console.log('  headers:', JSON.stringify(filteredHeaders));
      console.log('  body   :', body);
      console.log();

      next();
    });
  });
  httpReq.end('hello-world');
}

function viaRequest(next) {
  request({
    url: 'http://localhost:1337/upper',
    method: 'POST',
    headers: {
      'x-to-reverse': 'hi'
    },
    qs: {
      page: 13
    },
    body: 'goodbye-world'
  }, function(err, data, body) {
    var filteredHeaders = _.pick(data.headers, 'x-reversed');
    console.log('FROM REQUEST');
    console.log('  status :', data.statusCode);
    console.log('  headers:', JSON.stringify(filteredHeaders));
    console.log('  body   :', body);
    console.log();

    next();
  });
}

function unicode(next) {
  // When body data is treated as a string, there are issues writing it to a
  // file. In this specific case, the character 0xA0 (non-breaking space)
  // causes the last character of the body to not be written to the file. We
  // can see that by recording this request, then playing it back; during
  // playback, the body comes back with the last character missing.
  //
  // The reason for this is that if we treat the data as a string, it's length
  // (in characters) is not necessarily the same as the buffer's length (in
  // bytes). Thus, the solution is to treat the data as a buffer without trying
  // to convert it into a string. Now, the problem described above is
  // non-existant.
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
      console.log('UNICODE');
      console.log('  status :', res.statusCode);
      console.log('  body   :', body);
      console.log();

      next();
    });
  });
  httpReq.end('# #');
}

function filters(next) {
  var timestamp = Date.now();
  var body = 'time * 2 = ' + (timestamp * 2);

  sepia.filter({
    url: /.*/,
    urlFilter: function(url) {
      return url.replace(/time\=[0-9]+/, '');
    },
    bodyFilter: function(body) {
      return body.replace(/\= [0-9]+/, '');
    }
  });

  request({
    url: 'http://localhost:1337/upper',
    method: 'POST',
    qs: {
      time: timestamp
    },
    body: body
  }, function(err, data, body) {
    console.log('FILTERS');
    console.log('  status :', data.statusCode);
    console.log('  body   :', body);
    console.log();

    next();
  });
}

function languages(next) {
  function once(lang, cb) {
    request({
      url: 'http://localhost:1337/lang/',
      method: 'GET',
      headers: {
        'accept-language': lang
      }
    }, function(err, data, body) {
      console.log('LANGUAGES');
      console.log('  status :', data.statusCode);
      console.log('  body   :', body);

      cb();
    });
  }

  step(
    function() { once('en'   , this); },
    function() { once('sp,en', this); },
    function() { console.log(); next(); }
  );
}

function fixtureDir(next) {
  sepia.fixtureDir(path.join(process.cwd(), 'fixtures/custom'));

  request({
    url: 'http://localhost:1337/upper',
    method: 'POST',
    body: 'hello'
  }, function(err, data, body) {
    console.log('FIXTURES DIRECTORY');
    console.log('  status :', data.statusCode);
    console.log('  body   :', body);

    sepia.fixtureDir(path.join(process.cwd(), 'fixtures/generated'));

    next();
  });
}

// -- RUN EVERYTHING -----------------------------------------------------------

step(
  function() { setTimeout(this, 100); }, // let the server start up
  function() { viaHttp   (this); },
  function() { viaRequest(this); },
  function() { unicode   (this); },
  function() { filters   (this); },
  function() { languages (this); },
  function() { fixtureDir(this); },
  _.bind(httpServer.close, httpServer),
  function() { process.exit(0); }
);
