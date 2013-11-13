switch (process.env.VCR_MODE) {
case 'record':
  var cache = require('./src/cache');
  cache.configure('record');
  require('./src/server');
  break;
case 'playback':
  var cache = require('./src/cache');
  cache.configure('playback');
  require('./src/server');
  break;
case 'cache':
  var cache = require('./src/cache');
  cache.configure('cache');
  require('./src/server');
  break;
// otherwise, leave http alone
}

var sepiaUtil = require('./src/util');
module.exports.filter = sepiaUtil.addFilter;
module.exports.fixtureDir = sepiaUtil.setFixtureDir;
module.exports.configure = sepiaUtil.configure;
