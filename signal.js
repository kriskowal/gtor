
// A signal is a **push** representation of a value that varies at **discrete**
// and observable moments in time.

"use strict";

var asap = require("asap");
var WeakMap = require("weak-map");
require("collections/shim-array");
var Observer = require("./observer");
var Operators = require("./operators");
var Iteration = require("./iteration");

// ## Signal
//
// A Signal contains a `Generator` and an `Observable`.
// The generator is the **setter** or **producer** side and the observable is
// the **getter** or **consumer** side.
// We dub the generator `in` and the observable `out` to reflect the shape of a
// `PromiseBuffer` stream.
// These input and output objects share internal private state captured by a
// `Handler`.
//
// The signal constructor accepts an optional initial value and index.

module.exports = Signal;
function Signal(value, index) {
    var handler = new this.Handler(value, index);
    this.in = new this.Generator(handler);
    this.out = new this.Observable(handler);
}

// The `return` constructor method accepts a value and optional index and
// produces an observable signal for that static value.
Signal.return = function (value, index) {
    return new Signal(value, index).out;
};

// The Handler, Generator, and Observable constructors can all be overridden by
// derrived types.
Signal.prototype.Handler = SignalHandler;
Signal.prototype.Generator = SignalGenerator;
Signal.prototype.Observable = SignalObservable;

// ## SignalHandler
//
// The observable and generator sides of a signal share private state on a
// signal handler hidden record.
// We use a weak map to track the corresponding handler for each generator and
// observable.

var handlers = new WeakMap();

function SignalHandler(value, index) {
    this.observers = [];
    this.value = value;
    this.index = index;
    this.active = false;
}

SignalHandler.prototype.Iteration = Iteration;

// The generator side uses the `yield` method to set the current value of the
// signal for a given time index and to arrange for an update to all observers.
// Note that we track observers in reverse order to take advantage of a small
// optimization afforded by countdown loops.
SignalHandler.prototype.yield = function (value, index) {
    if (!this.active) {
        return;
    }
    this.value = value;
    this.index = index;
    var observers = this.observers;
    var length = observers.length;
    var observerIndex = observers.length;
    while (observerIndex--) {
        observers[observerIndex].yield(value, index);
    }
};

/* TODO yieldEach to mirror yield* syntax of generators, possibly using handler
 * trickery. */

// The observable side of the signal uses `addObserver` and `cancelObserver`.

// The `addObserver` method will implicitly dispatch an initial value if the signal
// has been initialized and has already captured a meaningful value.
SignalHandler.prototype.addObserver = function (observer) {
    this.observers.unshift(observer);
    if (this.active && Operators.defined(this.value)) {
        observer.yield(this.value, this.index);
    }
    // If this is the first observer, we may need to activate the signal.
    asap(this);
};

SignalHandler.prototype.cancelObserver = function (observer) {
    var index = this.observers.indexOf(observer);
    if (index < 0) {
        return;
    }
    this.observers.swap(index, 1);
    // If this was the last remaining observer, we may need to deactivate the
    // signal.
    asap(this);
};

// The add and cancel observer methods both use asap to arrange for a possible
// signal state change, between active and inactive, in a separate event.
// Derrived signal handlers, for example the `ClockHandler`, may implement
// `onstart` and `onstop` event handlers.
SignalHandler.prototype.call = function () {
    if (!this.active) {
        if (this.observers.length) {
            if (this.onstart) {
                this.onstart();
            }
            this.active = true;
        }
    } else {
        if (!this.observers.length) {
            if (this.onstop) {
                this.onstop();
            }
            this.active = false;
        }
    }
};

// ## SignalGenerator
//
// A producer should receive a reference to the generator side of a signal.
// It hosts the methods needed to change the value captured by a signal and
// propagate change notifications.

function SignalGenerator(handler) {
    handlers.set(this, handler);
}

// The `yield` method updates the value for a given time index and radiates a
// change notification to any registered observers.
SignalGenerator.prototype.yield = function (value, index) {
    var handler = handlers.get(this);
    handler.yield(value, index);
};

// The `inc` method assumes that the signal captures an integer and increments
// that value by one.
SignalGenerator.prototype.inc = function () {
    var handler = handlers.get(this);
    this.yield(handler.value + 1, Date.now());
};

// The `dec` method assumes that the signal captures an integer and decrements
// that value by one.
SignalGenerator.prototype.dec = function () {
    var handler = handlers.get(this);
    this.yield(handler.value - 1, Date.now());
};

// ## SignalObservable
//
// A consumer should receive a reference to a signal observable, from which
// it can obtain observers.

function SignalObservable(handler) {
    handlers.set(this, handler);
}

// The `get` method provides the portion of the interface necessary to mimick a
// `Behavior`.
SignalObservable.prototype.get = function () {
    var handler = handlers.get(this);
    return handler.value;
};

// The `next` method provides the portion of the interface necessary to mimick
// an `Iterator`.
SignalObservable.prototype.next = function () {
    var handler = handlers.get(this);
    return new handler.Iteration(handler.value, false, handler.index);
};

// `forEach` registers an observer for the signal and returns the observer.
// An observer can be cancelled.
SignalObservable.prototype.forEach = function (callback, thisp) {
    var handler = handlers.get(this);
    var observers = handler.observers;
    var observer = new Observer(callback, thisp, handler);
    handler.addObserver(observer);
    return observer;
};

// `map` produces a new signal that yields the return value of the given
// callback for each value in from this signal.
SignalObservable.prototype.map = function (callback, thisp) {
    var signal = new Signal();
    this.forEach(function (value, index) {
        signal.in.yield(callback.call(thisp, value, index, this), index);
    }, this);
    return signal.out;
};

// `filter` produces a signal that yields the values from this signal if they
// pass a test.
SignalObservable.prototype.filter = function (callback, thisp) {
    var signal = new Signal();
    this.forEach(function (value, index) {
        if (callback.call(thisp, value, index, this)) {
            signal.in.yield(value, index);
        }
    }, this);
    return signal.out;
};

// `reduce` produces a signal that yields the most recently accumulated value
// by combining each of this signals values with the aggregate of all previous.
// Note that unlike the array reducer, the basis is mandatory.
SignalObservable.prototype.reduce = function (callback, basis, thisp) {
    var signal = new Signal();
    this.forEach(function (value, index) {
        basis = callback.call(thisp, basis, value, index, this);
        signal.in.yield(basis, index);
    }, this);
    return signal.out;
};

// The `thenYield` method ransforms this signal into a pulse.
// Each time this signal produces a value, the returned signal will yield the
// given value.
// The name is intended to parallel the `thenReturn` and `thenThrow` methods of
// tasks and promises.
SignalObservable.prototype.thenYield = function (value) {
    return this.map(function () {
        return value;
    });
};

// The `count` method transforms this signal into a pulse counter.
// For each value that this signal produces, the returned signal will produce
// the count of values seen so far.
SignalObservable.prototype.count = function (count, increment) {
    var signal = new Signal();
    count = count || 0;
    this.forEach(function (_, index) {
        count = (increment ? increment(count) : count + 1);
        signal.in.yield(count, index);
    });
    return signal.out;
};

// The `lift` constructor method lifts an operator from value space into signal
// space, such that instead of accepting and returning values, it instead
// accepts and returns signals.
/* TODO alter this method so that it can accept a mix of behaviors and signals */
Signal.lift = function (operator, thisp) {
    return function signalOperator() {
        var operandSignals = Array.prototype.slice.call(arguments);
        var operands = new Array(operandSignals.length);
        var defined = new Array(operandSignals.length);
        var pending = operandSignals.length;
        var signal = new Signal();
        operandSignals.forEach(function (operandSignal, index) {
            operandSignal.forEach(function (operand, time) {
                if (operand == null || operand !== operand) {
                    if (defined[index]) {
                        defined[index] = false;
                        pending++;
                    }
                    operands[index] = operand;
                } else {
                    operands[index] = operand;
                    if (!defined[index]) {
                        defined[index] = true;
                        pending--;
                    }
                    if (!pending) {
                        signal.in.yield(operator.apply(thisp, operands), time);
                    }
                }
            });
        });
        return signal.out;
    };
}

// For each operato in the `Operators` module, we produce both a constructor
// and a prototype method with the corresponding operator or method in signal space.
for (var name in Operators) {
    (function (operator, name) {
        Signal[name] = Signal.lift(operator, Operators);
        SignalObservable.prototype[name] = function (that) {
            return Signal[name](this, that);
        };
    })(Operators[name], name);
}

