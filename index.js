switch (process.env.VCR_MODE) {
case 'record':
  var cache = require('./src/cache');
  cache.configure({record: true, playback: false});
  require('./src/server');
  break;
case 'playback':
  var cache = require('./src/cache');
  cache.configure({playback: true, record: false});
  require('./src/server');
  break;
case 'playback_timed':
  var cache = require('./src/cache');
  cache.configure({playback: true, record: false, emulateTiming: true});
  require('./src/server');
  break;
case 'cache':
  require('./src/cache');
  require('./src/server');
  break;
// otherwise, leave http alone
}

var sepiaUtil = require('./src/util');
module.exports.filter = sepiaUtil.addFilter;
module.exports.fixtureDir = sepiaUtil.setFixtureDir;
module.exports.configure = sepiaUtil.configure;
