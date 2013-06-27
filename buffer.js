var LPB = require('herslongpoll').LongPollBuffer;

var session_groups = {}

function Buffer(group,sid) {
	var self = this;
	LPB.apply(this, [function () {
		return group.root.stringify();
	}]);

	this.hook_id = group.root.onNewTransaction.attach (function (update_elements) {
		var update = {alias:update_elements.alias};
		var values = [];
		if (update_elements.batch) {
			for (var i in update_elements.batch) {
				var el = update_elements.batch[i];
				values.push({ action : el.action, path: el.path, value: (el.target)?el.target.value(self.key):undefined});
			}
		}
		console.log('going out? ',sid, JSON.stringify(values));
		update.batch = values;
		self.send(update);
	});
}

Buffer.prototype = new LPB();
Buffer.prototype.constructor = Buffer;

function get_buffer(obj, cb) {
	if (!obj || !obj.group) return undefined;
	var g = obj.group;
	var sid = obj.sid;

	if (!session_groups[g.name]) session_groups[g.name] = {};
	if (session_groups[g.name][sid]) return cb(sid, session_groups[g.name][sid]);
	//obviously, it's wrong sid, create him another one ...

	g.new_sid_provider(function (sid) {
		var lpb = new Buffer(g,sid);
		session_groups[g.name][sid] = lpb;
		cb(sid, lpb);
	});

}

module.exports = {
	get_buffer: get_buffer
};
