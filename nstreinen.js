Module.register('nstreinen', {
	defaults: {
		maxEntries: 5,
		reloadInterval: 5 * 60 * 1000,
		displaySymbol: true,
		symbol: 'train', // Fontawesome Symbol see http://fontawesome.io/cheatsheet/
	},

	init: function() {
		this.apiUrl = 'http://webservices.ns.nl/ns-api-avt?station=${station}';
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

	getScripts: function() {
		return ["moment.js"];
	},

	// Override socket notification handler.
	socketNotificationReceived: function (notification, payload) {
		Log.info('Received: ' + notification + ', ' + payload);
		if (notification === "STATION_EVENTS") {
			if (this.hasStation(payload.station)) {
				this.trains[payload.station] = payload.trains;
				this.loaded = true;
			}
		} else if (notification === "FETCH_ERROR") {
			Log.error("Calendar Error. Could not fetch calendar: " + payload.url);
		} else if (notification === "INCORRECT_URL") {
			Log.error("Calendar Error. Incorrect url: " + payload.url);
		} else {
			Log.log("Calendar received an unknown socket notification: " + notification);
		}

		this.updateDom(this.config.animationSpeed);
	},

	getDom: function() {
		var trains = this.createTrainsList();
		var wrapper = document.createElement('table');
		wrapper.className = 'small';

		if (trains.length === 0) {
			Log.error('No trains... loaded: ' + this.loaded);
			wrapper.innerHTML = (this.loaded) ? "Geen informatie" : "Loading...";
			wrapper.className = 'small dimmed';
			return wrapper;
		}

		for (var t in trains) {
			var train = trains[t];
			var trainWrapper = document.createElement('tr');
			trainWrapper.className = 'normal';

			if (this.config.displaySymbol) {
				var symbolWrapper = document.createElement('td');
				symbolWrapper.className = 'symbol';
				var symbol = document.createElement('span');
				symbol.className = 'fa fa-'+this.config.symbol;
				symbolWrapper.appendChild(symbol);
				trainWrapper.appendChild(symbolWrapper);
			}

			var titleWrapper = document.createElement('td');
			titleWrapper.innerHTML = train.destination;
			trainWrapper.appendChild(titleWrapper);

			var timeWrapper = document.createElement('td');
			timeWrapper.innerHTML = moment(train.departureTime).format('HH:mm');
			if (train.departureDelay != 0) {
				timeWrapper.innerHTML += '+' + train.departureDelay;
			}
			timeWrapper.className = 'title bright';
			trainWrapper.appendChild(timeWrapper);

			var trackWrapper = document.createElement('td');
			trackWrapper.innerHTML = train.track;
			if (train.trackChanged) {
				trackWrapper.className = 'title bright';
			}

			if (train.cancelled) {
				trainWrapper.style.textDecoration = 'line-through';
			}

			trainWrapper.appendChild(trackWrapper);
			wrapper.appendChild(trainWrapper);
		}

		return wrapper;
	},

	addStation: function(station, user, pass, reloadInterval) {
		this.sendSocketNotification('ADD_STATION', {
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
		if (trains === undefined) return [];
		trains = trains.slice(0, this.config.maxEntries);
		return trains;
	}

});
