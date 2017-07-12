const bodyParser = require('koa-bodyparser');
const koaRouter = require('koa-router');
const crypto = require('crypto');

const geo = require('./geolocation');

const router = koaRouter({
    prefix: '/api'
});

router.use(bodyParser({
    enableTypes: ['json'],
    onerror: (err, ctx) => {
        if (ctx.config.debug) console.dir(err);
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

    // Generate a hash ID for this request
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    // Include some crypto random to prevent attacks via selected ID, also improve ID-space
    const id = hash.digest('hex').slice(0, 8) + crypto.randomBytes(4).toString('hex');

    // Store the root of the request synchronously
    const request = {
        numChildren: validated.length,
        start: ctx.startTime,
        message: 'Started.',
        status: 'pending',
        type: 'request',
        id
    }; 
    const insertion = new Promise((a, r) => {
        try {
            ctx.db.insert(request, (err, docs) => {
                if (err) throw err;
            });
        } catch (err) {
            if (!err) {
                console.log('Unexpected db insertion failure');
                return;
            }
            if (ctx.config.debug) {
                ctx.body = err;
            } else {
                ctx.util.end(400, `Error: ${err.message}`);
            }
            console.dir(err);
        }
        a();
    });
    await insertion;

    // Format and store the locations asynchronously
    ctx.db.insert(validated, (err, docs) => {
        if (err && ctx.config.debug) return console.dir(err);
        console.dir({ docs });

        // Find the locations with the given addresses (some might not be unique, so not in docs)
        const addresses = validated.map(l => l.address);
        ctx.db.find({ type: 'location', address: { $in: addresses } }, (err, docs) => {
            if (err && ctx.config.debug) return console.dir(err);

            const ids = docs.map(d => d._id);

            // Update the parent request with the location ids
            ctx.db.update({ id, type: 'request' }, { $set: { children: ids } }, {}, (err, num) => {
                if (err && ctx.config.debug) return console.dir(err);
            });
        });
    });

    ctx.body = {
        status: ctx.util.statusToInt('pending'),
        request
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
    const id = ctx.params.id;

    // Promise request with given id
    const getReq = new Promise((a, r) => {
        ctx.db.find({ type: 'request', id }, (err, docs) => {
            if (ctx.config.debug && err) {
                console.dir(e); 
                return a({ err: { code: 500, err: JSON.stringify(err) } });
            }
            if (err) {
                return a({ err: { code: 500, err: 'Internal Server Error' } });
            }
            if (docs.length < 1) {
                return a({ err: { code: 404, err: 'Record not found' } });
            }
            if (docs.length > 1) {
                return a({ err: { code: 500, err: 'Record Error' } });
            }

            a({ req: docs[0] });
        });
    });

    // Promise array of locations matching array of ids
    const getLocs = ids => new Promise((a, r) => {
        if (!ids || !ids.length) return a({ locs: [] });
        ctx.db.find({ type: 'location', status: ctx.util.statusToInt('ready') }, (err, docs) => {
            if (ctx.config.debug && err) {
                console.dir(e);
                return a({ err: { code: 500, err: JSON.stringify(err) } });
            }
            if (err) {
                return a({ err: { code: 500, err: 'Internal Server Error' } });
            }

            a({ locs: docs });
        });
    });


    const parent = await getReq;
    if (parent.err || parent.req === null) {        
        return ctx.util.end(parent.err.code || 500, parent.err || 'Internal Server Error');
    }

    const { locs, err } = await getLocs(parent.req.children);
    if (err || locs === null) {
        return ctx.util.end(parent.err.code || 500, parent.err || 'Internal Server Error');
    }

    const result = {
        id: parent.req.id,
        percent: ~~((100 * parent.req.children.length) / (locs.length || 0.1)),
        message: parent.req.message,
        children: locs.map((loc) => { delete loc.id; return loc; })
    };

    ctx.body = result;
});

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
