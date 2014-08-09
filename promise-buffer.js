"use strict";

var Iteration = require("./iteration");
var Promise = require("./promise");
var PromiseQueue = require("./promise-queue");
var Signal = require("./signal");
var Task = require("./task");
var WeakMap = require("weak-map");

var handlers = new WeakMap();

// ## PromiseBuffer

module.exports = PromiseBuffer;
function PromiseBuffer(values, returnValue) {
    if (!(this instanceof PromiseBuffer)) {
        return new PromiseBuffer();
    }
    var handler = new this.Handler(values, returnValue);
    this.in = new this.Generator(handler, this);
    this.out = new this.Iterator(handler, this);
}

PromiseBuffer.prototype.Handler = PromiseBufferHandler;
PromiseBuffer.prototype.Iterator = PromiseIterator;
PromiseBuffer.prototype.Generator = PromiseGenerator;

function PromiseBufferHandler(values, returnValue) {
    this.in = new PromiseQueue();
    this.out = new PromiseQueue();
    if (typeof values === "number") {
        while (values--) {
            this.prime();
        }
    } else if (values) {
        values.forEach(this.prime, this);
    }
    if (values != null) {
        this.out.put(new Iteration(returnValue, true));
    }
}

// Pre-acknowledges receiving an object so the producer be one more object
// ahead of the consumer.
PromiseBufferHandler.prototype.prime = function (value, index) {
    this.out.put(new this.Iteration(value, false, index));
};

PromiseBufferHandler.prototype.get = function (iteration) {
    this.in.put(iteration);
    return this.out.get();
};

PromiseBufferHandler.prototype.put = function (iteration) {
    this.out.put(iteration);
    return this.in.get();
};

PromiseBufferHandler.prototype.Iteration = Iteration;


// ## PromiseGenerator

function PromiseGenerator(handler, parent) {
    handlers.set(this, handler);
    this.parent = parent;
    this.yield = this.yield.bind(this);
    this.return = this.return.bind(this);
    this.throw = this.throw.bind(this);
}

PromiseGenerator.prototype.Promise = Promise;

PromiseGenerator.prototype.yield = function (value, index) {
    var handler = handlers.get(this);
    return handler.put(new handler.Iteration(value, false, index));
};

PromiseGenerator.prototype.return = function (value) {
    var handler = handlers.get(this);
    return handler.put(new handler.Iteration(value, true));
};

PromiseGenerator.prototype.throw = function (error) {
    var handler = handlers.get(this);
    return handler.put(this.Promise.throw(error || new Error("Producer canceled stream")));
};


// ## PromiseIterator

function PromiseIterator(handler, parent) {
    handlers.set(this, handler);
    this.parent = parent;
}

PromiseIterator.prototype.next = function (value, index) {
    var handler = handlers.get(this);
    return handler.get(new handler.Iteration(value, false, index));
}

PromiseIterator.prototype.throw = function (error) {
    var handler = handlers.get(this);
    return handler.put(Promise.throw(error || new Error("Consumer canceled stream")));
};

// TODO consider naming this pipe or pipeTo
PromiseIterator.prototype.copy = function (generator, options) {
    var done = this.forEach(generator.yield, generator);
    if (!options || options.close !== false) {
        done = done.then(function (value) {
            return generator.return(value);
        });
    }
    return done;
};

// The pipe as in pipeThrough idea is a bit of a bust because using .map does
// the same job as passing an equivalent PromiseMachine with buffered input and
// output but doesn't have the dangling promise and silent errors.
//PromiseIterator.prototype.pipe = function (pipe, options) {
//    this.copy(pipe.in, options);
//    // TODO handle errors on returned promise, which indicate that the target
//    // pipe input closed prematurely.
//    return pipe.out;
//};

PromiseIterator.prototype.do = function (callback, errback, limit) {
    var next;
    if (limit == null) {
        next = function () {
            return this.next()
            .then(function (iteration) {
                next.call(this);
                return callback(iteration);
            }, null, this)
        };
    } else {
        var semaphore = new PromiseQueue();
        while (limit--) {
            semaphore.put();
        }
        next = function () {
            return semaphore.get()
            .then(function (resource) {
                return this.next()
                .then(function (iteration) {
                    next.call(this);
                    return Promise.try(callback, null, iteration)
                    .finally(function () {
                        semaphore.put(resource);
                    })
                }, null, this);
            }, null, this)
            .done(null, errback);
        }
    }
    next.call(this);
};

PromiseIterator.prototype.forEach = function (callback, thisp, limit) {
    var result = Task.defer(function () {
        this.throw();
    }, this);
    if (limit == null) { limit = 1; }
    var count = new Signal(0);
    var done = new Signal(false);
    var returnValue;
    this.do(function (iteration) {
        if (iteration.done) {
            returnValue = iteration.value;
            done.in.yield(true);
        } else {
            count.in.inc();
            return Promise.try(callback, thisp, iteration.value, iteration.index)
            .finally(function () {
                count.in.dec();
            })
        }
    }, result.in.throw, limit);
    count.out.equals(Signal.return(0)).and(done.out).forEach(function (done) {
        if (done) {
            result.in.return(returnValue);
        }
    });
    return result.out;
};

PromiseIterator.prototype.map = function (callback, thisp, limit) {
    var result = new this.parent.constructor(); // PromiseBuffer, polymorphic
    var count = new Signal(0);
    var done = new Signal(false);
    var returnValue;
    this.do(function (iteration) {
        if (iteration.done) {
            returnValue = iteration.value;
            done.in.yield(true);
        } else {
            count.in.inc();
            return Promise.try(callback, thisp, iteration.value, iteration.index)
            .then(function (value) {
                return result.in.yield(value, iteration.index);
            })
            .finally(function () {
                count.in.dec();
            });
        }
    }, result.in.throw, limit);
    count.out.equals(Signal.return(0)).and(done.out).forEach(function (done) {
        if (done) {
            result.in.return(returnValue);
        }
    });
    return result.out;
};

PromiseIterator.prototype.filter = function (callback, thisp, limit) {
    var result = new this.parent.constructor(); // PromiseBuffer, polymorphic
    var count = new Signal(0);
    var done = new Signal(false);
    var returnValue;
    this.do(function (iteration) {
        if (iteration.done) {
            returnValue = iteration.value;
            done.in.yield(true);
        } else {
            count.in.inc();
            return Promise.try(callback, thisp, iteration.value, iteration.index)
            .then(function (value) {
                if (value) {
                    return result.in.yield(iteration.value, iteration.index);
                }
            })
            .finally(function () {
                count.in.dec();
            });
        }
    }, result.in.throw, limit);
    // when (count == 0 && done)
    count.out.equals(Signal.return(0)).and(done.out).forEach(function (done) {
        if (done) {
            result.in.return(returnValue);
        }
    });
    return result.out;
};

// TODO reduce, some, every

