require('should');

function ensureNonCacheMode(filename) {
  if (process.env.VCR_MODE === 'cache') {
    throw new Error('cannot run ' + filename + ' in cache mode');
  }
}

function shouldBeFast(time) {
  time.should.be.below(10);
}

function shouldBeSlow(time) {
  time.should.be.above(500);
}

function shouldBeDynamicallyTimed(time) {
  switch (process.env.VCR_MODE) {
  case 'record':
    shouldBeSlow(time);
    break;
  case 'playback':
    shouldBeFast(time);
    break;
  case 'cache':
    // We can't run a dynamically timed automated test in cache mode because
    // the state of the fixtures directory is undefined.
    throw new Error('cannot run this test in cache mode');
  default:
    shouldBeSlow(time);
  }
}

function shouldUseCache(cacheHitExpected, time) {
  if (cacheHitExpected) {
    shouldBeFast(time);
  } else {
    shouldBeSlow(time);
  }
}

function verify(testFn) {
  try {
    testFn();
    console.log('\033[1;32mSUCCESS\033[0m');
  } catch (err) {
    console.log('\033[1;31m' + err.stack + '\033[0m');
  }
}

module.exports.ensureNonCacheMode = ensureNonCacheMode;
module.exports.shouldBeFast = shouldBeFast;
module.exports.shouldBeSlow = shouldBeSlow;
module.exports.shouldBeDynamicallyTimed = shouldBeDynamicallyTimed;
module.exports.shouldUseCache = shouldUseCache;
module.exports.verify = verify;
