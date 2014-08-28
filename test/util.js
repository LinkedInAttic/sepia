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

var should = require('should');
var sinon = require('sinon');
var _ = require('lodash');
var path = require('path');

var sepiaUtil = require('../src/util');
var fs = require('fs');

describe('utils.js', function() {
  beforeEach(function() {
    sepiaUtil.reset();
  });

  describe('#addFilter', function() {
    const addFilter = sepiaUtil.addFilter;

    it('retains all recognized properties', function() {
      addFilter({
        url: /my-regex/,
        urlFilter: function(url) {
          return 'url-filtered: ' + url;
        },
        bodyFilter: function(body) {
          return 'body-filtered: ' + body;
        },
        forceLive: true,
        global: true
      });

      var filters = sepiaUtil.internal.globalOptions.filenameFilters;
      filters[0].url.source.should.equal('my-regex');
      filters[0].forceLive.should.equal(true);
      filters[0].global.should.equal(true);
      filters[0].urlFilter('my-url').should.equal('url-filtered: my-url');
      filters[0].bodyFilter('my-body').should.equal('body-filtered: my-body');
    });

    it('discards unknown properties', function() {
      addFilter({
        url: /filter-with-invalid-property/,
        invalid: 'invalid-property'
      });

      var filters = sepiaUtil.internal.globalOptions.filenameFilters;
      filters[0].url.source.should.equal('filter-with-invalid-property');
      filters[0].should.have.keys([
        'url',
        'urlFilter',
        'bodyFilter',
        'forceLive',
        'global'
      ]);
    });

    it('fills in defaults for missing properties', function() {
      addFilter({});

      var filters = sepiaUtil.internal.globalOptions.filenameFilters;
      filters[0].url.source.should.equal('.*');
      filters[0].forceLive.should.equal(false);
      filters[0].global.should.equal(false);
      filters[0].urlFilter('my-url').should.equal('my-url');
      filters[0].bodyFilter('my-body').should.equal('my-body');
    });
  });

  describe('#mkdirpSync', function() {
    const mkdirpSync = sepiaUtil.internal.mkdirpSync;

    beforeEach(function() {
      sinon.stub(fs, 'mkdirSync'); // mkdirSync becomes a noop
    });

    afterEach(function() {
      fs.mkdirSync.restore();
      fs.existsSync.restore();
    });

    it('creates each of the non-existent parent directories', function() {
      sinon.stub(fs, 'existsSync');
      fs.existsSync.withArgs('a/b/c/d').returns(false);
      fs.existsSync.withArgs('a/b/c').returns(false);
      fs.existsSync.withArgs('a/b').returns(true);
      fs.existsSync.withArgs('a').returns(true);

      mkdirpSync('a/b/c/d');
      fs.mkdirSync.callCount.should.equal(2);
      fs.mkdirSync.args[0][0].should.equal('a/b/c');
      fs.mkdirSync.args[1][0].should.equal('a/b/c/d');
    });
  });

  describe('#filterByWhitelist', function() {
    const filterByWhitelist = sepiaUtil.internal.filterByWhitelist;
    const original = ['a', 'b', 'c'];

    it('does not filter if the whitelist is empty', function() {
      var filtered = filterByWhitelist(original, []);
      filtered.should.eql(original);
    });

    it('only retains elements present in the whitelist', function() {
      var filtered = filterByWhitelist(original, ['a', 'c', 'd']);
      filtered.should.eql(['a', 'c']);
    });
  });

  describe('#removeInternalHeaders', function() {
    const removeInternalHeaders = sepiaUtil.removeInternalHeaders;

    it('returns undefined if the input is undefined', function() {
      var filtered = removeInternalHeaders();
      should.not.exist(filtered);
    });

    it('filters out only internal headers', function() {
      var filtered = removeInternalHeaders({
        a: 1,
        'x-sepia-internal': 2,
        b: 3
      });

      filtered.should.eql({
        a: 1,
        b: 3
      });
    });

    it('does not modify the original object', function() {
      var original = {
        a: 1,
        'x-sepia-internal': 2,
        b: 3
      };

      var input = _.cloneDeep(original);

      removeInternalHeaders(input);
      input.should.eql(original);
    });
  });

  describe('#usesGlobalFixtures', function() {
    const usesGlobalFixtures = sepiaUtil.internal.usesGlobalFixtures;

    it('returns false if there are no filters', function() {
      usesGlobalFixtures('my-url').should.equal(false);
    });

    it('returns false if there are no matching filters', function() {
      sepiaUtil.addFilter({
        url: /other-url/,
        global: true
      });

      sepiaUtil.addFilter({
        url: /another-url/,
        global: true
      });

      usesGlobalFixtures('my-url').should.equal(false);
    });

    it('returns false if no matching filters specify global', function() {
      sepiaUtil.addFilter({ url: /my/ });
      sepiaUtil.addFilter({ url: /url/ });

      usesGlobalFixtures('my-url').should.equal(false);
    });

    it('returns true if any matching filter specifies global', function() {
      sepiaUtil.addFilter({
        url: /my/,
        global: false
      });

      sepiaUtil.addFilter({
        url: /url/,
        global: true
      });

      sepiaUtil.addFilter({
        url: /my-url/,
        global: false
      });

      usesGlobalFixtures('my-url').should.equal(true);
    });
  });

  describe('#applyMatchingFilters', function() {
    const applyMatchingFilters = sepiaUtil.internal.applyMatchingFilters;

    function addTestFilter(pattern) {
      sepiaUtil.addFilter({
        url: new RegExp(pattern),
        urlFilter: function(url) {
          return pattern + '-url-filter: ' + url;
        },
        bodyFilter: function(body) {
          return pattern + '-body-filter: ' + body;
        }
      });
    }

    it('applies only filters that match', function() {
      addTestFilter('a');
      addTestFilter('b');

      var filtered = applyMatchingFilters('a', 'my-body');
      filtered.should.eql({
        filteredUrl: 'a-url-filter: a',
        filteredBody: 'a-body-filter: my-body'
      });
    });

    it('applies all matching the filters in order', function() {
      addTestFilter('d');
      addTestFilter('c');
      addTestFilter('b');
      addTestFilter('a');

      var filtered = applyMatchingFilters('abd', 'my-body');
      filtered.should.eql({
        filteredUrl: 'a-url-filter: b-url-filter: d-url-filter: abd',
        filteredBody: 'a-body-filter: b-body-filter: d-body-filter: my-body'
      });
    });

    it('applies multiple filters only if the original url matches',
      function() {
        sepiaUtil.addFilter({
          url: /a/,
          urlFilter: function() { return 'b'; }
        });

        sepiaUtil.addFilter({
          url: /b/,
          urlFilter: function() { return 'c'; }
        });

        var filtered = applyMatchingFilters('a', 'my-body');
        filtered.should.eql({
          filteredUrl: 'b',
          filteredBody: 'my-body'
        });
      });

    it('returns unfiltered values if there are no filters', function() {
      var filtered = applyMatchingFilters('my-url', 'my-body');
      filtered.should.eql({
        filteredUrl: 'my-url',
        filteredBody: 'my-body'
      });
    });
  });

  describe('#touchOnHit', function() {
    const touchOnHit = sepiaUtil.internal.touchOnHit;

    beforeEach(function() {
      sinon.stub(Date, 'now').returns('now');
      sinon.stub(fs, 'utimesSync'); // utimesSync becomes a noop
    });

    afterEach(function() {
      Date.now.restore();
      fs.utimesSync.restore();
      fs.existsSync.restore();
    });

    it('modifies the timestamp of the fixture file if it exists', function() {
      sinon.stub(fs, 'existsSync').returns(false);
      fs.existsSync.withArgs('my-filename.headers').returns(true);

      touchOnHit('my-filename');
      fs.utimesSync.calledWithExactly('my-filename.headers', 'now', 'now')
        .should.equal(true);
    });

    it('does nothing if the fixture file does not exist', function() {
      sinon.stub(fs, 'existsSync').returns(true);
      fs.existsSync.withArgs('my-filename.headers').returns(false);

      touchOnHit('my-filename');
      fs.utimesSync.called.should.equal(false);
    });

    it('does nothing if not configured touch on hits', function() {
      sepiaUtil.configure({ touchHits: false });
      sinon.stub(fs, 'existsSync').returns(true);

      touchOnHit('my-filename');
      fs.existsSync.called.should.equal(false);
      fs.utimesSync.called.should.equal(false);
    });
  });

  describe('#log', function() {
    const log = sepiaUtil.internal.log;

    beforeEach(function() {
      sinon.stub(console, 'log'); // console.log becomes a noop
    });

    afterEach(function() {
      console.log.restore();
    });

    it('logs the given message in the given color', function() {
      sepiaUtil.configure({ verbose: true });

      log('\033[31m', ['arg1', 'arg2']);
      console.log.calledWithExactly('\033[31m', 'arg1', 'arg2', '\033[0m')
        .should.equal(true);
    });

    it('does not log anything if in non-verbose mode', function() {
      sepiaUtil.configure({ verbose: false });

      log('\033[31m', 'arg1', 'arg2');
      console.log.called.should.equal(false);
    });
  });

  describe('#logFixtureStatus', function() {
    const logFixtureStatus = sepiaUtil.internal.logFixtureStatus;

    beforeEach(function() {
      sinon.stub(console, 'log'); // console.log becomes a noop
    });

    afterEach(function() {
      console.log.restore();
      fs.existsSync.restore();
    });

    it('logs a cache hit if the fixture exists', function() {
      sepiaUtil.configure({ verbose: true });
      sinon.stub(fs, 'existsSync').returns(false);
      fs.existsSync.withArgs('my-filename.headers').returns(true);

      logFixtureStatus('my-filename', 'my-hash-body');
      console.log.calledOnce.should.equal(true);
      console.log.args[0][0].should.equal('\033[1;32m');
      console.log.args[0][1].should.include('cache hit');
      console.log.args[0].should.include('my-filename.headers');
      console.log.args[0].should.include('my-hash-body');
    });

    it('logs a cache miss if the fixture does not exist', function() {
      sepiaUtil.configure({ verbose: true });
      sinon.stub(fs, 'existsSync').returns(true);
      fs.existsSync.withArgs('my-filename.headers').returns(false);

      logFixtureStatus('my-filename', 'my-hash-body');
      console.log.calledOnce.should.equal(true);
      console.log.args[0][0].should.equal('\033[1;31m');
      console.log.args[0][1].should.include('cache miss');
      console.log.args[0].should.include('my-filename.headers');
      console.log.args[0].should.include('my-hash-body');
    });

    it('does not log anything if in non-verbose mode', function() {
      sepiaUtil.configure({ verbose: false });
      sinon.stub(fs, 'existsSync').returns(true);

      logFixtureStatus('filename', 'my-hash-body');
      fs.existsSync.called.should.equal(false);
      console.log.called.should.equal(false);
    });
  });

  describe('#logFixtureDebugStatus', function() {
    const logFixtureDebugStatus = sepiaUtil.internal.logFixtureDebugStatus;

    beforeEach(function() {
      sinon.stub(console, 'log'); // console.log becomes a noop
    });

    afterEach(function() {
      console.log.restore();
      fs.existsSync.restore();
    });

    it('does not log anything if in non-verbose mode', function() {
      sepiaUtil.configure({ verbose: false });
      sinon.stub(fs, 'existsSync').returns(true);

      logFixtureDebugStatus('my-missing-filename', 'my-best-matching-fixture',
        'my-best-matching-fixture-file-hash');
      fs.existsSync.called.should.equal(false);
      console.log.called.should.equal(false);
    });

    it('logs a best matching fixture when verbose mode is true', function() {
      sepiaUtil.configure({ verbose: true });
      sinon.stub(fs, 'existsSync').returns(true);
      fs.existsSync.withArgs('my-filename.headers').returns(false);

      logFixtureDebugStatus('my-missing-filename', 'my-best-matching-fixture',
        'my-best-matching-fixture-file-hash');
      console.log.calledOnce.should.equal(true);
      console.log.args[0][0].should.equal('\033[1;34m');
      console.log.args[0][1].should.include('==== Best matching Fixture ====');
      console.log.args[0].should.include('my-missing-filename');
      console.log.args[0].should.include('my-best-matching-fixture');
      console.log.args[0].should.include('my-best-matching-fixture-file-hash');
    });
  });

  describe('#parseCookiesNames', function() {
    const parseCookiesNames = sepiaUtil.internal.parseCookiesNames;

    it('returns an empty list when there are no cookies', function() {
      parseCookiesNames().should.eql([]);
      parseCookiesNames('').should.eql([]);
    });

    it('parses out all cookie names when there is no whitelist', function() {
      parseCookiesNames('name1=value1; name2="value2"').should.eql([
        'name1',
        'name2'
      ]);
    });

    it('alphabetizes the cookie names', function() {
      parseCookiesNames('b=1; a=2; c=3').should.eql(['a', 'b', 'c']);
    });

    it('lower cases the cookie names', function() {
      parseCookiesNames('A=1; B=2; C=3').should.eql(['a', 'b', 'c']);
    });

    it('ignores invalid cookies', function() {
      parseCookiesNames('A=1; ; B=2; =3').should.eql(['a', 'b']);
    });

    it('filters by the whitelist if there is one', function() {
      sepiaUtil.configure({
        cookieWhitelist: ['a', 'b']
      });

      parseCookiesNames('a=1; b=2; c=3').should.eql(['a', 'b']);
    });
  });

  describe('#parseHeaderNames', function() {
    const parseHeaderNames = sepiaUtil.internal.parseHeaderNames;

    it('returns an empty list when there are no headers', function() {
      parseHeaderNames().should.eql([]);
      parseHeaderNames({}).should.eql([]);
    });

    it('parses out all header names when there is no whitelist', function() {
      parseHeaderNames({
        name1: 'value1',
        name2: 'value2'
      }).should.eql([
        'name1',
        'name2'
      ]);
    });

    it('alphabetizes the header names', function() {
      parseHeaderNames({
        b: 1,
        c: 2,
        a: 3
      }).should.eql(['a', 'b', 'c']);
    });

    it('lower cases the header names', function() {
      parseHeaderNames({
        A: 1,
        B: 2,
        C: 3
      }).should.eql(['a', 'b', 'c']);
    });

    it('filters by the whitelist if there is one', function() {
      sepiaUtil.configure({
        headerWhitelist: ['a', 'b']
      });

      parseHeaderNames({
        b: 1,
        c: 2,
        a: 3
      }).should.eql(['a', 'b']);
    });

    it('filters out sepia headers', function() {
      parseHeaderNames({
        b: 1,
        'x-sepia-internal-header': 2,
        a: 3
      }).should.eql(['a', 'b']);
    });
  });

  describe('#gatherFilenameHashParts', function() {
    const gatherFilenameHashParts = sepiaUtil.internal.gatherFilenameHashParts;

    const headers = {
      header1: 'value1',
      header2: 'value2',
      cookie: 'name3=value3; name4=value4'
    };

    it('gathers all non-header parts if not including headers', function() {
      sepiaUtil.configure({
        includeHeaderNames: false,
        includeCookieNames: false
      });

      var parts = gatherFilenameHashParts('post', 'my-url', 'my-body',
        headers);

      parts.should.eql([
        ['method', 'post'],
        ['url', 'my-url'],
        ['body', 'my-body'],
        ['headerNames', []],
        ['cookieNames', []]
      ]);
    });

    it('includes header names if requested', function() {
      sepiaUtil.configure({
        includeHeaderNames: true,
        includeCookieNames: false
      });

      var parts = gatherFilenameHashParts('post', 'my-url', 'my-body',
        headers);

      parts.should.eql([
        ['method', 'post'],
        ['url', 'my-url'],
        ['body', 'my-body'],
        ['headerNames', ['cookie', 'header1', 'header2']],
        ['cookieNames', []]
      ]);
    });

    it('includes cookie names if requested', function() {
      sepiaUtil.configure({
        includeHeaderNames: false,
        includeCookieNames: true
      });

      var parts = gatherFilenameHashParts('post', 'my-url', 'my-body',
        headers);

      parts.should.eql([
        ['method', 'post'],
        ['url', 'my-url'],
        ['body', 'my-body'],
        ['headerNames', []],
        ['cookieNames', ['name3', 'name4']]
      ]);
    });

    it('applies all filtering', function() {
      sepiaUtil.addFilter({
        urlFilter: function(url) {
          return 'url-filtered: ' + url;
        },
        bodyFilter: function(body) {
          return 'body-filtered: ' + body;
        }
      });

      var parts = gatherFilenameHashParts('post', 'my-url', 'my-body',
        headers);
      parts[1][1].should.equal('url-filtered: my-url');
      parts[2][1].should.equal('body-filtered: my-body');
    });

    it('defaults the method to "GET" if missing', function() {
      var parts = gatherFilenameHashParts(undefined, 'my-url', 'my-body',
        headers);
      parts[0][1].should.equal('get');

      parts = gatherFilenameHashParts('', 'my-url', 'my-body', headers);
      parts[0][1].should.equal('get');
    });

    it('lowercases the method', function() {
      var parts = gatherFilenameHashParts('POST', 'my-url', 'my-body',
        headers);
      parts[0][1].should.equal('post');
    });

    it('gracefully handles missing headers', function() {
      var parts = gatherFilenameHashParts('POST', 'my-url', 'my-body');

      parts.should.eql([
        ['method', 'post'],
        ['url', 'my-url'],
        ['body', 'my-body'],
        ['headerNames', []],
        ['cookieNames', []]
      ]);
    });
  });

  describe('#constructAndCreateFixtureFolder', function() {
    const constructAndCreateFixtureFolder =
      sepiaUtil.internal.constructAndCreateFixtureFolder;

    beforeEach(function() {
      sinon.stub(fs, 'mkdirSync'); // mkdirSync becomes a noop
      sinon.stub(fs, 'existsSync').returns(true);
    });

    afterEach(function() {
      fs.mkdirSync.restore();
      fs.existsSync.restore();
    });

    it('constructs a folder from all necessary information', function() {
      sepiaUtil.setFixtureDir('/global/fixture/dir');
      sepiaUtil.setTestOptions({ testName: 'test/name' });

      var folder = constructAndCreateFixtureFolder('my-url', {
        'accept-language': 'en-US'
      });

      folder.should.equal('/global/fixture/dir/en-US/test/name');
    });

    it('uses the "x-sepia-test-name" header as the test name', function() {
      sepiaUtil.setFixtureDir('/global/fixture/dir');
      // don't set the test name globally

      var folder = constructAndCreateFixtureFolder('my-url', {
        'accept-language': 'en-US',
        'x-sepia-test-name': 'test/name'
      });

      folder.should.equal('/global/fixture/dir/en-US/test/name');
    });

    it('favors the "x-sepia-test-name" header as the test name', function() {
      sepiaUtil.setFixtureDir('/global/fixture/dir');
      sepiaUtil.setTestOptions({ testName: 'global/test/name' });

      var folder = constructAndCreateFixtureFolder('my-url', {
        'accept-language': 'en-US',
        'x-sepia-test-name': 'test/name'
      });

      folder.should.equal('/global/fixture/dir/en-US/test/name');
    });

    it('ignores the test name if it should use global fixtures', function() {
      sepiaUtil.setFixtureDir('/global/fixture/dir');
      sepiaUtil.setTestOptions({ testName: 'test/name' });

      sepiaUtil.addFilter({
        url: /my-url/,
        global: true
      });

      var folder = constructAndCreateFixtureFolder('my-url', {
        'accept-language': 'en-US'
      });

      folder.should.equal('/global/fixture/dir/en-US');
    });

    it('picks out the first entry in the accept-language header', function() {
      sepiaUtil.setFixtureDir('/global/fixture/dir');
      sepiaUtil.setTestOptions({ testName: 'test/name' });

      var folder = constructAndCreateFixtureFolder('my-url', {
        'accept-language': 'de-DE,en-US'
      });

      folder.should.equal('/global/fixture/dir/de-DE/test/name');
    });

    it('gracefully handles no test name', function() {
      sepiaUtil.setFixtureDir('/global/fixture/dir');

      var folder = constructAndCreateFixtureFolder('my-url', {
        'accept-language': 'en-US'
      });

      folder.should.equal('/global/fixture/dir/en-US');
    });

    it('gracefully handles an invalid/missing accept-language header',
      function() {
        sepiaUtil.setFixtureDir('/global/fixture/dir');
        sepiaUtil.setTestOptions({ testName: 'test/name' });

        var folder = constructAndCreateFixtureFolder('my-url');
        folder.should.equal('/global/fixture/dir/test/name');

        folder = constructAndCreateFixtureFolder('my-url', {});
        folder.should.equal('/global/fixture/dir/test/name');

        folder = constructAndCreateFixtureFolder('my-url', {
          'accept-language': ''
        });
        folder.should.equal('/global/fixture/dir/test/name');
      });

    it('creates the constructed folder', function() {
      sepiaUtil.setFixtureDir('global/fixture/dir');
      sepiaUtil.setTestOptions({ testName: 'test/name' });

      var folder = constructAndCreateFixtureFolder('my-url', {
        'accept-language': 'en-US'
      });

      fs.existsSync.calledWith(folder).should.equal(true);
    });
  });

  describe('#constructFilename', function() {
    // The fixture filenames in these tests are computed by hand for the
    // purposes of verification.
    const constructFilename = sepiaUtil.constructFilename;

    beforeEach(function() {
      sinon.stub(fs, 'mkdirSync'); // mkdirSync becomes a noop
      sinon.stub(fs, 'utimesSync'); // utimesSync becomes a noop
      sinon.stub(fs, 'existsSync').returns(true);
    });

    afterEach(function() {
      fs.mkdirSync.restore();
      fs.utimesSync.restore();
      fs.existsSync.restore();
    });


    it('constructs using all the available information', function() {
      sepiaUtil.setFixtureDir('/global/fixture/dir');
      sepiaUtil.setTestOptions({ testName: 'test/name' });

      var filename = constructFilename('get', 'my-url', 'my-body', {
        'accept-language': 'en-US',
        header1: 'value1',
        cookie: 'cookie1=value1'
      });

      filename.should.equal('/global/fixture/dir/en-US/test/name/' +
        '32772f774a3f187d465d47a526b80e6f');
    });
  });

  describe('#urlFromHttpRequestOptions', function() {
    const urlFromHttpRequestOptions = sepiaUtil.urlFromHttpRequestOptions;

    it('returns a formatted url based on the options', function() {
      urlFromHttpRequestOptions(
        {
          hostname: 'my-hostname',
          auth: 'my-user:my-pass',
          port: '1234',
          path: '/my/path'
        },
        'https'
      ).should.equal('https://my-user:my-pass@my-hostname:1234/my/path');
    });

    it('accepts "host" instead of "hostname"', function() {
      urlFromHttpRequestOptions(
        {
          host: 'my-hostname',
          path: '/my/path'
        },
        'https'
      ).should.equal('https://my-hostname/my/path');
    });

    it('parses ? properly"', function() {
      urlFromHttpRequestOptions(
        {
          host: 'my-hostname',
          path: '/my/path?foo=bar'
        },
        'https'
      ).should.equal('https://my-hostname/my/path?foo=bar');
    });
  });

  describe('#shouldForceLive', function() {
    const shouldForceLive = sepiaUtil.shouldForceLive;

    it('returns false if there are no filters', function() {
      shouldForceLive('my-url').should.equal(false);
    });

    it('returns false if there are no matching filters', function() {
      sepiaUtil.addFilter({
        url: /other-url/,
        forceLive: true
      });

      sepiaUtil.addFilter({
        url: /another-url/,
        forceLive: true
      });

      shouldForceLive('my-url').should.equal(false);
    });

    it('returns false if no matching filters specify forceLive', function() {
      sepiaUtil.addFilter({ url: /my/ });
      sepiaUtil.addFilter({ url: /url/ });

      shouldForceLive('my-url').should.equal(false);
    });

    it('returns true if any matching filter specifies forceLive', function() {
      sepiaUtil.addFilter({
        url: /my/,
        forceLive: false
      });

      sepiaUtil.addFilter({
        url: /url/,
        forceLive: true
      });

      sepiaUtil.addFilter({
        url: /my-url/,
        forceLive: false
      });

      shouldForceLive('my-url').should.equal(true);
    });
  });

  describe('#findTheBestMatchingFixture', function() {

    beforeEach(function() {
      sinon.stub(fs, 'readFileSync');
      sinon.stub(fs, 'readdirSync');
    });

    it('finds the best matching fixture', function() {
      var missingFile = 'missingFile.missing';
      var missingFileData = JSON.stringify({
        url: 'http://mysite.com',
        method: 'POST',
        body: 'missing file'
      });
      var RequestOneFileData = JSON.stringify({
        url: 'http://mysite.com',
        method: 'POST',
        body: 'Some different request'
      });
      var RequestTwoFileData = JSON.stringify({
        url: 'http://mysite.com',
        method: 'POST',
        body: 'missing file 0123'
      });
      var filesArr = ['requestOne.request', 'requestTwo.request'] ;

      fs.readFileSync.withArgs(path.resolve('missingFile.missing'))
        .returns(missingFileData);
      fs.readFileSync.withArgs(path.resolve('requestOne.request'))
        .returns(RequestOneFileData);
      fs.readFileSync.withArgs(path.resolve('requestTwo.request'))
        .returns(RequestTwoFileData);
      fs.readdirSync.returns(filesArr);

      var fixture = sepiaUtil.findTheBestMatchingFixture(missingFile);
      fixture.should.include('requestTwo.request');
    });

    it('finds the best matching fixture, with the same host only', function() {
      var missingFile = 'missingFile.missing';
      var missingFileData = JSON.stringify({
        url: 'http://mysite.com',
        method: 'POST',
        body: 'missing file'
      });
      var RequestOneFileData = JSON.stringify({
        url: 'http://mysite.com',
        method: 'POST',
        body: 'Some different request'
      });
      var RequestTwoFileData = JSON.stringify({
        url: 'http://mysite2.com',
        method: 'POST',
        body: 'missing file'
      });
      var filesArr = ['requestOne.request', 'requestTwo.request'] ;

      fs.readFileSync.withArgs(path.resolve('missingFile.missing'))
        .returns(missingFileData);
      fs.readFileSync.withArgs(path.resolve('requestOne.request'))
        .returns(RequestOneFileData);
      fs.readFileSync.withArgs(path.resolve('requestTwo.request'))
        .returns(RequestTwoFileData);
      fs.readdirSync.returns(filesArr);

      var fixture = sepiaUtil.findTheBestMatchingFixture(missingFile);
      fixture.should.include('requestOne.request');
    });

    it('returns null when there is no match', function() {
      var missingFile = 'missingFile.missing';
      var missingFileData = JSON.stringify({
        url: 'http://mysite.com',
        method: 'POST',
        body: 'missing file'
      });
      var RequestOneFileData = JSON.stringify({
        url: 'http://mysite1.com',
        method: 'POST',
        body: 'Some different request'
      });
      var RequestTwoFileData = JSON.stringify({
        url: 'http://mysite2.com',
        method: 'POST',
        body: 'missing file'
      });
      var filesArr = ['requestOne.request', 'requestTwo.request'] ;

      fs.readFileSync.withArgs(path.resolve('missingFile.missing'))
        .returns(missingFileData);
      fs.readFileSync.withArgs(path.resolve('requestOne.request'))
        .returns(RequestOneFileData);
      fs.readFileSync.withArgs(path.resolve('requestTwo.request'))
        .returns(RequestTwoFileData);
      fs.readdirSync.returns(filesArr);

      var fixture = sepiaUtil.findTheBestMatchingFixture(missingFile);
      should.not.exist(fixture);
    });


    afterEach(function() {
      fs.readFileSync.restore();
      fs.readdirSync.restore();
    });

  });
});

