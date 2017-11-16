// Requires
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

// Read all certs from certbot into an object
let certs = readCerts("/etc/letsencrypt/live");

// Create a new reverse proxy
const proxy = httpProxy.createProxyServer();

// Handle proxy errors - thus not breaking the whole
// reverse-proxy app if an app doesn't answer
proxy.on('error',function(e){
  console.log('Proxy error', Date.now(), e);
})

// Create a new unencrypted webserver
// with the purpose to answer certbot challenges
// and redirect all other traffic to https
http.createServer((req,res)=>{

  let urlParts = req.url.split('/');

  if(urlParts[1] == '.well-known'){
    // using certbot-helper on port 5000
    proxy.web(req,res,{target:'http://127.0.0.1:5000'});
  }
  else {
    // redirect to https
    let url = 'https://' + req.headers.host + req.url;
    res.writeHead(301, {'Location': url});
    res.end();
  }

}).listen(80);

// Create a new secure webserver
https.createServer({
  // SNICallback let's us get the correct cert
  // depening on what the domain the user asks for
  SNICallback: (domain, callback) => callback(
    certs[domain] ? null : new Error('No such cert'),
    certs[domain] ? certs[domain].secureContext : null
  ),
  // But we still have the server with a "default" cert
  key: certs['datafreaksimalmo.se'].key,
  cert: certs['datafreaksimalmo.se'].cert
},(req,res) => {

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
    port = 4001; // app: testapp
  }
  else if(subDomain == 'cooling'){
    port = 3000; // app: example
  }
  else {
    res.statusCode = 500;
    res.end('Can not find your app!');
  }

  if(port){
    proxy.web(req,res,{target:'http://127.0.0.1:' + port});
  }

}).listen(443);


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

function readCerts(pathToCerts){

  let certs = {},
      domains = fs.readdirSync(pathToCerts);

  // Read all ssl certs into memory from file
  for(let domain of domains){
    let domainName = domain.split('-0')[0];
    certs[domainName] = {
      key:  fs.readFileSync(path.join(pathToCerts,domain,'privkey.pem')),
      cert: fs.readFileSync(path.join(pathToCerts,domain,'fullchain.pem'))
    };
    certs[domainName].secureContext = tls.createSecureContext(certs[domainName]);
  }

  return certs;

}
