var NodeHelper = require("node_helper");
var StationFetcher = require("./stationfetcher.js");

module.exports = NodeHelper.create({
	// Override start method.
	start: function() {
		var self = this;
		var events = [];

		this.fetchers = [];

		this.apiUrl = "http://webservices.ns.nl/ns-api-avt?station=${station}";

		console.log("Starting node helper for: " + this.name);
	},

	// Override socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "ADD_STATION") {
			//console.log("ADD_STATION: ");
			this.createFetcher(payload.station, payload.user, payload.pass, payload.reloadInterval);
		}
	},

	/* createFetcher(station)
	 * Creates a fetcher for a station if it doesn"t exist yet.
	 * Otherwise it reuses the existing one.
	 *
	 * attribute station string - The name of the station.
	 * attribute reloadInterval number - Reload interval in milliseconds.
	 */

	createFetcher: function(station, user, pass, reloadInterval) {
		var self = this;

		var fetcher;
		if (typeof self.fetchers[station] === "undefined") {
			console.log("Create new station fetcher for station: " + station + " - Interval: " + reloadInterval);
			fetcher = new StationFetcher(this.apiUrl, user, pass, station, reloadInterval);

			fetcher.onReceive(function(fetcher) {
				//console.log("Broadcast events.");
				//console.log(fetcher.events());

				self.sendSocketNotification("STATION_EVENTS", {
					station: fetcher.station(),
					trains: fetcher.trains()
				});
			});

			fetcher.onError(function(fetcher, error) {
				self.sendSocketNotification("FETCH_ERROR", {
					station: fetcher.station(),
					error: error
				});
			});

			self.fetchers[station] = fetcher;
		} else {
			console.log("Use existing station fetcher for station: " + station);
			fetcher = self.fetchers[station];
			fetcher.broadcastTrains();
		}

		fetcher.startFetch();
	}
});
