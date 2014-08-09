"use strict";

var asap = require("asap");

module.exports = Observer;
function Observer(callback, thisp, signal) {
    this.callback = callback;
    this.thisp = thisp;
    this.signal = signal;
    this.value = null;
    this.index = null;
    this.pending = false;
}

Observer.prototype.yield = function (value, index) {
    this.value = value;
    this.index = index;
    this.done = false;
    if (!this.pending) {
        this.pending = true;
        asap(this);
    }
};

Observer.prototype.call = function () {
    if (this.pending) {
        this.pending = false;
        this.callback.call(this.thisp, this.value, this.index, this.signal);
    }
};

Observer.prototype.cancel = function () {
    var index = this.signal.observers.indexOf(this);
    this.pending = false;
    this.signal.observers.swap(index, 1);
};

