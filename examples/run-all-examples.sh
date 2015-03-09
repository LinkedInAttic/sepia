# Copyright 2013 LinkedIn Corp.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

G=`printf "\033[1;32m"`
N=`printf "\033[0m"`

start_test () {
  cat <<testname
${G}
--------------------------------------------------------------------------------
STARTING TEST: $1
--------------------------------------------------------------------------------
${N}
testname
}

rm -rf fixtures/ # no error if the fixtures directory doesn't exist

start_test 'basic HTTP request'
VCR_MODE=record   node examples/http
VCR_MODE=playback node examples/http

start_test 'request module'
rm -r fixtures/
VCR_MODE=record   node examples/request
VCR_MODE=playback node examples/request

start_test 'then-request module'
rm -r fixtures/
VCR_MODE=record   node examples/thenRequest
VCR_MODE=playback node examples/thenRequest

start_test 'cache mode'
rm -r fixtures/
VCR_MODE=cache node examples/cache

start_test 'unicode'
rm -r fixtures/
VCR_MODE=record   node examples/unicode
VCR_MODE=playback node examples/unicode

start_test 'language-specific directories'
rm -r fixtures/
VCR_MODE=record   node examples/languages
VCR_MODE=playback node examples/languages

start_test 'headers and cookie names'
rm -r fixtures/
VCR_MODE=cache node examples/headers

start_test 'url and body filters'
rm -r fixtures/
VCR_MODE=record   node examples/filters
VCR_MODE=playback node examples/filters

start_test 'setting a custom fixture directory'
rm -r fixtures/
VCR_MODE=record   node examples/fixtureDir
VCR_MODE=playback node examples/fixtureDir

start_test 'force live'
rm -r fixtures/
VCR_MODE=cache node examples/forceLive

start_test 'test-specific fixture directories'
rm -r fixtures/
VCR_MODE=cache node examples/testName
