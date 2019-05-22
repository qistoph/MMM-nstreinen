var NodeHelper = require("node_helper");
var NsFetcher = require("./NsFetcher.js");

module.exports = NodeHelper.create({
	// Override start method.
	start: function() {
		this.fetchers = {};
		console.log("Starting node helper for: " + this.name);
	},

	forFetchers: function(callback) {
		var self = this;
		Object.keys(this.fetchers).forEach(function(key) {
			callback(self.fetchers[key]);
		});
	},

	// Override socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {
		//console.log("Notification received: " + notification);
		if (notification === "ADD_CONFIG") {
			this.createFetcher(payload);
		} else if(notification === "SUSPEND") {
			this.forFetchers(f => f.stopFetch() );
		} else if(notification === "RESUME") {
			this.forFetchers(f => f.startFetch() );
		}
	},

	/* createFetcher(config)
	 * Creates a fetcher for a station if it doesn"t exist yet.
	 * Otherwise it reuses the existing one.
	 *
	 * attribute station string - The name of the station.
	 * attribute reloadInterval number - Reload interval in milliseconds.
	 */

	createFetcher: function(config) { //station, user, pass, reloadInterval) {
		var self = this;

		if (!("moduleId" in config)) {
			console.log("nstreinen createFetcher called without moduleId");
			return;
		}

		var fetcher;

		if (typeof self.fetchers[config.moduleId] === "undefined") {
			console.log("Create new fetcher for moduleId: " + config.moduleId);
			fetcher = new NsFetcher(config);

			fetcher.onReceive(function(data) {
				//console.log("Received:", data);
				self.sendSocketNotification("DATA", {moduleId: config.moduleId, trains: data});
			});

			fetcher.onError(function(error) {
				console.log("Error:", error);
				self.sendSocketNotification("FETCH_ERROR", {moduleId: config.moduleId, error: error});
			});

			self.fetchers[config.moduleId] = fetcher;
		} else {
			console.log("Use existing fetcher for moduleId: " + config.moduleId);
			fetcher = self.fetchers[config.moduleId];
			//fetcher.broadcastTrains();
		}

		fetcher.startFetch();
	},

});
