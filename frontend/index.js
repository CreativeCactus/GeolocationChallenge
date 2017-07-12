const koaRouter = require('koa-router');
const statics = require('koa-static');
const mount = require('koa-mount');
const hamlc = require('haml');
const path = require('path');
const fs = require('fs');


const cwd = path.join.bind({}, process.cwd());

const router = koaRouter();

// Define compilers
const compile = {
    // HAML compiler
    haml: (file, args, handler) => {
        const data = fs.readFileSync(file);
        const template = hamlc.compile(data.toString());
        const sender = (ctx, locals) => hamlc.execute(template, {
            // Custom error handler for haml compilation
            _err: (e, formatted) => {
                console.dir(e);
                return ctx.config.debug ? formatted : '500: Internal server error';
            }
        }, locals);
        return handler.bind({}, sender);
    },
    // Static file handler with some settings and defaults
    serve: (file, args, handler) => {
        const data = fs.readFileSync(file);
        const sender = ctx => data;

        handler = handler || (async (send, ctx) => { ctx.body = send(); });

        // Automatically set the mime type if any given
        if (args && args.mimeType) {
            const underlying = handler;
            handler = async (send, ctx, next) => { 
                ctx.type = args.mimeType; 
                await underlying(send, ctx, next);
            };
        }

        return handler.bind({}, sender);
    }
};

router.get('/', compile.haml(cwd('/frontend/src/index.haml'), {}, async (send, ctx) => {
    ctx.body = send(ctx, { 
        stats: `${ctx.stats.locations} locations indexed to date!`,
        poll: ctx.config.poll,
        googleapikey: ctx.config.google.apikey
    });
}));

router.get('/style.css', compile.serve(cwd('/frontend/src/style.css'), { mimeType: 'text/css' }));
router.get('/favicon.ico', compile.serve(cwd('/frontend/src/favicon.ico'),
    { mimeType: 'image/x-icon' },
    async (send, ctx) => {
        ctx.set('Cache-Control', 'public, max-age=86400');
        ctx.body = send(ctx);
    }
));

module.exports = (app) => {
    app.use(router.routes());
    app.use(router.allowedMethods());
    // Serve assets statically
    app.use(mount('/assets', statics(cwd('/frontend/src/assets'))));
};
