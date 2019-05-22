const NSAPI = require("ns-api");
const config = require("../../config/config.js");

const apiKey = config.modules.find(m => m.module == "nstreinen").config.apiKey;

const ns = new NSAPI({key: apiKey});

ns.getAllStations().then(data => {
	data.forEach(station => {
		console.log(`${station.code} - ${station.namen.lang}`);
	});
});
