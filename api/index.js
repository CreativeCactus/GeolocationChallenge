const bodyParser = require('koa-bodyparser');
const koaRouter = require('koa-router');
const crypto = require('crypto');

const geo = require('./geolocation');
const DB = require('./db');

const router = koaRouter({
    prefix: '/api'
});

router.use(bodyParser({
    enableTypes: ['json'],
    onerror: (err, ctx) => {
        if (ctx.config.debug) console.trace(err);
        ctx.util.end(400, `Malformed JSON: ${err.message}`);
    }
}));

/*
 .o88b. d8888b. d88888b  .d8b.  d888888b d88888b 
d8P  Y8 88  `8D 88'     d8' `8b `~~88~~' 88'     
8P      88oobY' 88ooooo 88ooo88    88    88ooooo 
8b      88`8b   88~~~~~ 88~~~88    88    88~~~~~ 
Y8b  d8 88 `88. 88.     88   88    88    88.     
 `Y88P' 88   YD Y88888P YP   YP    YP    Y88888P
*/

router.post('/', async (ctx) => {
    const db = DB(ctx);
    const data = ctx.request.body;
    ctx.body = { status: 'Interrupted...' };

    if (!Array.isArray(data)) {
        ctx.util.end(400, 'Malformed JSON: not array');
    }

    // Check that all data contains .name, .address
    const validated = data.filter((d, i) => {
        const valid = d.name && d.address;
        if (!valid && !ctx.config.allowPartialData) {
            ctx.util.end(400, `Malformed JSON: Datum ${i} missing name/address`);
        }
        return valid;
    }).map((loc) => { // Add empty location, status and type
        loc.location = '';
        loc.type = 'location';
        loc.status = ctx.util.statusToInt('pending');
        return loc;
    });
    const addresses = validated.map(l => l.address);
    const indexed = validated.reduce((t, loc) => { // Reduce to an object, index by address.
        t[loc.address] = loc;
        return t;
    }, {});
    // Generate a hash ID for this request
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    // Include some crypto random to prevent attacks via selected ID, also improve ID-space
    const id = hash.digest('hex').slice(0, 8) + crypto.randomBytes(4).toString('hex');


    // Calculate the initial progress
    const exist = (await db.location.find({ address: { $in: addresses } })) || [];
    const all = (await db.location.find({ })) || [];
    const complete = exist.filter(loc => loc.status === ctx.util.statusToInt('ready'));
    const percent = ~~((100 * validated.length) / complete.length);
    const status = (percent === 100) ? 'ready' : 'pending';

    // Exclude extant records from insertion
    exist.forEach((loc) => { delete indexed[loc.address]; });
    const validatedTrimmed = Object.values(indexed) || [];
    
    // Store the root of the request synchronously
    const request = {
        children: exist.map(loc => loc._id) || [],
        status: ctx.util.statusToInt(status),
        numChildren: validated.length,
        numComplete: exist.length,
        start: ctx.startTime,
        type: 'request',
        id
    }; 
    const result = await db.request.insert(request).catch((err) => {
        if (ctx.config.debug) {
            ctx.body = err;
        } else {
            ctx.util.end(400, `Error: ${err.message}`);
        }
    });

    // Format and store the locations asynchronously, one by one (some may be dupe)
    for (let i = 0; i < validatedTrimmed.length; i++) {
        validatedTrimmed[i] = await db.location.insert(validatedTrimmed[i]);
    }
    // Find the locations with the given addresses (some might not be unique, so not in docs)
    db.location.find({ address: { $in: addresses } }).then((docs = []) => {
        const ids = docs.map(d => d._id);

        // Update the parent request with the location ids
        db.request.update({ id, type: 'request' }, { $set: { children: ids } });
    });

    // Formulate a response
    const response = Object.assign({}, request);
    response.percent = percent;
    response.children = exist;

    ctx.body = {
        status: ctx.util.statusToInt('pending'),
        request: presentable(response, ctx.util)
    };
});

/*
d8888b. d88888b  .d8b.  d8888b. 
88  `8D 88'     d8' `8b 88  `8D 
88oobY' 88ooooo 88ooo88 88   88 
88`8b   88~~~~~ 88~~~88 88   88 
88 `88. 88.     88   88 88  .8D 
88   YD Y88888P YP   YP Y8888D'
*/

router.get('/:id', async (ctx) => {
    const db = DB(ctx);
    const id = ctx.params.id;

    // Promise request with given id
    const request = await db.request.findOne({ id }).then(doc => ({ doc })).catch(err => ({ err }));
    if (ctx.config.debug && request.err) {
        console.trace(err); 
        return ctx.util.end(500, JSON.stringify(request.err));
    }
    if (request.err) {
        return ctx.util.end(500, 'Internal Server Error');
    }
    if (!request.doc || request.doc.length < 1) {
        return ctx.util.end(404, 'Record not found');
    }

    // Get array of locations matching array of ids
    const childIds = request.doc.children;
    let locations = { locs: [] };
    if (childIds && childIds.length) {
        locations = await db.location.find({ 
            _id: { $in: childIds },
            status: ctx.util.statusToInt('ready')
        })
            .then(locs => ({ locs }))
            .catch(err => ({ err }));
    }

    if (ctx.config.debug && locations.err) {
        console.trace(err);
        return ctx.util.end(500, JSON.stringify(request.err));
    }
    if (locations.err) {
        return ctx.util.end(500, 'Internal Server Error');
    }

    // Re-evaluate status, then update async
    const done = (request.doc.numComplete === request.doc.numChildren);
    const status = ctx.util.statusToInt(done ? 'ready' : 'pending');
    if (status !== request.doc.status) {
        request.doc.status = status;
        db.request.update({ id }, request.doc);
    }

    // Formulate response
    const response = Object.assign({}, request.doc, { children: locations.locs });
    ctx.body = presentable(response, ctx.util);
});

function presentable(req, util) {
    const percent = req.numComplete ? ~~((100 * req.numComplete) / req.numChildren) : 0;
    const result = {
        id: req.id,
        type: req.type,
        start: req.start,
        children: req.children || [],
        numComplete: req.numComplete,
        numChildren: req.numChildren,
        percent: req.percent || percent,
        status: (typeof req.status === 'string') ? req.status : util.intToStatus(req.status)
    };
    return result;
}

module.exports = (app) => {
    app.use(router.routes());
    app.use(router.allowedMethods());
    // Start background polling for locations to convert
    geo(
        app.context.db,
        app.context.config,
        app.context.utils
        );
};
