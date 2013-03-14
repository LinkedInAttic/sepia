var url = require('url');
var path = require('path');
var crypto = require('crypto');
var fs = require('fs');

var filenamePrefix = path.join(process.cwd(), 'fixtures/generated');

var filenameFilters = [];

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

function constructFilename(reqUrl, reqBody, reqHeaders) {
  filenameFilters.forEach(function(filter) {
    if (filter.url.test(reqUrl)) {
      reqUrl = filter.urlFilter(reqUrl);
      reqBody = filter.bodyFilter(reqBody);
    }
  });

  var hash = crypto.createHash('md5');
  hash.update(reqBody);
  hash.update(reqUrl);

  var filename = hash.digest('hex');

  var language = reqHeaders && reqHeaders['accept-language'] || '';
  language = language.split(',')[0];

  // use a different folder for each language
  var folder = path.resolve(filenamePrefix, language);
  mkdirpSync(folder);

  return path.join(folder, filename);
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
  filter.bodyFilter = inFilter.bodyFilter || function(url) { return url; };

  filenameFilters.push(filter);
}

module.exports.setFixtureDir = setFixtureDir;
module.exports.constructFilename = constructFilename;
module.exports.urlFromHttpRequestOptions = urlFromHttpRequestOptions;
module.exports.addFilter = addFilter;
