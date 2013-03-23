switch (process.env.VCR_MODE) {
case 'record':
  require('./src/recorder');
  break;
case 'playback':
  require('./src/playback');
  break;
case 'cache':
  require('./src/cache');
  break;
// otherwise, leave http alone
}

var sepiaUtil = require('./src/util');
module.exports.filter = sepiaUtil.addFilter;
module.exports.fixtureDir = sepiaUtil.setFixtureDir;
