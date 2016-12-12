var NodeHelper = require("node_helper");
var StationFetcher = require("./stationfetcher.js");
var TripFetcher = require("./tripfetcher.js");

module.exports = NodeHelper.create({
	// Override start method.
	start: function() {
		this.fetchers = [];
		this.tripFetchers = [];

		this.apiUrl = "http://webservices.ns.nl/ns-api-avt?station=${station}";
		this.apiTripUrl = "http://webservices.ns.nl/ns-api-treinplanner?fromStation=${station}&toStation=${destination}&previousAdvices=0&nextAdvices=${maxEntries}&dateTime=${dateTime}&Departure=true&hslAllowed=true&yearCard=false";

		console.log("Starting node helper for: " + this.name);
	},

	// Override socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {
		//console.log("Notification received: " + notification);
		if (notification === "ADD_STATION") {
			//console.log("ADD_STATION: ");
			this.createFetcher(payload.station, payload.user, payload.pass, payload.reloadInterval);
		} else if(notification === "ADD_TRIP") {
			//console.log("ADD_TRIP: ", payload);
			this.createTripFetcher(payload.station, payload.destination, payload.user, payload.pass, payload.maxEntries, payload.reloadInterval);
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
	},

	createTripFetcher: function(station, destination, user, pass, maxEntries, reloadInterval) {
		var self = this;

		var key = station + "-" + destination;
		var fetcher;
		if (typeof self.tripFetchers[key] === "undefined") {
			console.log("Create new trip fetcher for trip: " + key + ", Interval: " + reloadInterval);
			fetcher = new TripFetcher(this.apiTripUrl, user, pass, station, destination, maxEntries, reloadInterval);

			fetcher.onReceive(function(fetcher) {
				self.sendSocketNotification("TRIP_EVENTS", {
					station: fetcher.station(),
					destination: fetcher.destination(),
					trains: fetcher.trains()
				});
			});

			fetcher.onError(function(fetcher, error) {
				self.sendSocketNotification("FETCH_ERROR", {
					station: fetcher.station(),
					error: error
				});
			});

			self.fetchers[key] = fetcher;
		} else {
			console.log("Use existing station fetcher for trip: " + key);
			fetcher = self.tripFetchers[key];
			fetcher.broadcastTrains();
		}

		fetcher.startFetch();
	},

});
