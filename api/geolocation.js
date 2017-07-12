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
            console.trace(error);
        }
        if (!doc) {
            locked = false;            
            return;
        }
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
                    throw status;  // Locked
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
                if (err && config.debug) console.trace(err);
                if (err) return; // Locked

                updateParents(doc._id);
                locked = false;
            });
        });
    });
}

function locate(address, cb) {
    const addr = encodeURIComponent(address.replace(/\W/g, '+'));
    const path = `/maps/api/geocode/json?address=${addr}&key=${config.google.apikey}`;
    
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

// Update requests which refer to this loc._id
function updateParents(id) {
    db.update({ type: 'request', status: util.statusToInt('pending'), children: { $elemMatch: id } }, {
        $inc: { numComplete: 1 }
    }, {}, (err, num) => {
        if (err && config.debug) console.trace(err);
        if (err) return;

        console.trace(num);
    });
}

module.exports = (_db, _config, _utils) => {
    // Set up the local database, configuration, and utils
    db = _db; 
    config = _config;
    util = _utils({}).util;
    
    setInterval(selectAndLocateOne, config.google.sleep);
};
