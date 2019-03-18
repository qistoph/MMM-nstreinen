/* global Module, Log, moment */

Module.register("nstreinen", {
	defaults: {
		destination: null,
		maxEntries: 5,
		reloadInterval: 5 * 60 * 1000,
		departureOffset: 0,
		displaySymbol: true,
		symbolMapping: {
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
	},

	start: function() {
		Log.info("Starting module: " + this.name);

		if (this.config.destination) {
			this.addTrip(this.config.station, this.config.destination, this.config.user, this.config.pass, this.config.departureOffset, this.config.maxEntries, this.config.reloadInterval);
		} else {
			this.addStation(this.config.station, this.config.user, this.config.pass, this.config.reloadInterval);
		}

		this.resume();
	},

	suspend: function() {
		clearInterval(this.reloadTimer);
		Log.info("NS treinen suspend()");
	},

	resume: function() {
		Log.info("NS treinen resume()");
		var self = this;
		this.reloadTimer = setInterval(function() {
			self.updateDom();
		}, this.config.reloadInterval);
	},

	getStyles: function() {
		return ["nstreinen.css"];
	},

	getScripts: function() {
		return ["moment.js"];
	},

	// Override socket notification handler.
	socketNotificationReceived: function (notification, payload) {
		//console.log(payload);
		if (notification === "STATION_EVENTS") {
			if (this.hasStation(payload.station) && this.hasDestination(null)) {
				this.trains = payload.trains;
				this.loaded = true;
				this.error = null;
			}
		} else if (notification === "TRIP_EVENTS") {
			if (this.hasStation(payload.station) && this.hasDestination(payload.destination)) {
				this.trains = payload.trains;
				this.loaded = true;
				this.error = null;
			}
		} else if (notification === "FETCH_ERROR") {
			Log.error("NSTreinen Error. Could not fetch api: " + payload.error);
			this.error = payload.error;
		} else if (notification === "INCORRECT_URL") {
			Log.error("NSTreinen Error. Incorrect url: " + payload.url);
			this.error = "Invalid URL";
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
			var train = trains[t];
			var trainWrapper = document.createElement("tr");
			trainWrapper.className = "normal";


			if (this.config.displaySymbol) {
				var symbolWrapper = document.createElement("td");
				symbolWrapper.className = "symbol";
				var symbol = document.createElement("span");

				var symbolName = train.trainKind in this.config.symbolMapping ? this.config.symbolMapping[train.trainKind] : this.config.symbolMapping["default"];

				symbol.className = "fa fa-"+symbolName;
				symbolWrapper.appendChild(symbol);

				if(train.meldingen !== undefined && train.meldingen.length > 0) {
					var warn = document.createElement("span");
					warn.className = "fa fa-exclamation-triangle";
					symbolWrapper.appendChild(document.createTextNode("\u00A0"));
					symbolWrapper.appendChild(warn);
				}

				trainWrapper.appendChild(symbolWrapper);
			}

			var titleWrapper = document.createElement("td");
			titleWrapper.innerHTML = train.destination;
			titleWrapper.className = "title";
			trainWrapper.appendChild(titleWrapper);
			if (train.destinationChanged) {
				trainWrapper.className = "bright";
			}

			var timeWrapper = document.createElement("td");
			timeWrapper.innerHTML = moment(train.departureTime).format("HH:mm");
			if (train.departureDelay != 0) {
				timeWrapper.innerHTML += "+" + train.departureDelay;
				trainWrapper.className += " delayed";
			}
			timeWrapper.className = "time bright align-left";
			trainWrapper.appendChild(timeWrapper);

			var trackWrapper = document.createElement("td");
			trackWrapper.innerHTML = train.track || "";
			trackWrapper.className = "track";
			if (train.trackChanged) {
				trackWrapper.className = "bright";
			}

			if (train.cancelled) {
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

	addStation: function(station, user, pass, reloadInterval) {
		this.sendSocketNotification("ADD_STATION", {
			station: station,
			user: user,
			pass: pass,
			reloadInterval: reloadInterval,
		});
	},

	addTrip: function(station, destination, user, pass, departureOffset, maxEntries, reloadInterval) {
		this.sendSocketNotification("ADD_TRIP", {
			station: station,
			destination: destination,
			user: user,
			pass: pass,
			departureOffset: departureOffset,
			maxEntries: maxEntries,
			reloadInterval: reloadInterval
		});
	},

	hasStation: function(station) {
		if(this.config.station === station) {
			return true;
		}
		return false;
	},

	hasDestination: function(destination) {
		if (this.config.destination === destination) {
			return true;
		}
		return false;
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
