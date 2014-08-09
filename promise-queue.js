"use strict";

var Promise = require("./promise");

module.exports = PromiseQueue;
function PromiseQueue(values) {
    if (!(this instanceof PromiseQueue)) {
        return new PromiseQueue();
    }
    var self = this;

    var ends = this.Promise.defer();

    this.put = function (value) {
        var next = self.Promise.defer();
        ends.resolve({
            head: value,
            tail: next.promise
        });
        ends.resolve = next.resolve;
    };

    this.get = function () {
        var result = ends.promise.get("head");
        ends.promise = ends.promise.get("tail");
        return result;
    };

    if (values) {
        values.forEach(this.put, this);
    }
}

PromiseQueue.prototype.Promise = Promise;

PromiseQueue.prototype.forEach = function (callback, thisp) {
    var self = this;
    function next() {
        return self.get()
        .then(function (value) {
            return callback.call(thisp, value);
        })
        .then(next);
    }
    return next();
};

