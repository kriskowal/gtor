
// A promise queue is an asynchronous linked list, representing a sequence of
// values over time.
// Consuming and producing that sequence are temporaly independent.
// For each respective promise and resolution, the promise may be gotten first
// and put later, or put first and gotten later.

"use strict";

var Promise = require("./promise");

// ## PromiseQueue

// The promise queue constructor returns an entangled `get` and `put` pair.
// These methods may be passed as functions, granting either the capability to
// give or take but not necessarily both.

// Internally, a promise queue is an asynchronous linked list of deferreds.
// The `ends` variable is a `promise` and `resolver` pair.
// The `promise` is a promise for the next `ends` pair after this promise is
// taken.
// The `resolver` advances the `ends` pair after a resolution is given.
// The `promise` and `resolver` are independent properties, not necessarily
// corresponding to the same deferred.

module.exports = PromiseQueue;
function PromiseQueue(values) {
    if (!(this instanceof PromiseQueue)) {
        return new PromiseQueue();
    }
    var self = this;

    var ends = Promise.defer();

    // The `resolver` side of a promise queue adds a `{head, tail}` node to the
    // asynchronous linked list.
    // The `put` method creates a new link to the resolver side with the given
    // `head` value, and advances the `resolver` side of the list.
    this.put = function (value) {
        var next = Promise.defer();
        ends.resolver.return({
            head: value,
            tail: next.promise
        });
        ends.resolver = next.resolver;
    };

    // The `promise` end of a promise queue is a promise for a `{head, tail}`
    // pair.
    // The `head` will be the next value, and the `tail` will be a promise for
    // the remaining nodes of the list.
    // The `get` method obtains and returns a promise for the `head` value and
    // advances the `promise` to become the `tail`.
    this.get = function () {
        var result = ends.promise.get("head");
        ends.promise = ends.promise.get("tail");
        return result;
    };

    // The promise queue constructor allows the queue to be initialized with
    // a given population of values.
    if (values) {
        values.forEach(this.put, this);
    }
}

