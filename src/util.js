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

var url = require('url');
var path = require('path');
var crypto = require('crypto');
var fs = require('fs');
var Levenshtein = require('levenshtein');

const COLOR_RESET = '\033[0m';
const COLOR_RED_BOLD = '\033[1;31m';
const COLOR_GREEN_BOLD = '\033[1;32m';
const COLOR_BLUE_BOLD = '\033[1;34m';

// -- GLOBAL STATE HANDLING ----------------------------------------------------

var globalOptions = {};

function reset() {
  globalOptions.filenamePrefix =
    path.join(process.cwd(), 'fixtures/generated');

  globalOptions.filenameFilters = [];

  globalOptions.includeHeaderNames = true;
  globalOptions.headerWhitelist = [];

  globalOptions.includeCookieNames = true;
  globalOptions.cookieWhitelist = [];

  globalOptions.verbose = false;

  // touch the cached file every time its used
  globalOptions.touchHits = true;

  // debug support to find the best matching fixture
  globalOptions.debug = false;

  // These test options are set via an HTTP request to the embedded HTTP server
  // provided by sepia. The options are reset each time any of them are set.
  globalOptions.testOptions = {};
}

// automatically reset the state of the module when 'required'.
reset();

function configure(options) {
  if (options.includeHeaderNames != null) {
    globalOptions.includeHeaderNames = options.includeHeaderNames;
  }

  if (options.headerWhitelist != null) {
    globalOptions.headerWhitelist = options.headerWhitelist.map(
      function(item) {
        return item.toLowerCase();
      }
    );
  }

  if (options.includeCookieNames != null) {
    globalOptions.includeCookieNames = options.includeCookieNames;
  }

  if (options.cookieWhitelist != null) {
    globalOptions.cookieWhitelist = options.cookieWhitelist.map(
      function(item) {
        return item.toLowerCase();
      }
    );
  }

  if (options.verbose != null) {
    globalOptions.verbose = options.verbose;
  }

  if (options.touchHits != null) {
    globalOptions.touchHits = options.touchHits;
  }

  if (options.debug != null) {
    globalOptions.debug = options.debug;
  }
}

// This is a commonly-used option, and thus, it should have its own function to
// set its value.
function setFixtureDir(fixtureDir) {
  globalOptions.filenamePrefix = fixtureDir;
}

function setTestOptions(options) {
  globalOptions.testOptions = {};
  globalOptions.testOptions.testName = options.testName;
}

function addFilter(inFilter) {
  // Get rid of extraneous properties, and put in defaults.
  var filter = {};
  filter.url = inFilter.url || /.*/;
  filter.urlFilter = inFilter.urlFilter || function(url) { return url; };
  filter.bodyFilter = inFilter.bodyFilter || function(body) { return body; };
  filter.forceLive = inFilter.forceLive || false;
  filter.global = inFilter.global || false;

  globalOptions.filenameFilters.push(filter);
}

// -- UTILITY FUNCTIONS --------------------------------------------------------

function mkdirpSync(folder) {
  if (!fs.existsSync(path.dirname(folder))) {
    mkdirpSync(path.dirname(folder));
  }

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, '0755');
  }
}

function filterByWhitelist(list, whitelist) {
  if (whitelist.length === 0) {
    return list;
  }

  return list.filter(function(item) {
    return whitelist.indexOf(item) >= 0;
  });
}

function removeInternalHeaders(headers) {
  if (!headers) {
    return;
  }

  var filtered = {};

  for (var key in headers) {
    if (key.indexOf('x-sepia-') !== 0) {
      filtered[key] = headers[key];
    }
  }

  return filtered;
}

function applyMatchingFilters(reqUrl, reqBody) {
  var filteredUrl = reqUrl;
  var filteredBody = reqBody;

  globalOptions.filenameFilters.forEach(function(filter) {
    if (filter.url.test(reqUrl)) {
      filteredUrl = filter.urlFilter(filteredUrl);
      filteredBody = filter.bodyFilter(filteredBody);
    }
  });

  return {
    filteredUrl: filteredUrl,
    filteredBody: filteredBody
  };
}

function touchOnHit(filename) {
  if (!globalOptions.touchHits) {
    return;
  }

  filename = filename + '.headers';
  var now = Date.now();

  if (fs.existsSync(filename)) {
    fs.utimesSync(filename, now, now);
  }
}

function usesGlobalFixtures(reqUrl) {
  return globalOptions.filenameFilters.some(function(filter) {
    return filter.global && filter.url.test(reqUrl);
  });
}

// -- LOGGING ------------------------------------------------------------------

function log(color, args) {
  if (!globalOptions.verbose) {
    return;
  }

  var args = Array.prototype.slice.call(args);
  args.unshift(color);
  args.push(COLOR_RESET);

  console.log.apply(console, args);
}

function logFixtureStatus(filename, filenameParts) {
  if (!globalOptions.verbose) {
    return;
  }

  filename = filename + '.headers';

  if (fs.existsSync(filename)) {
    log(COLOR_GREEN_BOLD, [
      '\n ====[ cache hit  ]====\n',
      filenameParts, '\n',
      'filename:', filename, '\n',
      '======================\n'
    ]);
  } else {
    log(COLOR_RED_BOLD, [
      '\n ====[ cache miss ]====\n',
      filenameParts, '\n',
      'filename:', filename, '\n',
      '======================\n'
    ]);
  }
}

function logFixtureDebugStatus(filename, bestMatchingFixture, fileHash) {
  if (!globalOptions.verbose) {
    return;
  }

  // Print the hashParts
  log(COLOR_BLUE_BOLD, [
    '\n ==== Best matching Fixture ====\n',
    'to :', filename,  '\n',
    'filename:', bestMatchingFixture, '\n\n',
    'hashParts:', fileHash, '\n',
    '======================\n'
  ]);
}

// -- FILENAME CONSTRUCTION ----------------------------------------------------

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

  cookies = filterByWhitelist(cookies, globalOptions.cookieWhitelist);
  return cookies.sort();
}

function parseHeaderNames(headers) {
  headers = removeInternalHeaders(headers);

  var headerNames = [];
  for (var name in headers) {
    if (headers.hasOwnProperty(name)) {
      headerNames.push(name.toLowerCase());
    }
  }

  headerNames = filterByWhitelist(headerNames, globalOptions.headerWhitelist);
  return headerNames.sort();
}

function gatherFilenameHashParts(method, reqUrl, reqBody, reqHeaders) {
  method = (method || 'get').toLowerCase();
  reqHeaders = reqHeaders || {};

  var filtered = applyMatchingFilters(reqUrl, reqBody);

  var headerNames = [];
  if (globalOptions.includeHeaderNames) {
    headerNames = parseHeaderNames(reqHeaders);
  }

  var cookieNames = [];
  if (globalOptions.includeCookieNames) {
    cookieNames = parseCookiesNames(reqHeaders.cookie);
  }

  // While an object would be the most natural way of gathering this
  // information, we shouldn't rely on JSON.stringify to serialize the keys of
  // an object in any specific order. Thus, we must be careful to use only an
  // ordered data structure, i.e. an array.
  return [
    ['method', method],
    ['url', filtered.filteredUrl],
    ['body', filtered.filteredBody],
    ['headerNames', headerNames],
    ['cookieNames', cookieNames]
  ];
}

function constructAndCreateFixtureFolder(reqUrl, reqHeaders) {
  reqHeaders = reqHeaders || {};

  var language = reqHeaders['accept-language'] || '';
  language = language.split(',')[0];

  var testFolder = '';
  if (!usesGlobalFixtures(reqUrl)){
    if (reqHeaders['x-sepia-test-name']) {
      testFolder = reqHeaders['x-sepia-test-name'];
    } else if (globalOptions.testOptions.testName) {
      testFolder = globalOptions.testOptions.testName;
    }
  }

  var folder = path.resolve(globalOptions.filenamePrefix, language,
    testFolder);
  mkdirpSync(folder);

  return folder;
}

function constructFilename(method, reqUrl, reqBody, reqHeaders) {
  var hashParts = gatherFilenameHashParts(method, reqUrl, reqBody, reqHeaders);

  var hash = crypto.createHash('md5');
  hash.update(JSON.stringify(hashParts));

  var filename = hash.digest('hex');
  var folder = constructAndCreateFixtureFolder(reqUrl, reqHeaders);
  var hashFile = path.join(folder, filename).toString();

  logFixtureStatus(hashFile, hashParts);
  touchOnHit(hashFile);

  return hashFile;
}

function findTheBestMatchingFixture(filename) {

  var bestMatchingFixture = null;
  var bestFileHash = null;
  var lowestStringDistance = 0.0;
  var currentDir = path.dirname(filename);
  var currentFile, requestHash, fileHash;

  var missingFileData = fs.readFileSync(path.resolve(filename));
  missingFileData = JSON.parse(missingFileData.toString());

  requestHash =
    gatherFilenameHashParts(missingFileData.method, missingFileData.url,
     missingFileData.body, missingFileData.headers);

  var files = fs.readdirSync(currentDir);
  var reqUrlDomain = url.parse(missingFileData.url).host;

  try {
    for (var i in files) {
      if (files[i].split('.').pop() === 'request') {
        currentFile = currentDir + '/' + files[i];
        var data = fs.readFileSync(path.resolve(currentFile));

        // Compute the string distance with the .missing request body
        data = JSON.parse(data.toString());
        fileHash = gatherFilenameHashParts(data.method, data.url,
          data.body, data.headers);
        var urlDomain = url.parse(data.url).host;
        if (urlDomain === reqUrlDomain) {
          var ldist = new Levenshtein(fileHash.toString(),
            requestHash.toString());
          if (bestMatchingFixture === null || ldist < lowestStringDistance) {
            bestMatchingFixture = currentFile;
            bestFileHash = fileHash;
            lowestStringDistance = ldist;
          }
        }
      }
    }
  } catch (e) {
    throw new Error('Error computing the best matching fixture for ' +
      filename + ' ' + e);
  }

  // Log the Fixture Debug Status
  logFixtureDebugStatus(filename, bestMatchingFixture, bestFileHash);
  return bestMatchingFixture;
}

// -- CONVENIENCE FUNCTIONS ----------------------------------------------------

function urlFromHttpRequestOptions(options, protocol) {
  var parsedPath = options.path.split('?');
  var pathname = parsedPath.shift();
  var search = parsedPath.join('?');

  var urlOptions = {
    protocol: protocol,
    hostname: options.hostname || options.host,
    auth: options.auth,
    port: options.port,
    pathname: pathname,
    search: search
  };

  return url.format(urlOptions);
}

function shouldForceLive(reqUrl) {
  return globalOptions.filenameFilters.some(function(filter) {
    return filter.forceLive && filter.url.test(reqUrl);
  });
}

function shouldFindMatchingFixtures() {
  return globalOptions.debug;
}

module.exports.reset = reset;
module.exports.configure = configure;
module.exports.setFixtureDir = setFixtureDir;
module.exports.setTestOptions = setTestOptions;
module.exports.addFilter = addFilter;
module.exports.constructFilename = constructFilename;
module.exports.urlFromHttpRequestOptions = urlFromHttpRequestOptions;
module.exports.shouldForceLive = shouldForceLive;
module.exports.removeInternalHeaders = removeInternalHeaders;
module.exports.findTheBestMatchingFixture = findTheBestMatchingFixture;
module.exports.shouldFindMatchingFixtures = shouldFindMatchingFixtures;

module.exports.internal = {};
module.exports.internal.globalOptions = globalOptions;
module.exports.internal.mkdirpSync = mkdirpSync;
module.exports.internal.filterByWhitelist = filterByWhitelist;
module.exports.internal.usesGlobalFixtures = usesGlobalFixtures;
module.exports.internal.touchOnHit = touchOnHit;
module.exports.internal.log = log;
module.exports.internal.logFixtureStatus = logFixtureStatus;
module.exports.internal.logFixtureDebugStatus = logFixtureDebugStatus;
module.exports.internal.parseCookiesNames = parseCookiesNames;
module.exports.internal.parseHeaderNames = parseHeaderNames;
module.exports.internal.applyMatchingFilters = applyMatchingFilters;
module.exports.internal.gatherFilenameHashParts = gatherFilenameHashParts;
module.exports.internal.constructAndCreateFixtureFolder =
  constructAndCreateFixtureFolder;
