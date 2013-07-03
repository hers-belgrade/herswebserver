var Connect = require ('connect');
var querystring=require('querystring');
var HersData = require('hersdata');
var LPB = require('herslongpoll').LongPollBuffer;

var SESSIONS = {}
var DATA = new HersData.Collection();
var SID_PROVIDER = undefined;

function Buffer(sid, dump_method, key) {
	var self = this;

	if (['value','dump'].indexOf(dump_method) < 0) {
		dump_method = 'value';
	}

	this.dump = function (target) {
		return (dump_method == 'value') ? ((target)?target.value(key):undefined) : (((target)?target.dump():undefined))
	}

	LPB.apply(this, [function () { return self.dump (DATA); }]);

	this.hook_id = DATA.onNewTransaction.attach (function (update_elements) {
		var update = {alias:update_elements.alias};
		var values = [];
		if (update_elements.batch) {
			for (var i in update_elements.batch) {
				var el = update_elements.batch[i];
				values.push({ 
					action : el.action, 
					path: el.path, 
					value: self.dump(el.target),
					name: el.name
				});
			}
		}
		console.log('going out? ',sid, JSON.stringify(values));
		update.batch = values;
		self.send(update);
	});
}

Buffer.prototype = new LPB();
Buffer.prototype.constructor = Buffer;

function get_buffer(sid , cb) {
	if (SESSIONS[sid]) return cb(sid, SESSIONS[sid]);
	//obviously, it's wrong sid, create him another one ...
	SID_PROVIDER(function (sid,dump_method, key) {
		var lpb = new Buffer(sid, dump_method, key);
		SESSIONS[sid] = lpb;
		cb(sid, lpb);
	});

}

function replace_trailing_slashes (str) {
	return str.replace(/^\/|\/$/g,"");
}

function end_with_back_slash (s) {
	if (s.indexOf('/', this.length - 1) === -1) s+='/';
	return s;
}

function remove_multiple_slashes (s) {
	while (s.indexOf('//') > -1) {
		s = s.replace('//','/');
	}
	return s;
}

function WebServer (root) {
	this.root = root;
	this.fmap = undefined;
}

WebServer.prototype.init = function (data) {
	try {
		var module_name = data.module_name;
		this.fmap = undefined;
		this.fmap = DATA.attach(module_name, data.config);
	}catch (e) {
		console.error(e.stack());
		return e.toString();
	}
}

WebServer.prototype.set_sid_provider = function (data) {
	try {
		var module_name = data.module_name;
		var req = require(module_name);
		SID_PROVIDER = req.sid_provider;
		return undefined;
	}catch (e) {
		console.error(e.toString());
		return e.toString();
	}
}

WebServer.prototype.error_log = function (s) {
	console.error(s);
}

WebServer.prototype.start = function (port) {
	port = port || 80;
	var self = this;
	self.data = new HersData.Collection ();

	var map_resolver = function (req, res, next) {
		var url = req.url;
		function report_error (s) {
			self.error_log(s);
			res.writeHead(503,{'Content-Type':'text/plain'});
			res.end();
		}
		function report_end (code) {
			res.writeHead(code, {'Content-Type':'text/plain'});
			res.end();
		}

		if (url.indexOf('.') > -1) { next(); return; }
		if (url.indexOf('?') > -1) {
			url = url.substring(0, url.indexOf('?'));
		}
		url = replace_trailing_slashes(url);
		var bread_crumbs = url.split('/');

		if (req.method != 'GET' && req.method != 'POST') return report_end(503);
		var data = ((req.method == 'GET') ? req.query : req.body) || {};
		var fname = bread_crumbs.shift();

		if (fname === 'init' || fname === 'set_sid_provider') {
			var err = self[fname](data);
			if (err) {
				res.write(err);
				return report_end(503);
			}
			return report_end(200);
		}

		if ('function' !== typeof(SID_PROVIDER)) {
			return report_error('No sid_provider');
		}

		/// mandatory, to keep a track of users progress ....
		var SID = data['hers_session'];
		var LAST= data['last_update'];

		get_buffer (SID, function (sid, lpbuffer) {
			/// execute functionality
			var body = undefined;
			/// if fname is noop use it for hooking ... else, return ret which will be passed on
			if (fname == 'noop') {
				console.log('got noop, should check on buffer ....');
				res.connection.setTimeout(0); ///PROVERI DA LI CE OVO RESITI PROBLEM TIMEOUT-a ?
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
			}else{
				if (!self.fmap) return report_error ('Not initialized');
				var f = self.fmap[fname];
				if (!f) return report_error('Invalid function required '+fname);

				var ret = f(data, function (key,mess) { lpbuffer.send({error:{key:key, message:mess}}); });
				var tor = typeof(ret);
				if ('undefined' == tor) {
					ret = '';
				}else if ('string' != tor) {
					ret = JSON.stringify(ret);
				}

				res.writeHead(200, {
					'Connect-Type': 'application/json',
					'Connect-Length': ret.length,
				});
				res.write(ret);
				res.end();
			}
		});
	};

	Connect.createServer (
			Connect.query(),
			Connect.bodyParser(),
			map_resolver,
			Connect.static(end_with_back_slash(this.root), {maxAge:0})
	).listen(port);
}



module.exports = {
	WebServer : WebServer
}
