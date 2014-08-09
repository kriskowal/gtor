// ## Credits
/*!
 * Copyright 2009-2014 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 */
// With thanks to Mark Miller, creator of E promises and numerous documents and
// examples regarding promises in JavaScript.
// With thanks to Tyler Close, creator of the Waterken Q library, after which
// these promises were originally modeled.
// With thanks to Domenic Denicola for adopting my fork of Q and making its
// cause his own.

// ## Foreword

// For Vim
/* vim:ts=4:sts=4:sw=4: */
// For JSHint
/*global -WeakMap */
// For ECMAScript 5
"use strict";

// A promise is a proxy for a result, be it a return value or a thrown error,
// regardless of whether that result happened in the past or the future, or
// even off in some other memory space.

// To make promises, we will enlist the aid of some of our friends.

var WeakMap = require("collections/weak-map");
var Iterator = require("collections/iterator");
// For executing tasks in seaparate events as soon as possible, without waiting
// yielding for IO or rendering.
var asap = require("asap");

// As a promise makes progress toward creating a result, it may need to defer
// to other promises multiple times before reaching a conclusion.
// For example, a promise to authenticate a user might first wait for the user
// to enter their name and then wait for the user to enter their password.
// In the way a relay runner passes a baton, promises have a handler that they
// can forward to another promise.
// This happens when a promise is resolved with another promise, or more often,
// when a promise handler function returns another promise.
// A deferred promise starts with a `PendingHandler`, which may pass along to
// any number of pending handlers before reaching a `FulfilledHandler` or
// `RejectedHandler`.
// There is also a `ThenableHandler` that keeps track of a foreign promise and
// makes sure we only call its `then` method once to convert it to one of our
// own.
// Another kind of handler can handle promises for remote objects and is
// responsible for forwarding messages across some message channel.

// Which handler is responsible for a particular promise is tracked by this
// weak map, making it rather difficult to confuse the internals of this module
// with a fake promise object and rather effectively hides the handler from
// anyone using the library.
var handlers = new WeakMap();

// When a deferred promise is forwarded to another promise, the old handler
// becomes the new handler and all messages past and present flow to the next
// handler.
// This algorithm shortens the chain each time someone accesses the handler for
// either a promise or a resolver, ensuring that future lookups are faster.
function Promise_getHandler(promise) {
    var handler = handlers.get(promise);
    while (handler && handler.became) {
        handler = handler.became;
    }
    handlers.set(promise, handler);
    return handler;
}

// The vicious cycle is a singleton promise that we use to break cyclic
// resolution chains.
// If you ever resolve a deferred promise ultimately with itself, you will get
// this promise instead.
var theViciousCycleError = new Error("Can't resolve a promise with itself");
var theViciousCycleRejection = Promise_throw(theViciousCycleError);
var theViciousCycle = Promise_getHandler(theViciousCycleRejection);

// We use this week map to ensure that we convert a thenable promise to a
// proper promise, calling its then method, once.
// A proper promise does not produce side effects when you call `then`, but
// thenables do not make that guarantee.
// A thenable might for example only start working when you call `then`, every
// time you call `then`.
var thenables = new WeakMap();

// And now the star of the show...

// ## Promise constructor

/**
 * Creates a promise.
 * @param handler may be a function or a promise handler object.
 * If it is a function, the function is called before this constructor returns,
 * with the arguments `resolve`, `reject`, and `setEstimate`, the former also
 * known as `return` and `throw`.
 * An exception thrown in the setup function will be forwarded to the promise.
 * A return value will be ignored.
 * The setup function is responsible for arranging one of the given functions
 * to be called with an eventual result.
 */
module.exports = Promise;
function Promise(handler) {
    if (!(this instanceof Promise)) {
        return new Promise(handler);
    }
    if (typeof handler === "function") {
        // "Instead of handler, got setup function.
        // Would not buy again."
        var setup = handler;
        var deferred = Promise_defer();
        handler = Promise_getHandler(deferred.promise);
        try {
            setup(deferred.resolve, deferred.reject, deferred.setEstimate);
        } catch (error) {
            deferred.resolver.throw(error);
        }
    }
    handlers.set(this, handler);
}

// ### Methods

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 *
 * @returns {{promise, resolve, reject}} a deferred
 */
Promise.defer = Promise_defer;
function Promise_defer() {

    var handler = new Pending();
    var promise = new Promise(handler);
    var deferred = new Deferred(promise);

    return deferred;
}

/**
 * Coerces a value to a promise. If the value is a promise, pass it through
 * unaltered. If the value has a `then` method, it is presumed to be a promise
 * but not one of our own, so it is treated as a “thenable” promise and this
 * returns a promise that stands for it. Otherwise, this returns a promise that
 * has already been fulfilled with the value.
 * @param value promise, object with a then method, or a fulfillment value
 * @returns {Promise} the same promise as given, or a promise for the given
 * value
 */
Promise.return = Promise_return;
function Promise_return(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (isPromise(value)) {
        return value;
    } else if (isThenable(value)) {
        if (!thenables.has(value)) {
            thenables.set(value, new Promise(new Thenable(value)));
        }
        return thenables.get(value);
    } else {
        return new Promise(new Fulfilled(value));
    }
}

/**
 * Returns a promise that has been rejected with a reason, which should be an
 * instance of `Error`.
 * @param {Error} error reason for the failure.
 * @returns {Promise} rejection
 */
Promise.throw = Promise_throw;
function Promise_throw(error) {
    return new Promise(new Rejected(error));
}

/**
 * @returns {boolean} whether the given value is a promise.
 */
Promise.isPromise = isPromise;
function isPromise(object) {
    return Object(object) === object && !!handlers.get(object);
}

/**
 * @returns {boolean} whether the given value is an object with a then method.
 * @private
 */
function isThenable(object) {
    return Object(object) === object && typeof object.then === "function";
}

/**
 * Coerces a value to a promise if it is not one already and then waits for it
 * to be fulfilled or rejected, returning a promise for the result of either
 * the fulfillment or rejection handler.
 */
Promise.when = function Promise_when(value, onreturn, onthrow, ms) {
    return Promise.return(value).then(onreturn, onthrow, ms);
};

/**
 * Turns an array of promises into a promise for an array.  If any of the
 * promises gets rejected, the whole array is rejected immediately.
 * @param {Array.<Promise>} an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Promise.<Array>} a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Promise.all = Promise_all;
function Promise_all(questions) {
    var countDown = 0;
    var deferred = Promise_defer();
    var answers = Array(questions.length);
    var estimates = [];
    var estimate = -Infinity;
    var setEstimate;
    Array.prototype.forEach.call(questions, function Promise_all_each(promise, index) {
        var handler;
        if (
            isPromise(promise) &&
            (handler = Promise_getHandler(promise)).state === "fulfilled"
        ) {
            answers[index] = handler.value;
        } else {
            ++countDown;
            promise = Promise_return(promise);
            promise.done(
                function Promise_all_eachFulfilled(value) {
                    answers[index] = value;
                    if (--countDown === 0) {
                        deferred.resolver.return(answers);
                    }
                },
                deferred.reject
            );

            promise.observeEstimate(function Promise_all_eachEstimate(newEstimate) {
                var oldEstimate = estimates[index];
                estimates[index] = newEstimate;
                if (newEstimate > estimate) {
                    estimate = newEstimate;
                } else if (oldEstimate === estimate && newEstimate <= estimate) {
                    // There is a 1/length chance that we will need to perform
                    // this O(length) walk, so amortized O(1)
                    computeEstimate();
                }
                if (estimates.length === questions.length && estimate !== setEstimate) {
                    deferred.setEstimate(estimate);
                    setEstimate = estimate;
                }
            });

        }
    });

    function computeEstimate() {
        estimate = -Infinity;
        for (var index = 0; index < estimates.length; index++) {
            if (estimates[index] > estimate) {
                estimate = estimates[index];
            }
        }
    }

    if (countDown === 0) {
        deferred.resolver.return(answers);
    }

    return deferred.promise;
}

/**
 * @see Promise#allSettled
 */
Promise.allSettled = Promise_allSettled;
function Promise_allSettled(questions) {
    return Promise_all(questions.map(function Promise_allSettled_each(promise) {
        promise = Promise_return(promise);
        function regardless() {
            return promise.inspect();
        }
        return promise.then(regardless, regardless);
    }));
}

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Promise.delay = function Promise_delay(object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Promise_return(object).delay(timeout);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {String} custom error message (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Promise.timeout = function Promise_timeout(object, ms, message) {
    return Promise_return(object).timeout(ms, message);
};

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param onreturn callback that receives variadic arguments from the
 * promised array
 * @param onthrow callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Promise.spread = Promise_spread;
function Promise_spread(value, onreturn, onthrow) {
    return Promise_return(value).spread(onreturn, onthrow);
}

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Promise.join = function Promise_join(x, y) {
    return Promise_spread([x, y], function Promise_joined(x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become fulfilled.
 * @param answers {Array} promises to race
 * @returns {Promise} the first promise to be fulfilled
 */
Promise.race = Promise_race;
function Promise_race(answerPs) {
    return new Promise(function(deferred) {
        answerPs.forEach(function(answerP) {
            Promise_return(answerP).then(deferred.resolve, deferred.reject);
        });
    });
}

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param thisp     call context, in the JavaScript sense, which may not be
 *                  applicable to promises for remote non-JavaScript objects.
 * @param ...args   array of application arguments
 */
Promise.try = function Promise_try(callback, thisp) {
    var args = [];
    for (var index = 2; index < arguments.length; index++) {
        args[index - 2] = arguments[index];
    }
    return Promise_return(callback).dispatch("call", [args, thisp]);
};

/**
 * TODO
 */
Promise.function = Promise_function;
function Promise_function(wrapped) {
    return function promiseFunctionWrapper() {
        var args = new Array(arguments.length);
        for (var index = 0; index < arguments.length; index++) {
            args[index] = arguments[index];
        }
        return Promise_return(wrapped).apply(this, args);
    };
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Promise.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Promise.return(a), Promise.return(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Promise.promised = function Promise_promised(callback) {
    return function promisedMethod() {
        var args = new Array(arguments.length);
        for (var index = 0; index < arguments.length; index++) {
            args[index] = arguments[index];
        }
        return Promise_spread(
            [this, Promise_all(args)],
            function Promise_promised_spread(self, args) {
                return callback.apply(self, args);
            }
        );
    };
};

/**
 */
Promise.passByCopy = // TODO XXX experimental
Promise.push = function (value) {
    if (Object(value) === value && !isPromise(value)) {
        passByCopies.set(value, true);
    }
    return value;
};

Promise.isPortable = function (value) {
    return Object(value) === value && passByCopies.has(value);
};

var passByCopies = new WeakMap();

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators. Although generators are only
 * part of the newest ECMAScript 6 drafts, this code does not cause
 * syntax errors in older engines. This code should continue to work
 * and will in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * `--harmony-generators` runtime flag enabled. This function does not
 * support the former, Pythonic generators that were only implemented
 * by SpiderMonkey.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Promise.async = Promise_async;
function Promise_async(makeGenerator) {
    return function spawn() {
        // when verb is "next", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var iteration;
            try {
                iteration = generator[verb](arg);
            } catch (exception) {
                return Promise_throw(exception);
            }
            if (iteration.done) {
                return Promise_return(iteration.value);
            } else {
                return Promise_return(iteration.value).then(callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Promise.spawn = Promise_spawn;
function Promise_spawn(makeGenerator) {
    Promise_async(makeGenerator)().done();
}



// ## Promise prototype


// ### Regarding the state of the promise

/**
 * Synchronously produces a snapshot of the internal state of the promise.  The
 * object will have a `state` property. If the `state` is `"pending"`, there
 * will be no further information. If the `state` is `"fulfilled"`, there will
 * be a `value` property. If the state is `"rejected"` there will be a `reason`
 * property.  If the promise was constructed from a “thenable” and `then` nor
 * any other method has been dispatched on the promise has been called, the
 * state will be `"pending"`. The state object will not be updated if the
 * state changes and changing it will have no effect on the promise. Every
 * call to `inspect` produces a unique object.
 * @returns {{state: string, value?, reason?}}
 */
Promise.prototype.inspect = function Promise_inspect() {
    // the second layer captures only the relevant "state" properties of the
    // handler to prevent leaking the capability to access or alter the
    // handler.
    return Promise_getHandler(this).inspect();
};

/**
 * @returns {boolean} whether the promise is waiting for a result.
 */
Promise.prototype.isPending = function Promise_isPending() {
    return Promise_getHandler(this).state === "pending";
};

/**
 * @returns {boolean} whether the promise has ended in a result and has a
 * fulfillment value.
 */
Promise.prototype.isFulfilled = function Promise_isFulfilled() {
    return Promise_getHandler(this).state === "fulfilled";
};

/**
 * @returns {boolean} whether the promise has ended poorly and has a reason for
 * its rejection.
 */
Promise.prototype.isRejected = function Promise_isRejected() {
    return Promise_getHandler(this).state === "rejected";
};

/**
 * TODO
 */
Promise.prototype.toBePassed = function Promise_toBePassed() {
    return Promise_getHandler(this).state === "passed";
};

/**
 * @returns {string} merely `"[object Promise]"`
 */
Promise.prototype.toString = function Promise_toString() {
    return "[object Promise]";
};

// ### Composition

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param onreturn
 * @param onthrow
 */
Promise.prototype.done = function Promise_done(onreturn, onthrow, thisp) {
    var self = this;
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks
    asap(function Promise_done_task() {
        var _onreturn;
        if (typeof onreturn === "function") {
            if (Promise.onerror) {
                _onreturn = function Promise_done_onreturn(value) {
                    if (done) {
                        return;
                    }
                    done = true;
                    try {
                        onreturn.call(thisp, value);
                    } catch (error) {
                        // fallback to rethrow is still necessary because
                        // _onreturn is not called in the same event as the
                        // above guard.
                        (Promise.onerror || Promise_rethrow)(error);
                    }
                };
            } else {
                _onreturn = function Promise_done_onreturn(value) {
                    if (done) {
                        return;
                    }
                    done = true;
                    onreturn.call(thisp, value);
                };
            }
        }

        var _onthrow;
        if (typeof onthrow === "function" && Promise.onerror) {
            _onthrow = function Promise_done_onthrow(error) {
                if (done) {
                    return;
                }
                done = true;
                // makeStackTraceLong(error, self);
                try {
                    onthrow.call(thisp, error);
                } catch (newError) {
                    (Promise.onerror || Promise_rethrow)(newError);
                }
            };
        } else if (typeof onthrow === "function") {
            _onthrow = function Promise_done_onthrow(error) {
                if (done) {
                    return;
                }
                done = true;
                // makeStackTraceLong(error, self);
                onthrow.call(thisp, error);
            };
        } else {
            _onthrow = Promise.onerror || Promise_rethrow;
        }

        if (typeof process === "object" && process.domain) {
            _onthrow = process.domain.bind(_onthrow);
        }

        Promise_getHandler(self).dispatch(_onreturn, "then", [_onthrow]);
    });
};

/**
 * Creates a new promise, waits for this promise to be resolved, and informs
 * either the fullfilled or rejected handler of the result. Whatever result
 * comes of the onreturn or onthrow handler, a value returned, a promise
 * returned, or an error thrown, becomes the resolution for the promise
 * returned by `then`.
 *
 * @param onreturn
 * @param onthrow
 * @returns {Promise} for the result of `onreturn` or `onthrow`.
 */
Promise.prototype.then = function Promise_then(onreturn, onthrow) {
    var self = this;
    var deferred = Promise_defer();

    var ms, status, thisp, arg;
    for (var index = 0; index < arguments.length; index++) {
        arg = arguments[index];
        if (typeof arg === "number") { // ms estimated duration of fulfillment handler
            ms = arg;
        } else if (typeof arg === "string") { // status
            status = arg;
        } else if (typeof arg === "object") { // thisp
            thisp = arg;
        }
    }

    var _onreturn;
    if (typeof onreturn === "function") {
        _onreturn = function Promise_then_onreturn(value) {
            try {
                deferred.resolver.return(onreturn.call(thisp, value));
            } catch (error) {
                deferred.resolver.throw(error);
            }
        };
    } else {
        _onreturn = deferred.resolve;
    }

    var _onthrow;
    if (typeof onthrow === "function") {
        _onthrow = function Promise_then_onthrow(error) {
            try {
                deferred.resolver.return(onthrow.call(thisp, error));
            } catch (newError) {
                deferred.resolver.throw(newError);
            }
        };
    } else {
        _onthrow = deferred.reject;
    }

    this.done(_onreturn, _onthrow, thisp);

    if (ms !== void 0) {
        var updateEstimate = function Promise_then_updateEstimate() {
            deferred.setEstimate(self.getEstimate() + ms);
        };
        this.observeEstimate(updateEstimate);
        updateEstimate();
    }

    return deferred.promise;
};

function Promise_rethrow(error) {
    throw error;
}

/**
 * Waits for the fulfillment of this promise then resolves the returned promise
 * with the given value.
 */
Promise.prototype.thenReturn = function Promise_thenReturn(value) {
    // Wrapping ahead of time to forestall multiple wrappers.
    value = Promise_return(value);
    // Using all is necessary to aggregate the estimated time to completion.
    return Promise_all([this, value]).then(function Promise_thenReturn_resolved() {
        return value;
    }, null, 0);
    // 0: does not contribute significantly to the estimated time to
    // completion.
};

/**
 * Waits for the fulfillment of this promise and then rejects the returned
 * promise with the given error.
 */
Promise.prototype.thenThrow = function Promise_thenThrow(error) {
    return this.then(function Promise_thenThrow_resolved() {
        throw error;
    }, null, 0);
    // 0: does not contribute significantly to the estimated time to
    // completion.
};

/**
 * A shorthand for `then(null, onthrow)`, only catches exceptions and allows
 * values to pass through.
 */
Promise.prototype.catch = function Promise_catch(onthrow, thisp) {
    return this.then(void 0, onthrow, thisp);
};

/**
 * Ensures that the given handler will run regardless when this promise settles.
 * This promise's fulfillment value or rejection error should pass through
 * unaltered, but may be delayed if the finally handler returns a promise, and
 * may be replaced if the finally handler eventually throws an error.
 */
Promise.prototype.finally = function Promise_finally(callback) {
    if (!callback) {
        return this;
    }

    callback = Promise_return(callback);
    var ms, status, thisp, arg;
    for (var index = 0; index < arguments.length; index++) {
        arg = arguments[index];
        if (typeof arg === "number") { // ms estimated duration of fulfillment handler
            ms = arg;
        } else if (typeof arg === "string") { // status
            status = arg;
        } else if (typeof arg === "object") { // thisp
            thisp = arg;
        }
    }

    return this.then(function (value) {
        return callback.call(thisp).then(function Promise_finally_onreturn() {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.call(thisp).then(function Promise_finally_onthrow() {
            throw reason;
        });
    }, status, ms);
};


// ### Segue to promises for arrays

/**
 * Similar to `then` but waits for the fulfillment of this promise to become an
 * array and then spreads those values into the arguments of a fulfillment
 * handler.
 */
Promise.prototype.spread = function Promise_spread(onreturn, onthrow, ms) {
    return this.then(function Promise_spread_onreturn(array) {
        return onreturn.apply(void 0, array);
    }, onthrow, ms);
};

/**
 * Transforms this promise for an array of promises and transforms it to a
 * promise for an array of the corresponding fulfillment values, but rejects
 * immediately if any of the given promises are onthrow.
 */
Promise.prototype.all = function Promise_all() {
    return this.then(Promise_all);
};

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function Promise_allSettled() {
    return this.then(Promise_allSettled);
};


// ### Regarding the estimated time to completion

/**
 * TODO
 */
Promise.prototype.observeEstimate = function Promise_observeEstimate(emit) {
    this.rawDispatch(null, "estimate", [emit]);
    return this;
};

/**
 * TODO
 */
Promise.prototype.getEstimate = function Promise_getEstimate() {
    return Promise_getHandler(this).estimate;
};

// ### Regarding the status

// TODO

// ### Sending messages to promises for objects

/**
 * Sends a message to a promise, receiving the resolution through an optional
 * callback.
 */
Promise.prototype.rawDispatch = function Promise_rawDispatch(resolve, op, args) {
    var self = this;
    asap(function Promise_dispatch_task() {
        Promise_getHandler(self).dispatch(resolve, op, args);
    });
};

/**
 * Sends a message to a promise, returning a promise for the result.
 */
Promise.prototype.dispatch = function Promise_dispatch(op, args) {
    var deferred = Promise_defer();
    this.rawDispatch(deferred.resolve, op, args);
    return deferred.promise;
};

/**
 * Returns a promise for a property of the eventual value of this promise.
 */
Promise.prototype.get = function Promise_get(name) {
    return this.dispatch("get", [name]);
};

/**
 * Returns a promise for the result of a method invocation on the eventual
 * value of this promise.
 */
Promise.prototype.invoke = function Promise_invoke(name /*...args*/) {
    var args = new Array(arguments.length - 1);
    for (var index = 1; index < arguments.length; index++) {
        args[index - 1] = arguments[index];
    }
    return this.dispatch("invoke", [name, args]);
};

/**
 * Returns a promise for the result of applying the eventual function that this
 * promise resolves to.
 */
Promise.prototype.apply = function Promise_apply(thisp, args) {
    return this.dispatch("call", [args, thisp]);
};

/**
 * Returns a promise for the result of applying the eventual function that this
 * promise resolves to, with the rest of the arguments.
 */
Promise.prototype.call = function Promise_call(thisp /*, ...args*/) {
    var args = new Array(Math.max(0, arguments.length - 1));
    for (var index = 1; index < arguments.length; index++) {
        args[index - 1] = arguments[index];
    }
    return this.dispatch("call", [args, thisp]);
};

/**
 * Returns a function that will return a promise for the eventual application
 * of the promised function with the rest of these arguments and the given
 * arguments combined.
 */
Promise.prototype.bind = function Promise_bind(thisp /*, ...args*/) {
    var self = this;
    var args = new Array(Math.max(0, arguments.length - 1));
    for (var index = 1; index < arguments.length; index++) {
        args[index - 1] = arguments[index];
    }
    return function Promise_bind_bound(/*...args*/) {
        var boundArgs = args.slice();
        for (var index = 0; index < arguments.length; index++) {
            boundArgs[boundArgs.length] = arguments[index];
        }
        return self.dispatch("call", [boundArgs, thisp]);
    };
};

/**
 * Returns a promise for the keys of the eventual object for this promise.
 */
Promise.prototype.keys = function Promise_keys() {
    return this.dispatch("keys", []);
};

/**
 * Returns a promise for an iterator of the eventual object for this promise.
 */
Promise.prototype.iterate = function Promise_iterate() {
    return this.dispatch("iterate", []);
};


// ### Promises and time

/**
 * Causes a promise to be onthrow if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Number} milliseconds timeout
 * @param {String} custom error message (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise onthrow.
 */
Promise.prototype.timeout = function Promsie_timeout(ms, message) {
    var deferred = Promise_defer();
    var timeoutId = setTimeout(function Promise_timeout_task() {
        deferred.resolver.throw(new Error(message || "Timed out after " + ms + " ms"));
    }, ms);

    this.done(function Promise_timeout_onreturn(value) {
        clearTimeout(timeoutId);
        deferred.resolver.return(value);
    }, function Promise_timeout_onthrow(error) {
        clearTimeout(timeoutId);
        deferred.resolver.throw(error);
    });

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Promise.prototype.delay = function Promise_delay(ms) {
    return this.then(function Promise_delay_onreturn(value) {
        var deferred = Promise_defer();
        deferred.setEstimate(Date.now() + ms);
        var timeoutId = setTimeout(function () {
            deferred.resolve(value);
        }, ms);
        return deferred.promise;
    }, null, ms);
};


// ### Promises for remote values and objects

/**
 * Returns a promise for a copy of the remote object or array proxied by this
 * promise.
 */
Promise.prototype.pull = function Promise_pull() {
    return this.dispatch("pull", []);
};

/**
 * Returns a promise for the same value, except noting that it should be passed
 * by copy instead of by reference if it is transported to a remote promise.
 */
Promise.prototype.pass = function Promise_pass() {
    if (!this.toBePassed()) {
        return new Promise(new Passed(this));
    } else {
        return this;
    }
};


// ## Deferred

// Thus begins the portion of the interface dedicated to pending promises.

// A deferred retains a private reference to the promise it corresponds to so
// that if its promise property is overwritten, as it is when using deferreds
// in PromiseQueue, the resolver will still communicate with its intrinsic
// promise dual.
var promises = new WeakMap();

exports.Deferred = Deferred;
function Deferred(promise) {
    this.promise = promise;
    promises.set(this, promise);
    var self = this;

    var resolve = this.return;

    // Bind the resolver

    // Also support a new interface that hosts the resolver methods together,
    // as the singular analog of an asynchronous generator, or the asynchronous
    // analog of a singular setter.
    this.resolver = {};

    this.resolver.return =
    this.return =
    this.resolve = function (value) {
        resolve.call(self, value);
    };

    var reject = this.throw;
    this.resolver.throw =
    this.throw =
    this.reject = function (error) {
        reject.call(self, error);
    };

    this.in = this.resolver;
    this.out = this.promise;
}

/**
 * Sets the resolution of the corresponding promise to the given fulfillment
 * value or promise, causing the pending messages to be forwarded.
 */
Deferred.prototype.return = function Deferred_return(value) {
    var handler = Promise_getHandler(promises.get(this));
    if (!handler.messages) {
        return;
    }
    handler.become(Promise.return(value));
};

/**
 * Sets the resolution of the corresponding promise to an asynchronously thrown
 * error.
 */
Deferred.prototype.throw = function Deferred_throw(reason) {
    var handler = Promise_getHandler(promises.get(this));
    if (!handler.messages) {
        return;
    }
    handler.become(Promise_throw(reason));
};


// ### Regarding the estimated time to completion

/**
 * Sets and emits the estimated time to completion for this promise, eventually
 * notifying all observers.
 */
Deferred.prototype.setEstimate = function Deferred_setEstimate(estimate) {
    estimate = +estimate;
    if (estimate !== estimate) {
        estimate = Infinity;
    }
    if (estimate < 1e12 && estimate !== -Infinity) {
        throw new Error("Estimate values should be a number of miliseconds in the future");
    }
    var handler = Promise_getHandler(promises.get(this));
    // TODO There is a bit of capability leakage going on here. The Deferred
    // should only be able to set the estimate for its original
    // Pending, not for any handler that promise subsequently became.
    if (handler.setEstimate) {
        handler.setEstimate(estimate);
    }
};

// Thus ends the public interface.

// And, thus begins the portion dedicated to handlers.

// Handlers represent the state of a promise and determine how the promise
// handles messages and state inquiries.

function Fulfilled(value) {
    this.value = value;
    this.estimate = Date.now();
}

Fulfilled.prototype.state = "fulfilled";

Fulfilled.prototype.inspect = function Fulfilled_inspect() {
    return {state: "fulfilled", value: this.value};
};

Fulfilled.prototype.dispatch = function Fulfilled_dispatch(
    resolve, op, operands
) {
    var result;
    if (
        op === "then" ||
        op === "get" ||
        op === "call" ||
        op === "invoke" ||
        op === "keys" ||
        op === "iterate" ||
        op === "pull"
    ) {
        try {
            result = this[op].apply(this, operands);
        } catch (exception) {
            result = Promise_throw(exception);
        }
    } else if (op === "estimate") {
        operands[0].call(void 0, this.estimate);
    } else {
        var error = new Error(
            "Fulfilled promises do not support the " + op + " operator"
        );
        result = Promise_throw(error);
    }
    if (resolve) {
        resolve(result);
    }
};

Fulfilled.prototype.then = function Fulfilled_then() {
    return this.value;
};

Fulfilled.prototype.get = function Fulfilled_get(name) {
    return this.value[name];
};

Fulfilled.prototype.call = function Fulfilled_call(args, thisp) {
    return this.callInvoke(this.value, args, thisp);
};

Fulfilled.prototype.invoke = function Fulfilled_invoke(name, args) {
    return this.callInvoke(this.value[name], args, this.value);
};

Fulfilled.prototype.callInvoke = function Fulfilled_callInvoke(callback, args, thisp) {
    var waitToBePassed;
    for (var index = 0; index < args.length; index++) {
        if (isPromise(args[index]) && args[index].toBePassed()) {
            waitToBePassed = waitToBePassed || [];
            waitToBePassed.push(args[index]);
        }
    }
    if (waitToBePassed) {
        var self = this;
        return Promise_all(waitToBePassed).then(function () {
            return self.callInvoke(callback, args.map(function (arg) {
                if (isPromise(arg) && arg.toBePassed()) {
                    return arg.inspect().value;
                } else {
                    return arg;
                }
            }), thisp);
        });
    } else {
        return callback.apply(thisp, args);
    }
};

Fulfilled.prototype.keys = function Fulfilled_keys() {
    return Object.keys(this.value);
};

Fulfilled.prototype.iterate = function Fulfilled_iterate() {
    return new Iterator(this.value);
};

Fulfilled.prototype.pull = function Fulfilled_pull() {
    var result;
    if (Object(this.value) === this.value) {
        result = Array.isArray(this.value) ? [] : {};
        for (var name in this.value) {
            result[name] = this.value[name];
        }
    } else {
        result = this.value;
    }
    return Promise.push(result);
};


function Rejected(reason) {
    this.reason = reason;
    this.estimate = Infinity;
}

Rejected.prototype.state = "rejected";

Rejected.prototype.inspect = function Rejected_inspect() {
    return {state: "rejected", reason: this.reason};
};

Rejected.prototype.dispatch = function Rejected_dispatch(
    resolve, op, operands
) {
    var result;
    if (op === "then") {
        result = this.then(resolve, operands[0]);
    } else {
        result = this;
    }
    if (resolve) {
        resolve(result);
    }
};

Rejected.prototype.then = function Rejected_then(
    onreturn, onthrow
) {
    return onthrow ? onthrow(this.reason) : this;
};


function Pending() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    this.messages = [];
    this.observers = [];
    this.estimate = Infinity;
}

Pending.prototype.state = "pending";

Pending.prototype.inspect = function Pending_inspect() {
    return {state: "pending"};
};

Pending.prototype.dispatch = function Pending_dispatch(resolve, op, operands) {
    this.messages.push([resolve, op, operands]);
    if (op === "estimate") {
        this.observers.push(operands[0]);
        var self = this;
        asap(function Pending_dispatch_task() {
            operands[0].call(void 0, self.estimate);
        });
    }
};

Pending.prototype.become = function Pending_become(promise) {
    this.became = theViciousCycle;
    var handler = Promise_getHandler(promise);
    this.became = handler;

    handlers.set(promise, handler);
    this.promise = void 0;

    this.messages.forEach(function Pending_become_eachMessage(message) {
        // makeQ does not have this asap call, so it must be queueing events
        // downstream. TODO look at makeQ to ascertain
        asap(function Pending_become_eachMessage_task() {
            var handler = Promise_getHandler(promise);
            handler.dispatch.apply(handler, message);
        });
    });

    this.messages = void 0;
    this.observers = void 0;
};

Pending.prototype.setEstimate = function Pending_setEstimate(estimate) {
    if (this.observers) {
        var self = this;
        self.estimate = estimate;
        this.observers.forEach(function Pending_eachObserver(observer) {
            asap(function Pending_setEstimate_eachObserver_task() {
                observer.call(void 0, estimate);
            });
        });
    }
};

function Thenable(thenable) {
    this.thenable = thenable;
    this.became = null;
    this.estimate = Infinity;
}

Thenable.prototype.state = "thenable";

Thenable.prototype.inspect = function Thenable_inspect() {
    return {state: "pending"};
};

Thenable.prototype.cast = function Thenable_cast() {
    if (!this.became) {
        var deferred = Promise_defer();
        var thenable = this.thenable;
        asap(function Thenable_cast_task() {
            try {
                thenable.then(deferred.resolve, deferred.reject);
            } catch (exception) {
                deferred.resolver.throw(exception);
            }
        });
        this.became = Promise_getHandler(deferred.promise);
    }
    return this.became;
};

Thenable.prototype.dispatch = function Thenable_dispatch(resolve, op, args) {
    this.cast().dispatch(resolve, op, args);
};

// A passed promise is a thin proxy for another promise and differs only in
// that its state is "passed".
// This allows a message passing transport to identify this promise as one that
// should eventually pass its value by copy to the other end of any connection.

function Passed(promise) {
    this.promise = promise;
}

Passed.prototype.state = "passed";

Passed.prototype.inspect = function Passed_inspect() {
    return this.promise.inspect();
};

Passed.prototype.dispatch = function Passed_dispatch(resolve, op, args) {
    return this.promise.rawDispatch(resolve, op, args);
};


// ## Node.js

// Thus begins the Promise Node.js bridge

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Promise and appended to these arguments.
 * @returns a promise for the value or error
 */
Promise.ninvoke = function Promise_ninvoke(object, name /*...args*/) {
    var args = new Array(Math.max(0, arguments.length - 1));
    for (var index = 2; index < arguments.length; index++) {
        args[index - 2] = arguments[index];
    }
    var deferred = Promise_defer();
    args[index - 2] = deferred.makeNodeResolver();
    Promise_return(object).dispatch("invoke", [name, args]).catch(deferred.reject);
    return deferred.promise;
};

Promise.prototype.ninvoke = function Promise_ninvoke(name /*...args*/) {
    var args = new Array(arguments.length);
    for (var index = 1; index < arguments.length; index++) {
        args[index - 1] = arguments[index];
    }
    var deferred = Promise_defer();
    args[index - 1] = deferred.makeNodeResolver();
    this.dispatch("invoke", [name, args]).catch(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a Node.js continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Promise.denodeify(FS.readFile)(__filename, "utf-8")
 * .then(console.log)
 * .done()
 */
Promise.denodeify = function Promise_denodeify(callback, pattern) {
    return function denodeified() {
        var args = new Array(arguments.length + 1);
        var index = 0;
        for (; index < arguments.length; index++) {
            args[index] = arguments[index];
        }
        var deferred = Promise_defer();
        args[index] = deferred.makeNodeResolver(pattern);
        Promise_return(callback).apply(this, args).catch(deferred.reject);
        return deferred.promise;
    };
};

/**
 * Creates a Node.js-style callback that will resolve or reject the deferred
 * promise.
 * @param unpack `true` means that the Node.js-style-callback accepts a
 * fixed or variable number of arguments and that the deferred should be resolved
 * with an array of these value arguments, or rejected with the error argument.
 * An array of names means that the Node.js-style-callback accepts a fixed
 * number of arguments, and that the resolution should be an object with
 * properties corresponding to the given names and respective value arguments.
 * @returns a nodeback
 */
Deferred.prototype.makeNodeResolver = function (unpack) {
    var resolve = this.resolve;
    if (unpack === true) {
        return function variadicNodebackToResolver(error) {
            if (error) {
                resolve(Promise_throw(error));
            } else {
                var value = new Array(Math.max(0, arguments.length - 1));
                for (var index = 1; index < arguments.length; index++) {
                    value[index - 1] = arguments[index];
                }
                resolve(value);
            }
        };
    } else if (unpack) {
        return function namedArgumentNodebackToResolver(error) {
            if (error) {
                resolve(Promise_throw(error));
            } else {
                var value = {};
                for (var index = 0; index < unpack.length; index++) {
                    value[unpack[index]] = arguments[index + 1];
                }
                resolve(value);
            }
        };
    } else {
        return function nodebackToResolver(error, value) {
            if (error) {
                resolve(Promise_throw(error));
            } else {
                resolve(value);
            }
        };
    }
};

/**
 * A utility that allows a function to produce a promise or use a Node.js style
 * codeback depending on whether the user provided one.
 */
Promise.prototype.nodeify = function Promise_nodeify(nodeback) {
    if (nodeback) {
        this.done(function (value) {
            nodeback(null, value);
        }, nodeback);
    } else {
        return this;
    }
};

