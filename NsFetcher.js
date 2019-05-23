const NSAPI = require("ns-api");

const MODE_STATION = 1;
const MODE_TRIP = 2;

module.exports = class NsFetcher {
	static get MODE_STATION() {
		return MODE_STATION;
	}

	static get MODE_TRIP() {
		return MODE_TRIP;
	}

	constructor(config) {
		this.config = config;
		this.reloadTimer = null;

		this.ns = new NSAPI({key: config.apiKey});
	}

	onReceive(callback) {
		this.callbackReceive = callback;
	}

	onError(callback) {
		this.callbackError = callback;
	}

	doFetch() {
		if (this.config.mode == MODE_STATION) {
			//console.log("MODE_STATION");
			this.fetchStation();
		} else if (this.config.mode == MODE_TRIP) {
			//console.log("MODE_TRIP");
			this.fetchTrip();
		} else {
			console.log("nstreinen - NsFetcher invalid mode: " + this.config.mode);
			return; // Don't schedule next fetch
		}

		var self = this;
		clearTimeout(this.reloadTimer);
		this.reloadTimer = setTimeout(function() {
			//console.log("NOW");
			self.doFetch()
		}, this.config.reloadInterval);
	}

	startFetch() {
		this.doFetch();
	}

	stopFetch() {
		clearTimeout(this.reloadTimer);
	}

	fetchStation() {
		this.ns.getDepartures({
			station: this.config.fromStation
		})
			.then(this.callbackReceive)
			.catch(this.callbackError);
	}

	fetchTrip() {
		this.ns.getTrips({
			fromStation: this.config.fromStation,
			toStation: this.config.toStation
		})
			.then(data => this.callbackReceive(data.trips))
			.catch(this.callbackError);
	}
};
