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

var http = require('http');
var sepiaUtil = require('./util');

var httpServer = http.createServer(function(req, res) {
  req.setEncoding('utf-8');
  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });

  req.on('end', function() {
    var status = 404;
    if (/^\/testOptions/.test(req.url)) {
      var testOptions = JSON.parse(body);
      sepiaUtil.setTestOptions(testOptions);
      status = 200;
    }
    res.writeHead(status);
    res.end();
  });

}).listen(58080, '0.0.0.0');

function shutdown(next) {
  httpServer.close(next);
}

// exit hook to close http server
process.on('SIGTERM', function() {
  shutdown();
});

module.exports.shutdown = shutdown;
