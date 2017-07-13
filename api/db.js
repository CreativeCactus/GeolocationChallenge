module.exports = (ctx) => {
    const db = ctx.db; 
    const util = ctx.util;
    const config = ctx.config;

    class Schema {
        constructor(type) {
            this.type = type;
        }
        async insert(doc) {
            doc.type = this.type;
            return new Promise((a, r) => {
                ctx.db.insert(doc, (err, done) => {
                    if (err && ctx.config.debug) console.trace(err);
                    if (err) return r(err);
                    return a(done);
                });
            });
        }
        async find(query) {
            query.type = this.type;
            return new Promise((a, r) => {
                ctx.db.find(query, (err, docs) => {
                    if (err && ctx.config.debug) console.trace(err);
                    if (err) return r(err);
                    return a(docs);
                });
            });
        }
        async findOne(query) {
            query.type = this.type;
            return new Promise((a, r) => {
                db.findOne(query, (err, doc) => {
                    if (err && ctx.config.debug) console.trace(err);
                    if (err) return r(err);
                    return a(doc);
                });
            });
        }
        async update(query, update, options = {}) {
            query.type = this.type;
            return new Promise((a, r) => {
                db.update(query, update, options, (err, num) => {
                    if (err && ctx.config.debug) console.trace(err);
                    if (err) return r(err);
                    return a(num);
                });
            });
        }
        async count(query) {
            query.type = this.type;
            return new Promise((a, r) => {
                db.count(query, (err, num) => {
                    if (err && ctx.config.debug) console.trace(err);
                    if (err) return r(err);
                    return a(num);
                });
            });
        }
    }

    class Location extends Schema {
        constructor() {
            super('location');
        }
    }

    class Request extends Schema {
        constructor() {
            super('request');
        }
    }

    return {
        location: new Location(),
        request: new Request()
    };
};
