const https = require('https');

let db;
let config;
let util;
let locked = false;

function selectAndLocateOne() {
    if (locked) return;
    locked = true;

    db.findOne({ type: 'location', location: '', status: util.statusToInt('pending') }, (err, doc) => {
        if (err && config.debug) {
            console.log('Geolocation error:');
            console.dir(error);
        }
        if (!doc) return;
        locate(doc.address, (status, results) => {
            // Determine location based on status
            const location = {
                OK: () => {
                    const output = results[0].geometry.location;
                    return `${output.lat},${output.lng}`;
                },
                ZERO_RESULTS: () => '0,0',
                OVER_QUERY_LIMIT: () => {
                    console.error('FATAL: Over API query limit');
                    throw status;
                },
                REQUEST_DENIED: () => 'Error',
                INVALID_REQUEST: () => 'Error',
                UNKNOWN_ERROR: () => 'Error',
                JSON_ERROR: () => 'Error'
            }[status]();

            // Update location and status
            db.update({ _id: doc._id }, { $set: {
                status: util.statusToInt('ready'),
                location
            } }, {}, (err, num) => {
                if (err && config.debug) console.dir(err);
                if (err) return;

                locked = false;
            });
        });
    });
}


function locate(address, cb) {
    const path = `/maps/api/geocode/json?address=${encodeURIComponent(address.replace(/\W/g, '+'))}&key=${config.google.apikey}`;
    
    https.get({
        host: 'maps.googleapis.com',
        path,
        port: 443,
        headers: {
            accept: '*/*'
        }
    }, (response) => {
        let body = '';
        response.on('data', (d) => { body += d; });
        response.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                cb(parsed.status, parsed.results);
            } catch (e) {
                cb('JSON_ERROR');
            }
        });
    });
}
    // "OK" indicates that no errors occurred; the address was successfully parsed and at least one geocode was returned.
    // "ZERO_RESULTS" indicates that the geocode was successful but returned no results. This may occur if the geocoder was passed a non-existent address.
    // "OVER_QUERY_LIMIT" indicates that you are over your quota.
    // "REQUEST_DENIED" indicates that your request was denied.
    // "INVALID_REQUEST" generally indicates that the query (address, components or latlng) is missing.
    // "UNKNOWN_ERROR" indicates that the request could not be processed due to a server error. The request may succeed if you try again.

module.exports = (_db, _config, _utils) => {
    // Set up the local database, configuration, and utils
    db = _db; 
    config = _config;
    util = _utils({}).util;
    
    setInterval(selectAndLocateOne, 1000);
};
