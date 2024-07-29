const { Database } = require("bun:sqlite");
const db = new Database("db.sqlite");

module.exports = {
	addPoolWatcher: function(userId, poolId, source) {
		let lp_watcher = db.query(
			"INSERT INTO lp_watcher (id, userid, source, last_checked, warning_level, status) VALUES (?,?,?,?,?,?)"
		);
		let res = lp_watcher.run(poolId, userId, source, 0, 0, 1);
	  
		if (res.lastInsertRowid > 0) {
			console.log("Pool watcher added");
		} else {
			console.log("Error adding pool watcher");
		}

		return res.lastInsertRowid;
	},
	  
	removePoolWatcher: function(userId, poolId, source) {
		let lp_watcher = db.prepare(
			"DELETE FROM lp_watcher WHERE id =? AND userid =? AND source =?"
		);
		let res = lp_watcher.run(poolId, userId, source);
		// console.debug(res);
		
		console.log("Pool watcher removed");

		return res.changes;
	},
	  
	getPoolWatcher: function(userId, poolId, source) {
		let lp_watcher = db.query(
			"SELECT * FROM lp_watcher WHERE id =? AND userid =? AND source =?"
		);
		let res = lp_watcher.get(poolId, userId, source);
		if (res) {
			return res;
		} else {
			return false;
		}
	},
	  
	getPoolWatchers: function() {
		let lp_watcher = db.query(
			"SELECT * FROM lp_watcher WHERE status = 1 ORDER BY id ASC"
		);
		let res = lp_watcher.all();
		if (res) {
			return res;
		} else {
			return false;
		}
	},

	updateLastCheckedPool: function(userId, poolId, source, lastChecked) {
		let lp_watcher = db.prepare(
			"UPDATE lp_watcher SET last_checked =? WHERE id =? AND userid =? AND source =?"
		);
		let res = lp_watcher.run(lastChecked, poolId, userId, source);

		return res.changes;
	}
}