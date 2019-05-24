/* global Module, Log, moment */

const MODE_STATION = 1;
const MODE_TRIP = 2;

Module.register("nstreinen", {
	defaults: {
		toStation: null,
		maxEntries: 5,
		reloadInterval: 5 * 60 * 1000,
		departureOffset: 0,
		displaySymbol: true,
		symbolMapping: {
			"IC": "train",
			"SPR": "stop-circle",
			"ST": "stop-circle",
			"Intercity": "train",
			"Intercity direct": "forward",
			"Sprinter": "stop-circle",
			"Stopbus i.p.v. trein": "bus",
			"Snelbus i.p.v. trein": "bus",
			"default": "train"
		},
		fade: true,
		fadePoint: 0.25,
	},

	init: function() {
		this.trains = undefined;
		console.log("nstreinen.init");
	},

	start: function() {
		Log.info("Starting module: " + this.name + ", " + this.identifier);

		this.mode = MODE_STATION;
		if (this.config.toStation) {
			this.mode = MODE_TRIP;
		}

		if ("apiKey" in this.config && "fromStation" in this.config) {
			this.sendSocketNotification("ADD_CONFIG", {
				moduleId: this.identifier,
				apiKey: this.config.apiKey,
				mode: this.mode,
				fromStation: this.config.fromStation,
				toStation: this.config.toStation,
				reloadInterval: this.config.reloadInterval,
				departureOffset: this.config.departureOffset,
				maxEntries: this.config.maxEntries
			});
		} else {
			this.error = "Configure nstreinen V2 module with apiKey and fromStation";
		}
	},

	suspend: function() {
		Log.info("NS treinen suspend()");
		this.sendSocketNotification("SUSPEND", {});
	},

	resume: function() {
		Log.info("NS treinen resume()");
		this.sendSocketNotification("RESUME", {});
	},

	getStyles: function() {
		return ["nstreinen.css"];
	},

	getScripts: function() {
		return ["moment.js"];
	},

	// Override socket notification handler.
	socketNotificationReceived: function (notification, payload) {
		if (notification === "DATA") {
			if (this.identifier === payload.moduleId) {
				console.debug(notification, payload);
				this.trains = payload.trains;
				this.loaded = true;
				this.error = null;
			}
		} else if (notification === "FETCH_ERROR") {
			if (this.identifier === payload.moduleId) {
				Log.error("NSTreinen Error. Could not fetch api," + payload.error);
				this.error = `Error (${payload.error.code}) fetching NS info`;
				if ("errors" in payload.error) {
					this.error += `: ${payload.error.errors[0].message}`;
				}
			}
		} else {
			Log.log("NSTreinen received an unknown socket notification: " + notification);
		}

		this.updateDom();
	},

	getDom: function() {
		var wrapper;

		if (this.error) {
			wrapper = document.createElement("div");
			wrapper.className = "small";
			wrapper.innerText = this.error;
			return wrapper;
		}

		var trains = this.createTrainsList();
		wrapper = document.createElement("table");
		wrapper.className = "small";

		if (trains.length === 0) {
			wrapper.innerHTML = (this.loaded) ? "No information" : "Loading...";
			wrapper.className = "small dimmed";
			return wrapper;
		}

		for (var t in trains) {
			var lineInfo = this.mapRow(trains[t]);
			//console.debug("lineInfo:", lineInfo);
			var trainWrapper = document.createElement("tr");
			trainWrapper.className = "normal";

			if (this.config.displaySymbol) {
				var symbolWrapper = document.createElement("td");
				symbolWrapper.className = "symbol";
				var symbol = document.createElement("span");

				var symbolName = lineInfo.symbol in this.config.symbolMapping ? this.config.symbolMapping[lineInfo.symbol] : this.config.symbolMapping["default"];

				symbol.className = "fa fa-"+symbolName;
				symbolWrapper.appendChild(symbol);

				if(lineInfo.warn) {
					var warn = document.createElement("span");
					warn.className = "fa fa-exclamation-triangle";
					symbolWrapper.appendChild(document.createTextNode("\u00A0"));
					symbolWrapper.appendChild(warn);
				}

				trainWrapper.appendChild(symbolWrapper);
			}

			var titleWrapper = document.createElement("td");
			titleWrapper.innerHTML = lineInfo.title;
			titleWrapper.className = "title";
			trainWrapper.appendChild(titleWrapper);
			if (lineInfo.titleBright) {
				trainWrapper.className = "bright";
			}

			var timeWrapper = document.createElement("td");
			timeWrapper.innerHTML = lineInfo.timestamp.format("HH:mm");
			if (lineInfo.delay) {
				timeWrapper.innerHTML += "+" + Math.ceil(lineInfo.delay/60000);
				trainWrapper.className += " delayed";
			}
			timeWrapper.className = "time bright align-left";
			trainWrapper.appendChild(timeWrapper);

			var trackWrapper = document.createElement("td");
			trackWrapper.innerHTML = lineInfo.track || "";
			trackWrapper.className = "track";
			if (lineInfo.trackBright) {
				trackWrapper.className = "bright";
			}

			if (lineInfo.cancelled) {
				trainWrapper.style.textDecoration = "line-through";
			}

			trainWrapper.appendChild(trackWrapper);
			wrapper.appendChild(trainWrapper);

			// Create fade effect.
			if (this.config.fade && this.config.fadePoint < 1) {
				if (this.config.fadePoint < 0) {
					this.config.fadePoint = 0;
				}
				var startingPoint = trains.length * this.config.fadePoint;
				var steps = trains.length - startingPoint;
				if (t >= startingPoint) {
					var currentStep = t - startingPoint;
					trainWrapper.style.opacity = 1 - (1 / steps * currentStep);
				}
			}
		}

		return wrapper;
	},

	mapRow: function(trip) {
		switch(this.mode) {
		case MODE_STATION:
			return this.mapStationRow(trip);
		case MODE_TRIP:
			return this.mapTripRow(trip);
		default:
			Log.error("Invalid nstreinen mode: ", this.mode)
			return null
		}
	},

	mapStationRow: function(trip) {
		var actualDateTime = moment(trip.actualDateTime);
		var plannedDateTime = moment(trip.plannedDateTime);

		var delay = Math.max(0, actualDateTime - plannedDateTime);

		// TODO: test/check with actual data (missing in docs)
		var warn = ("messages" in trip && trip.messages.some(m => m.style !== "INFO"));

		return {
			symbol: trip.trainCategory,
			warn: warn,
			title: trip.direction,
			titleBright: Boolean(trip.destinationChanged),
			timestamp: actualDateTime,
			delay: delay,
			track: trip.actualTrack || trip.plannedTrack,
			trackBright: trip.actualTrack && trip.actualTrack != trip.plannedTrack,
			cancelled: trip.cancelled
		};
	},

	mapTripRow: function(trip) {
		var title = trip.legs.map(leg => leg.name.substr(0, leg.name.indexOf(" "))).join(", ");
		title += " (" + this.minToHHMM(trip.actualDurationInMinutes) + ")";

		var delay = Math.max(0, trip.legs[0].stops[0].actualDepartureDateTime - trip.legs[0].stops[0].plannedDepartureDateTime);

		//console.debug("stops[0]:", trip.legs[0].stops[0]);

		return {
			symbol: "default",
			warn: trip.status === "DISRUPTION",
			title: title,
			titleBright: false, // TODO
			timestamp: moment(trip.legs[0].stops[0].plannedDepartureDateTime),
			delay: delay,
			track: trip.legs[0].stops[0].plannedDepartureTrack,
			trackBright: false, // TODO
			cancelled: trip.status == "CANCELLED",
		};
	},

	minToHHMM: function(mins) {
		var ret = Math.floor(mins/60) + ":";
		mins %= 60;
		if (mins < 10) { ret += "0"; }
		ret += mins;
		return ret;
	},

	createTrainsList: function() {
		var trains = this.trains;
		if (trains === undefined) {
			return [];
		}
		trains = trains.slice(0, this.config.maxEntries);
		return trains;
	}

});
