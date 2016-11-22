Module.register("nstreinen", {
	defaults: {
		maxEntries: 5,
		reloadInterval: 5 * 60 * 1000,
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
		this.apiUrl = "http://webservices.ns.nl/ns-api-avt?station=${station}";
		this.trains = {};
	},

	start: function() {
		Log.info("Starting module: " + this.name);
		var self = this;
		setInterval(function() {
			self.updateDom();
		}, this.config.reloadInterval);

		this.addStation(this.config.station, this.config.user, this.config.pass, this.config.reloadInterval);
	},

	getStyles: function() {
		return ["nstreinen.css"];
	},

	getScripts: function() {
		return ["moment.js"];
	},

	// Override socket notification handler.
	socketNotificationReceived: function (notification, payload) {
		Log.info("Received: " + notification, payload);
		if (notification === "STATION_EVENTS") {
			if (this.hasStation(payload.station)) {
				this.trains[payload.station] = payload.trains;
				this.loaded = true;
			}
		} else if (notification === "FETCH_ERROR") {
			Log.error("NSTreinen Error. Could not fetch api: " + payload.url);
		} else if (notification === "INCORRECT_URL") {
			Log.error("NSTreinen Error. Incorrect url: " + payload.url);
		} else {
			Log.log("NSTreinen received an unknown socket notification: " + notification);
		}

		this.updateDom();
		this.show();
	},

	getDom: function() {
		var trains = this.createTrainsList();
		var wrapper = document.createElement("table");
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
				trainWrapper.appendChild(symbolWrapper);
			}

			var titleWrapper = document.createElement("td");
			titleWrapper.innerHTML = train.destination;
			titleWrapper.className = "title";
			trainWrapper.appendChild(titleWrapper);

			var timeWrapper = document.createElement("td");
			timeWrapper.innerHTML = moment(train.departureTime).format("HH:mm");
			if (train.departureDelay != 0) {
				timeWrapper.innerHTML += "+" + train.departureDelay;
			}
			timeWrapper.className = "bright align-left";
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

	hasStation: function(station) {
		if(this.config.station === station) {
			return true;
		}
		return false;
	},

	createTrainsList: function() {
		var trains = this.trains[this.config.station];
		if (trains === undefined) {
			return [];
		}
		trains = trains.slice(0, this.config.maxEntries);
		return trains;
	}

});
