// Requires
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

// Read our routes
const routes = require('./routing.json');

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

  // Routing
  let host = req.headers.host,
      url = req.url,
      portToUse;

  url += (url.substr(-1) != '/' ? '/' : '');

  for(let route in routes){
    let port = routes[route];
    if(route.includes('/')){
      route += (route.substr(-1) != '/' ? '/' : '')
    }
    if(route == host){
      portToUse = port;
    }
    else if (url != '/' && route.indexOf(host + url) == 0){
      portToUse = port;
    }
  }

  // Redirects
  if(portToUse && portToUse.redirect){
    let url = 'https://' + portToUse.redirect;
    res.writeHead(301, {'Location': url});
    res.end();
  }

  // Serve the correct app for a domain
  else if (portToUse){
    proxy.web(req,res,{target:'http://127.0.0.1:' + portToUse});
  }
  else {
    res.statusCode = 404;
    res.end('No such url!');
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

    // security related
    res.setHeader('strict-transport-security','max-age=31536000; includeSubDomains; preload');
    res.setHeader('x-frame-options','SAMEORIGIN');
    res.setHeader('x-xss-protection', '1');
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('content-security-policy',"default-src * 'unsafe-inline' 'unsafe-eval'");

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

function renewCerts(){

  exec('certbot renew',(error,stdOut,stdError)=>{
    console.log('renewing certs',stdOut);
    certs = readCerts('/etc/letsencrypt/live');
  });

}

// Renew certs if needed on start
renewCerts();
// and then once every day
setInterval(renewCerts, 1000 * 60 * 60 * 24);

