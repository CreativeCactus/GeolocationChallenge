const NeDB = require('nedb');

const utils = require('./utils');

module.exports = (app, config) => {
    // Set up the database
    const db = new NeDB({
        filename: './challenge.db',
        autoload: true 
    });

    const DBIndexError = (err) => {
        if (config.debug && err) {
            console.log('Failed to set up unique index in database:');
            console.dir(err);
        }
    };

    db.ensureIndex({
        fieldName: 'address',
        unique: true,
        sparse: true
    }, DBIndexError);

    db.ensureIndex({
        fieldName: 'id',
        unique: true,
        sparse: true
    }, DBIndexError);

    app.context.db = db;

    // Set up the config and statistics
    app.context.config = config;
    app.context.stats = { locations: 0 };
    db.count({ type: 'location' }, (err, count) => {
        if (config.debug && err) {
            console.dir(err);
            return;
        }
        app.context.stats.locations = count;
    });

    // Set up the context
    app.context.utils = utils;
    app.use(async (ctx, next) => {
        // Set up util functions
        ctx.utils(ctx);

        // Log request
        ctx.util.start();
        await next();
        ctx.util.end();
    });
};
