var Client = require("node-rest-client").Client;

var StationFetcher = function(url, user, pass, station, reloadInterval) {
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
	apiClient.registerMethod("actueleVertrektijden", url, "GET");

	/* fetchStation()
	 * Initiates station fetch.
	 */
	var fetchStation = function() {
		clearTimeout(reloadTimer);
		reloadTimer = null;

		apiClient.methods.actueleVertrektijden({"path": {"station": station}}, handleApiResponse).on("error", function(err) {
			fetchFailedCallback(self, "Error fetching station: " + err);
			console.log(err.stack);
		});
	};

	var handleApiResponse = function(data, response) {
		newTrains = [];

		if (data === undefined || data.ActueleVertrekTijden === undefined || data.ActueleVertrekTijden.VertrekkendeTrein === undefined) {
			fetchFailedCallback(self, "Received data empty or invalid.");
			return;
		}

		data.ActueleVertrekTijden.VertrekkendeTrein.forEach(function(vt) {
			//{ RitNummer: [ "14839" ],
			//  VertrekTijd: [ "2016-11-11T11:10:00+0100" ],
			//  EindBestemming: [ "Hoorn" ],
			//  TreinSoort: [ "Sprinter" ],
			//  RouteTekst: [ "Uitgeest, Alkmaar" ],
			//  Vervoerder: [ "NS" ],
			//  VertrekSpoor: [ { _: "5", "$": [Object] } ] }
			newTrains.push({
				departureTime: vt.VertrekTijd[0],
				departureDelay: parseDelay(vt.VertrekVertraging),
				destination: vt.EindBestemming[0],
				trainKind: vt.TreinSoort[0],
				track: vt.VertrekSpoor[0]["_"],
				trackChanged: vt.VertrekSpoor[0]["$"]["wijziging"] == "true",
				cancelled: parseNote(vt.Opmerkingen) || vt.TreinSoort[0] == "Stopbus i.p.v. trein" || vt.TreinSoort[0] == "Snelbus i.p.v. trein",
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

		delay = delay[0]; // XML object is put in arrays
		if (delay === undefined) {
			return 0;
		}

		var m;
		if ((m = delay.match(/^PT(\d+)M$/)) !== false) {
			return 1*(m[1]);
		}

		Log.error("Unknown delay time: " + delay);
		return 0;
	}

	/* parseNote()
	 * Parses notes (opmerkingen) and returns true if train is cancelled.
	 */
	var parseNote = function(note) {
		if (note === undefined || note[0] === undefined || note[0].Opmerking === undefined || note[0].Opmerking[0] === undefined) {
			return false;
		}

		note = note[0].Opmerking[0];
		var m;
		if ((m = note.match(/Rijdt vandaag niet/i)) !== false) {
			return true;
		}

		Log.warn("Unknown note: " + note);

		return false;
	}

	/* scheduleTimer()
	 * Schedule the timer for the next update.
	 */
	var scheduleTimer = function() {
		//console.log("Schedule update timer.");
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function() {
			fetchStation();
		}, reloadInterval);
	};

	/* public methods */

	/* startFetch()
	 * Initiate fetchStation();
	 */
	this.startFetch = function() {
		fetchStation();
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

module.exports = StationFetcher;
