switch (process.env.VCR_MODE) {
case 'record':
  var cache = require('./src/cache');
  cache.configure({record: true, playback: false});
  break;
case 'playback':
  var cache = require('./src/cache');
  cache.configure({playback: true, record: false});
  break;
case 'playback_timed':
  var cache = require('./src/cache');
  cache.configure({playback: true, record: false, emulateTiming: true});
  break;
case 'cache':
  require('./src/cache');
  break;
// otherwise, leave http alone
}

var sepiaUtil = require('./src/util');
module.exports.filter = sepiaUtil.addFilter;
module.exports.fixtureDir = sepiaUtil.setFixtureDir;
module.exports.configure = sepiaUtil.configure;