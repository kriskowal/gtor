"use strict";

var Task = require("./task");

module.exports = TaskQueue;
function TaskQueue(values) {
    if (!(this instanceof TaskQueue)) {
        return new TaskQueue();
    }
    var self = this;

    var ends = new this.Task;

    this.put = function (value) {
        var next = self.Task.defer();
        ends.resolve({
            head: value,
            tail: next.out
        });
        ends.resolve = next.resolve;
    };

    this.get = function () {
        var result = ends.out.get("head");
        ends.out = ends.out.get("tail");
        return result;
    };

    if (values) {
        values.forEach(this.put, this);
    }
}

TaskQueue.prototype.Task = Task;

TaskQueue.prototype.forEach = function (callback, thisp) {
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

