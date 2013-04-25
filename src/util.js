var url = require('url');
var path = require('path');
var crypto = require('crypto');
var fs = require('fs');

var filenamePrefix = path.join(process.cwd(), 'fixtures/generated');

var filenameFilters = [];

//include headers names in the hash
var includeHeaderNames = true;

//include cookies names in the hash
var includeCookieNames = true;

//give verbose output for hits and misses in log.
var verbose = false;

function configure(options) {
  if (options.includeHeaderNames != null) {
    includeHeaderNames = options.includeHeaderNames;
  }
  if (options.includeCookieNames != null) {
    includeCookieNames = options.includeCookieNames;
  }
  if (options.verbose != null) {
    verbose = options.verbose;
  }
}


function setFixtureDir(fixtureDir) {
  filenamePrefix = fixtureDir;
}

function mkdirpSync(folder) {
  if (!fs.existsSync(path.dirname(folder))) {
    mkdirpSync(path.dirname(folder));
  }

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, '0755');
  }
}

function parseCookiesNames(cookieValue) {
  var cookies = [];

  if (!cookieValue || cookieValue === '') {
    return cookies;
  }

  var ary = cookieValue.toString().split(/;\s+/);
  ary.forEach(function(ck) {
    var ck = ck.trim();
    if (ck !== '') {
      var parsed = ck.split('=')[0];
      if (parsed && parsed !== '') {
        cookies.push(parsed.toLowerCase().trim());
      }
    }
  });

  return cookies.sort();
}

function parseHeaderNames(headers) {
  var headerNames = [];
  for (var name in headers) {
    if (headers.hasOwnProperty(name)) {
      headerNames.push(name.toLowerCase());
    }
  }
  return headerNames.sort();
}


function constructFilename(method, reqUrl, reqBody, reqHeaders) {
  if (!method) {
    method = 'GET';
  }

  filenameFilters.forEach(function(filter) {
    if (filter.url.test(reqUrl)) {
      reqUrl = filter.urlFilter(reqUrl);
      reqBody = filter.bodyFilter(reqBody);
    }
  });

  var hash = crypto.createHash('md5');
  var hashBody = {
    method: method,
    url: reqUrl,
    body: reqBody
  };

  reqHeaders = reqHeaders || {};

  if (includeCookieNames) {
    hashBody.cookies = parseCookiesNames(reqHeaders.cookie);
  }

  if (includeHeaderNames) {
    hashBody.headers = parseHeaderNames(reqHeaders);
  }

  hash.update(JSON.stringify(hashBody));

  var filename = hash.digest('hex');

  var language = reqHeaders && reqHeaders['accept-language'] || '';
  language = language.split(',')[0];

  // use a different folder for each language
  var folder = path.resolve(filenamePrefix, language);
  mkdirpSync(folder);

  var hashFile = path.join(folder, filename).toString();

  if (verbose) {
    var exists = fs.existsSync(hashFile + '.headers');
    if (exists) {
      logSuccess('====Cache Hit=====================================\n',
                  hashBody,
                  '\n=========================================\n',
                  'File: ', hashFile + '.headers',
                  '\n=========================================\n');
    } else {
      logError('====Cache Miss=====================================\n',
                  hashBody,
                  '\n=========================================\n',
                  'File: ', hashFile + '.headers',
                  '\n=========================================\n');
    }
  }

  return hashFile;
}

function urlFromHttpRequestOptions(options, protocol) {
  var urlOptions = {
    protocol: protocol,
    hostname: options.hostname || options.host,
    auth: options.auth,
    port: options.port,
    pathname: options.path
  };

  return url.format(urlOptions);
}

function addFilter(inFilter) {
  // Get rid of extraneous properties, and put in defaults.
  var filter = {};
  filter.url = inFilter.url || /.*/;
  filter.urlFilter = inFilter.urlFilter || function(url) { return url; };
  filter.bodyFilter = inFilter.bodyFilter || function(body) { return body; };

  filenameFilters.push(filter);
}



function log(color, args) {
  if (!verbose) {
    return;
  }

  var reset = '\033[0m';

  var args = Array.prototype.slice.call(args);
  args.unshift(color);

  args.push(reset);

  console.log.apply(console, args);

}
function logError() {
  log('\033[31m', arguments);
}
function logSuccess() {
  log('\033[32m', arguments);
}

module.exports.setFixtureDir = setFixtureDir;
module.exports.constructFilename = constructFilename;
module.exports.urlFromHttpRequestOptions = urlFromHttpRequestOptions;
module.exports.addFilter = addFilter;
module.exports.configure = configure;
module.exports.logSuccess = logSuccess;
module.exports.logError = logError;



