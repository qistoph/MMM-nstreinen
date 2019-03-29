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
			scheduleTimer();
		});
	};

	var handleApiResponse = function(data, response) {
		var newTrains = [];

		if (data.error) {
			fetchFailedCallback(self, "Error fetching station: " + data.error.message[0]);
			console.log(data.error.message[0]);
			scheduleTimer();
			return;
		}

		if (data === undefined || data.ActueleVertrekTijden === undefined || data.ActueleVertrekTijden.VertrekkendeTrein === undefined) {
			fetchFailedCallback(self, "Received data empty or invalid.");
			scheduleTimer();
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
			var depart = {
				departureTime: vt.VertrekTijd,
				departureDelay: parseDelay(vt.VertrekVertraging),
				destination: vt.EindBestemming,
				trainKind: vt.TreinSoort,
				track: vt.VertrekSpoor["_"],
				trackChanged: vt.VertrekSpoor["$"]["wijziging"] === "true",
			};

			parseNote(vt.Opmerkingen, depart);
			if (vt.TreinSoort[0] === "Stopbus i.p.v. trein" || vt.TreinSoort[0] === "Snelbus i.p.v. trein") {
				depart.cancelled = true;
			}

			newTrains.push(depart);
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
		if ((m = delay.match(/^PT(\d+)M$/)) !== null) {
			return 1*(m[1]);
		}

		console.error("Unknown delay time: " + delay);
		return 0;
	}

	/* parseNote()
	 * Parses notes (opmerkingen) and changes properties in depart to match the note
	 */
	var parseNote = function(note, depart) {
		if (note === undefined || note[0] === undefined || note[0].Opmerking === undefined || note[0].Opmerking[0] === undefined) {
			return;
		}

		note = note[0].Opmerking[0];
		if (note.match(/Rijdt vandaag niet/i) !== null) {
			depart.cancelled = true;
			return;
		} else {
			var m = note.match(/Rijdt niet verder dan\s+(.*)\s*/);
			if(m) {
				depart.destination = m[1];
				depart.destinationChanged = true;
				return;
			}
		}

		console.warn("Unknown note: " + note);
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
		// fetchStation will call scheduleTimer for the next call
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
