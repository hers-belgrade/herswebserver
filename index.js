var Connect = require ('connect');
var HersData = require('hersdata');
var Url = require('url');
var Path = require('path');
function WebServer (root) {
	this.root = root;
	this.fmap = undefined;
}

WebServer.prototype.init = function (data) {
	try {
		var module_name = data.module_name;
		this.fmap = undefined;
		this.fmap = this.master.attach(module_name, data.config);
	}catch (e) {
		console.error(e.stack());
		return e.toString();
	}
}

WebServer.prototype.error_log = function (s) {
	console.error(s);
}

WebServer.prototype.start = function (port) {
	port = port || 80;
	this.master = new HersData.Hive ();
	var self = this;

	var map_resolver = function (req, res, next) {
		var url = req.url;
		function report_error (s) {
      if(!res.writable){return;}
			self.error_log(s);
			res.writeHead(503,{'Content-Type':'text/plain'});
			res.end();
		}
		function report_end (code, s) {
      if(!res.writable){return;}
			var header = {'Content-Type':'text/plain'};
			if (s) header['Content-Length']= s.length;
			res.writeHead(code,header);
			res.write(s);
			res.end();
		}
    function dump(s){
      report_end (200,JSON.stringify(s));
    }

    var purl = Url.parse(url,true);
    var urlpath = purl.pathname; //"including the leading slash if present" so we'll remove it if present...
    if(urlpath[0]==='/'){urlpath = urlpath.slice(1);}

		if (urlpath.indexOf('.') > -1) { next(); return; }

		if (req.method != 'GET' && req.method != 'POST') return report_end(503);
		var data = ((req.method == 'GET') ? req.query : req.body) || {};
		if (urlpath === 'init') {
      if(typeof data.name === 'undefined'){
        return report_error('Missing parameters');
      }
      var fname = data.name;
      delete data.name;
      var key = data.key;
      delete data.key;
      var environmentmodulename = data.environment;
      delete data.environment;
      var conf;
      if(typeof data.config !== 'undefined'){
        try{
          conf = JSON.parse(data.config);
          console.log('initing with conf',conf);
        }
        catch(e){}
        delete data.config;
      }
      try{
        self.master.attach(fname,conf,key,environmentmodulename);
      }
      catch(e){
        return report_error(e);
      }
			return report_end(200,JSON.stringify({'status':'ok'}));
		}
    if(typeof data.roles === 'string'){
      data.roles = data.roles.split(',');
    }
    if (!urlpath.length){
      return self.master.interact(data,'',dump);
    }

    var paramobj;
    if(typeof data.paramobj === 'string'){
      try{
          paramobj = JSON.parse(data.paramobj);
      }
      catch(e){}
      delete data.paramobj;
    }
    console.log('credentials',data,'method',urlpath,'paramobj',paramobj);
    setTimeout(function(){self.master.interact(data,urlpath,paramobj);},0);
    report_end(200,'ok');
	};

	Connect.createServer (
			Connect.query(),
			Connect.bodyParser(),
			map_resolver,
			Connect.static(Path.resolve(this.root), {maxAge:0})
	).listen(port);
}

module.exports = WebServer;
