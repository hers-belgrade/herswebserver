var Connect = require ('connect');

function replace_trailing_slashes (str) {
	return str.replace(/^\/|\/$/g,"");
}

function WebServer (ds_maps) {
	this.maps = {};

	// sanitize map ....
	if (ds_maps) {
		for (var i in ds_maps) {
			this.maps[replace_trailing_slashes(i)] = ds_maps[i];
		}
	}
}

WebServer.prototype.start = function (root, port) {
	port = port || 80;
	var self = this;

	var map_resolver = function (req, res, next) {
		var url = req.url;
		if (url.indexOf('.') < -1) { next(); return; }
		url = replace_trailing_slashes(url);
		var bread_crumbs = url.split('/');
		var fname = bread_crumbs.pop();
		var group = bread_crumbs.join ('/');
		var body;
		var sc;

		if (!self.maps[group] || ('function' != typeof(self.maps[group][fname]))) {
			sc = 503;
		}else{
			var ret = self.maps[group][fname]({});
			body = ('undefined' === typeof(ret)) ? [] : ret;
			sc = 200;
		}

		res.writeHead(sc, {
			'Content-Type':'text/plain',
			'Content-Length': ('undefined' == typeof(body)) ? 0 : body.length
		});
		res.end();
	};
	Connect.createServer (
			map_resolver,
			Connect.static(root, {maxAge:0})
	).listen(port);
}


module.exports = {
	WebServer : WebServer
}
