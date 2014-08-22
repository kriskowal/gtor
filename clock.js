// TODO rebase on observable

// A clock is an observable signal that emits a pulse with the current time
// with a given period and offset.
// The period is a number of miliseconds and the pulse will be emitted at times
// past the epoch that are multiples of that period, plus the offset
// miliseconds.

"use strict";

var Signal = require("./signal");

// ## Clock
//
// The clock constructor accepts the period and offsets in miliseconds, and
// allows you to optionally override the `now` function, which should provide
// the current time in miliseconds.

module.exports = Clock;
function Clock(options) {
    options = options || {};
    var handler = new this.Handler(options.period, options.offset, options.now);
    Signal.prototype.Observable.call(this, handler);
}

// Clock inherits exclusively from the observable side of a signal and
// generates values internally.
Clock.prototype = Object.create(Signal.prototype.Observable.prototype);
Clock.prototype.constructor = Clock;
Clock.prototype.Handler = ClockHandler;

// ## ClockHandler
//
// The clock handler inherits the utilities of a normal signal handler, but
// also does some book keeping to schedule timers, activate, and deactivate.

function ClockHandler(period, offset, now) {
    Signal.prototype.Handler.call(this);
    this.next = null;
    this.period = period || 1000;
    this.offset = offset || 0;
    this.now = now || this.now;
    this.value = this.now();
    this.timeout = null;
    // We use the tock method as a timeout handler, so it has to be bound.
    this.tock = this.tock.bind(this);
}

ClockHandler.prototype = Object.create(Signal.prototype.Handler.prototype);
ClockHandler.prototype.constructor = ClockHandler;
ClockHandler.prototype.now = Date.now;

// The `tick` method arranges for a `tock` method call at the next time that
// aligns with the period and offset.
// Note that a clock may miss beats if the process spends too much time between
// events.
ClockHandler.prototype.tick = function (now) {
    if (this.next === null) {
        this.next = Math.ceil(
            Math.floor(
                (now - this.offset) / this.period
            ) + .5
        ) * this.period + this.offset;
        this.timeout = setTimeout(this.tock, this.next - now);
    }
};

// The `tock` method responds to timers and propagates the current time, both
// as the pulse value and time index.
ClockHandler.prototype.tock = function () {
    this.next = null;
    var now = this.now();
    this.yield(now, now);
    if (this.active) {
        this.tick(now);
    }
};

ClockHandler.prototype.timer = true;

// The signal handler arranges for active and inactive state changes by calling
// either `onstart` or `onstop` depending on whether there are any observers
// registered.

// When the clock becomes active, we kick off an initial tick.
// Each subsequent tick is scheduled by the `tock` method if the clock remains
// active.
ClockHandler.prototype.onstart = function () {
    this.tick(this.value);
};

// The `onstop` method cancels the next `tick`, breaking the chain of scheduled
// pulses.
ClockHandler.prototype.onstop = function () {
    if (this.timeout) {
        clearTimeout(this.timeout);
    }
};

