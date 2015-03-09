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

require('should');

function ensureNonCacheMode(filename) {
  if (process.env.VCR_MODE === 'cache') {
    throw new Error('cannot run ' + filename + ' in cache mode');
  }
}

function shouldBeFast(time) {
  time.should.be.below(25);
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
