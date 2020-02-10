var request = require("request");
var NodeHelper = require("node_helper");
var cheerio = require("cheerio");
var RVVHelper = require("./RVVHelper.js");

module.exports = NodeHelper.create({

	start: function() {
		console.log("Starting node helper: " + this.name);
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if(notification === "GET_TRIPS") {
			var url = payload.config.url + payload.config.fromID;

			request(url, function (error, response, body) {
				var $ = cheerio.load(body);

				var trips = [];

				// get delays + departures
				var trpCnt = 1;
				var limitReached = false;
				$(".trip").each(function() {
					if (limitReached === true) {
						return;
					}
					// We store 3 properties for a trip
					var tripObj = {direction: "", delay: "", departure: ""};

					var tripData = $(this);

					RVVHelper.printToConsole("\nTRIP #" + trpCnt, payload.config);
					trpCnt++;

					// default delay is 0 ("in time")
					tripObj.delay = "0";
					tripObj.departure = "00:00";
					tripObj.direction = "";

					// Get 'delay' or 'nodelay' class objects
					var tripDelay = tripData.find(".delay");
					if (tripDelay.length > 0){
						tripObj.delay = tripDelay.text().trim();
					}
					else {
						tripDelay = tripData.find(".nodelay");
						tripObj.delay = "0";
					}
					RVVHelper.printToConsole("Delay: " + tripObj.delay, payload.config);

					// If there was no object found, the 'delay' is 0
					if (tripDelay.length > 0) {
						tripObj.departure = tripDelay.parent().children().remove().end().text().trim();
					} else {
						tripObj.departure = tripData.find("span").first().text().trim();
					}
					RVVHelper.printToConsole("Departure: " + tripObj.departure, payload.config);

					let tdCnt = 1;
					$(tripData.find("td")).each(function(){
						tdCnt++;
						if (tdCnt > 2 && !$(this).hasClass("icon") && $(this).text().trim() != ""){
							tripObj.direction = $(this).text().trim();
							RVVHelper.printToConsole("Direction: " + tripObj.direction, payload.config);
						}
					});

					// Store the new trip, if destination fits
					if (tripObj.direction === payload.config.toName || payload.config.toName === "")
					{
						// Check special conditions
						if (trips.length > 0){
							// Case 1: Remove the first of 2 duplicated trips
							if(tripObj.direction === "Schwabenstraße" && payload.config.fromID === 4014037){
								if ((tripObj.departure).substr(3,4) - (trips[trips.length -1].departure).substr(3,4) === 2)
								{
									trips.pop();
								}
							}
							// Case 2: tbd.
							// Case 3: tbd.
							// Case 4: tbd.
							// ...
						}
						trips.push(tripObj);

						// Check, if trip limit is already reached
						if (trips.length >= payload.config.tripLimit) {
							RVVHelper.printToConsole("MMM-RVV could fetch more trips, but they were limited to " + payload.config.tripLimit + " trips. Aborting the fetch.", payload.config);
							limitReached = true;
						}
					}
					else{
						RVVHelper.printToConsole("Destination '" + tripObj.direction + "' does not match with '" + payload.config.toName + "'!", payload.config);
					}

				});

				// Return trips to requester
				self.sendSocketNotification("RETURN_TRIPS", {
					trips : trips
				});

			});
			return;
		}
	},
});