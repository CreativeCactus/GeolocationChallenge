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
        apikey: ''
    }
};

module.exports = merge(base, locals);

// Utility
function merge(target, source) {
    Object.keys(source).forEach((key) => {
        if (source[key] instanceof Object) Object.assign(source[key], merge(target[key], source[key]));
    });

    // Join `target` and modified `source`
    Object.assign(target || {}, source);
    return target;
}
