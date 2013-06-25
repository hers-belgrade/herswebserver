var LPB = require('herslongpoll').LongPollBuffer;

var session_groups = {}

function Buffer(group) {
	LPB.apply(this, [function () {
		return group.root.stringify();
	}]);
	//group.root.onNewTransaction(function (transaction) {
	//	self.send(transaction);
	//});
}

Buffer.prototype = new LPB();
Buffer.prototype.constructor = Buffer;

function get_buffer(obj, cb) {
	if (!obj || !obj.group) return undefined;
	var g = obj.group;
	var sid = obj.sid;

	if (!session_groups[g.name]) session_groups[g.name] = {};
	if (session_groups[g.name][sid]) return session_groups[g.name][sid];
	//obviously, it's wrong sid, create him another one ...

	g.new_sid_provider(function (sid) {
		var lpb = new Buffer(g);
		session_groups[g.name][sid] = lpb;
		cb(sid, lpb);
	});

}

module.exports = {
	get_buffer: get_buffer
};
