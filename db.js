const { Database } = require("bun:sqlite");
const db = new Database("db.sqlite");

module.exports = {
	addPoolWatcher: function(poolId, source) {
		let lp_watcher = db.query(
			"INSERT INTO lp_watcher (id, source, last_checked, warning_level, status) VALUES (?,?,?,?,?)"
		);
		let res = lp_watcher.run(poolId, source, 0, 0, 1);
	  
		if (res.lastInsertRowid > 0) {
			console.log("Pool watcher added");
		} else {
			console.log("Error adding pool watcher");
		}

		return res.lastInsertRowid;
	},
	  
	removePoolWatcher: function(poolId) {
		let lp_watcher = db.prepare(
			"DELETE FROM lp_watcher WHERE id =?"
		);
		let res = lp_watcher.run(poolId);
		// console.debug(res);
		
		console.log("Pool watcher removed");

		return res.changes;
	},
	  
	getPoolWatcher: function(poolId) {
		let lp_watcher = db.query(
			"SELECT * FROM lp_watcher WHERE id =?"
		);
		let res = lp_watcher.get(poolId);
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
}