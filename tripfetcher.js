var Client = require("node-rest-client").Client;

var TripFetcher = function(url, user, pass, station, destination, departureOffset, maxEntries, reloadInterval) {
	var self = this;

	var reloadTimer = null;
	var trains = [];

	var fetchFailedCallback = function() {};
	var trainsReceivedCallback = function() {};

	var opts = {
		mimetypes: {
			"xml": ["application/xml", "application/xml;charset=utf-8", "text/xml"]
		}
	};

	if (user && pass) {
		opts.user = user;
		opts.password = pass;
	}

	var apiClient = new Client(opts);
	apiClient.registerMethod("reisadvies", url, "GET");

	/* fetchTrip()
	 * Initiates station fetch.
	 */
	var fetchTrip = function() {
		clearTimeout(reloadTimer);
		reloadTimer = null;

		var dateTime = new Date();
		dateTime = new Date(dateTime.getTime() + departureOffset * 1000);

		apiClient.methods.reisadvies(
			{"path": {"station": station, "destination": destination, "maxEntries": maxEntries, "dateTime": dateTime.toISOString()}},
			handleApiResponse
		).on("error", function(err) {
			fetchFailedCallback(self, "Error fetching station: " + err);
			console.log(err.stack);
		});
	};

	var handleApiResponse = function(data, response) {
		var newTrains = [];

		if (data.error) {
			fetchFailedCallback(self, "Error fetching trip: " + data.error.message[0]);
			console.log(data.error.message[0]);
			scheduleTimer();
			return;
		}

		data.ReisMogelijkheden.ReisMogelijkheid.forEach(function(mogelijkheid) {
			var status = mogelijkheid.Status;
			var meldingen = mogelijkheid.Melding;
			var reisDeel = mogelijkheid.ReisDeel;
			if(!Array.isArray(reisDeel)) {
				// If node-rest-client returns single object
				// convert it to an array to simplify code below
				reisDeel = [reisDeel];
			}
			var spoorInfo = reisDeel[0].ReisStop[0]["Spoor"];
			var vertrekSpoor = spoorInfo["_"];
			var spoorWijziging = spoorInfo["$"]["wijziging"] === "true";
			var vertraging = parseDelay(mogelijkheid.VertrekVertraging);

			var trainTypes = [];
			reisDeel.forEach(function(deel) {
				trainTypes.push(deel.VervoerType);
			});

			var title = trainTypes.join(", ") + " (" + mogelijkheid.ActueleReisTijd + ")";

			var cancelled = status == "NIET-MOGELIJK";

			newTrains.push({
				plannedTime: mogelijkheid.GeplandeReisTijd,
				currentTime: mogelijkheid.ActueleReisTijd,
				plannedDeparture: mogelijkheid.GeplandeVertrekTijd,
				departureTime: mogelijkheid.GeplandeVertrekTijd,
				departureDelay: vertraging,
				track: vertrekSpoor,
				trackChanged: spoorWijziging,
				trainTypes: trainTypes,
				destination: title,
				status: status,
				cancelled: cancelled,
				meldingen: meldingen
			});
		});

		trains = newTrains;
		self.broadcastTrains();
		scheduleTimer();
	}

	var parseDelay = function(delay) {
		if (delay === undefined) {
			return 0;
		}

		var m;
		if ((m = delay.match(/^\+(\d+).*$/)) !== null) {
			return 1*(m[1]);
		}

		console.error("Unknown delay time: " + delay);
		return 0;
	}

	/* scheduleTimer()
	 * Schedule the timer for the next update.
	 */
	var scheduleTimer = function() {
		//console.log("Schedule update timer "+reloadInterval);
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function() {
			fetchTrip();
		}, reloadInterval);
	};

	/* public methods */

	/* startFetch()
	 * Initiate fetchTrip();
	 */
	this.startFetch = function() {
		fetchTrip();
		// fetchTrip will call scheduleTimer for the next call
	};

	/* stopFetch()
	 * Stop fetching this info (e.g. to suspend)
	 */
	this.stopFetch = function() {
		clearTimeout(reloadTimer);
	};

	/* broadcastTrains()
	 * Broadcast the existing trains.
	 */
	this.broadcastTrains = function() {
		trainsReceivedCallback(self);
	};

	/* onReceive(callback)
	 * Sets the on success callback
	 *
	 * argument callback function - The on success callback.
	 */
	this.onReceive = function(callback) {
		trainsReceivedCallback = callback;
	};

	/* onError(callback)
	 * Sets the on error callback
	 *
	 * argument callback function - The on error callback.
	 */
	this.onError = function(callback) {
		fetchFailedCallback = callback;
	};

	/* station()
	 * Returns the station of this fetcher.
	 *
	 * return string - The station of this fetcher.
	 */
	this.station = function() {
		return station;
	};

	/* destination()
	 * Returns the destination of this fetcher.
	 *
	 * return string - The destionation used in planning.
	 */
	this.destination = function() {
		return destination;
	}

	/* url()
	 * Returns the url of this fetcher.
	 *
	 * return string - The url of this fetcher.
	 */
	this.url = function() {
		return url;
	};

	/* trains()
	 * Returns current available trains for this fetcher.
	 *
	 * return array - The current available trains for this fetcher.
	 */
	this.trains = function() {
		return trains;
	};

};

module.exports = TripFetcher;
