
const Koa = require('koa');

const middlewares = require('./middlewares');
const frontend = require('./frontend');
const config = require('./config');
const api = require('./api');

const app = new Koa();

middlewares(app, config);
frontend(app);
api(app);

app.use((ctx) => { 
    ctx.redirect('/');
    // ctx.util.end(404, 'Unknown endpoint'); 
});

// todo catch compile error and print trace only if debug
console.log('Todo move config out');

app.listen(config.port, config.host, () => {
    console.log(`Listening on ${config.host || ''}:${config.port}`);
});
