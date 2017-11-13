// Requires
const http = require('http');
const httpProxy = require('http-proxy');

// Create a new reverse proxy
const proxy = httpProxy.createProxyServer();

// Create a new webserver
http.createServer((req,res) => {

  // Can we read the incoming url?
  let host = req.headers.host;
  let hostParts = host.split('.');
  let topDomain = hostParts.pop();
  let domain = hostParts.pop();
  let subDomain = hostParts.join('.');
  let urlParts = req.url.split('/');

  let port;

  if(subDomain == '' || subDomain == 'www'){
    port = 4001;
  }
  else if(subDomain == 'cooling'){
    port = 3000;
  }
  else {
    res.statusCode = 500;
    res.end('Can not find your app!');
  }

  if(port){
    proxy.web({target:'127.0.0.1:' + port});
  }

}).listen(80);
