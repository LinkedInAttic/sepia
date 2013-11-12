require('should');

var sepiaUtil = require('../src/util');

describe('utils.js', function() {
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
});
