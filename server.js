
const Koa = require('koa');

const middlewares = require('./middlewares');
const frontend = require('./frontend');
const config = require('./config');
const api = require('./api');

const app = new Koa();

middlewares(app, config);
frontend(app);
api(app);

// 404
app.use((ctx) => { 
    ctx.redirect('/');
});

app.listen(config.port, config.host, () => {
    console.log(`Listening on ${config.host || ''}:${config.port}`);
});

if (config.debug) {
    process.on('unhandledRejection', (err, p) => {
        console.trace(err);
    });
}
