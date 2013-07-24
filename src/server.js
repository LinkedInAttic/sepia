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

// exit hook to close http server
process.on('SIGTERM', function() {
  httpServer.close();
});
