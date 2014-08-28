require('should');
var cache = require('../src/cache');
var sinon = require('sinon');
var fs = require('fs');

describe('cache.js', function() {

  describe('#writeRequestFile', function() {

    before(function() {
      sinon.stub(fs, 'writeFileSync');
    });

    var requestData = {
      data: 'data'
    };

    it('should write the request to the file', function() {
      cache.internal.writeRequestFile(requestData, 'myrequest');
      fs.writeFileSync.called.should.equal(true);
      fs.writeFileSync.calledWith('myrequest.request',
        JSON.stringify(requestData, null, 2)).should.equal(true);
    });

    after(function() {
      fs.writeFileSync.restore();
    });

  });
});
