const locals = require('./config.json');

// List available config
const base = {
    port: 3000,
    // If true, additional info will be logged and stack traces may be sent to clients.
    debug: false,
    // If true, well formed but invalid JSON is accepted and invalid entries are pruned.
    allowPartialData: false,
    // Google API settings and credentials
    google: {
        apikey: '',
        // ms to wait between checking if a request can be made. Requests never overlap.
        sleep: 1000
    },
    // ms for frontend to wait between polling for status updates.
    poll: 5000
};

module.exports = merge(base, locals);

function merge(target, source) {
    const isObject = item => (item && typeof item === 'object' && !Array.isArray(item));
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach((key) => {
            if (isObject(source[key])) {
                if (!(key in target)) { Object.assign(output, { [key]: source[key] }); } else { output[key] = merge(target[key], source[key]); }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}
