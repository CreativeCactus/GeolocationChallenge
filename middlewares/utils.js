const utils = { 
    start: ctx => () => {
        ctx.startTime = new Date();
        console.log(`<-- ${ctx.method} ${ctx.url}`); 
    },
    end: ctx => (status, error, extra) => {
        const time = new Date() - ctx.startTime;

        ctx.status = status || ctx.status;

        const duration = `${time}ms`;

        if (error) {
            console.log(`--> ERROR: ${ctx.method} ${ctx.url} ${duration} ${ctx.status} ${error}`);
            ctx.throw(ctx.status, error, extra);
        }

        console.log(`--> ${ctx.method} ${ctx.url} ${duration} ${ctx.status}`);
    },
    statusEnum: ['error', 'pending', 'ready'],
    statusToInt: ctx => (s) => {
        const i = ctx.util.statusEnum.indexOf(s);
        return (i < 0) ? 0 : i;
    },
    intToStatus: ctx => i => ctx.util.statusEnum[i] || 'error'
};

// Map utils onto context, currying functions only
module.exports = (ctx) => {
    ctx.util = Object.keys(utils)
        .reduce((curried, key) => {
            const util = utils[key];
            if (typeof util === 'function') {
                curried[key] = util(ctx);
            } else {
                curried[key] = util;
            }
            return curried;
        }, {});

    return ctx;
};

