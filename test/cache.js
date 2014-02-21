var should = require('should');
var cache = require('../src/cache');
var sinon = require('sinon');
var fs = require('fs');


describe('cache.js', function() {

  describe('#writeRequests', function() {

    before(function() {
      sinon.stub(fs, 'writeFileSync');
    });

    var requestData = {
      url: 'reqUrl',
      method: 'GET',
      headers: 'headers',
      body: 'body'
    };

    it('writeRequests', function() {
      cache.internal.writeRequestFile(requestData, 'abc');
      fs.writeFileSync.called.should.equal(true);
    });

    after(function() {
      fs.writeFileSync.restore();
    });

  });
});