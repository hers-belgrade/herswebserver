var Connect = require ('connect');
var querystring=require('querystring');
var Buffer = require ('./buffer.js');

function replace_trailing_slashes (str) {
	return str.replace(/^\/|\/$/g,"");
}

function WebServer (ds_maps) {
	this.maps = {};

	// sanitize map ....
	if (ds_maps) {
		for (var i in ds_maps) {
			var item = ds_maps[i];
			var af = item.root.attach(item.module);
			this.maps[replace_trailing_slashes(i)] = {
				af : af,
				root:item.root,
				module:item.module,
				new_sid_provider : item.new_sid_provider
			}
		}
	}
}

WebServer.prototype.find_group = function (group) {
	group = replace_trailing_slashes(group);
	var ret = (this.maps) ? this.maps[group] : undefined;
	if (!ret) return ret;
	ret.name = group;
	return ret;
}

WebServer.prototype.root_for_group = function (group) {
	var g = this.find_group(group);
	if (!g) return undefined;
	return g.root;
}

WebServer.prototype.func_for_group = function (group, fname) {
	var g = this.find_group(group);
	if (!g) return undefined;
	return (g['af'] && g['af'][fname]) ? g['af'][fname] : undefined;
}


WebServer.prototype.start = function (root, port) {
	port = port || 80;
	var self = this;

	var map_resolver = function (req, res, next) {
		var url = req.url;
		if (url.indexOf('.') > -1) { next(); return; }
		if (url.indexOf('?') > -1) {
			url = url.substring(0, url.indexOf('?'));
		}

		function report_error (code) {
			res.writeHead(code, {'Content-Type':'text/plain'});
			res.end();
		}
		url = replace_trailing_slashes(url);
		var bread_crumbs = url.split('/');
		var fname = bread_crumbs.pop();
		var group = bread_crumbs.join ('/');
		var f = self.func_for_group(group, fname);
		if (!f) return report_error(503);


		function go(data) {
			var body = self.maps[group]['af'][fname](res, data||{});
		}

		if (req.method != 'GET' && req.method != 'POST') return report_error(503);
		var data = ((req.method == 'GET') ? res.query : res.body) || {};
		Buffer.get_buffer ( {
			group: self.find_group(group),
			sid : data['hers_session']
		}, function (sid, lpbuffer){
			/// execute functionality
			var ret = f(data, function (key,mess) { lpbuffer.send({error:{key:key, message:mess}}); });
			lpbuffer.check (function (update) {
				var body = JSON.stringify({
					'sid' : sid,
					'update':update
				});
				res.writeHead(200, {
					'Content-Type':'application/json',
					'Content-Length':body.length,
				});
				res.write(body);
				res.end();
			}, data['last_update']);
		});
	};
	Connect.createServer (
			Connect.query(),
			Connect.bodyParser(),
			map_resolver,
			Connect.static(root, {maxAge:0})
	).listen(port);
}


module.exports = {
	WebServer : WebServer
}
