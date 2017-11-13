// Requires
const http = require('http');
const httpProxy = require('http-proxy');

// Create a new reverse proxy
const proxy = httpProxy.createProxyServer();

// Handle proxy errors - thus not breaking the whole
// reverse-proxy app if an app doesn't answer
proxy.on('error',function(e){
  console.log('Proxy error', Date.now(), e);
})

// Create a new webserver
http.createServer((req,res) => {

  // Set/replace response headers
  setResponseHeaders(req,res);

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
    proxy.web(req,res,{target:'http://127.0.0.1:' + port});
  }

}).listen(80);


function setResponseHeaders(req,res){

  // there is a built in node function called res.writeHead
  // that writes http response headers
  // store that function in another property
  res.oldWriteHead = res.writeHead;

  // and then replace it with our function
  res.writeHead = function(statusCode, headers){

    // set/replace our own headers
    res.setHeader('x-powered-by','Thomas supercoola server');

    // call the original write head function as well
    res.oldWriteHead(statusCode,headers);
  }

}

