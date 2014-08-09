"use strict";

var WeakMap = require("weak-map");
var Observer = require("./observer");
var Operators = require("./operators");
var Iteration = require("./iteration");

var handlers = new WeakMap();

module.exports = Signal;
function Signal(value) {
    var handler = new this.Handler(value);
    this.in = new this.Generator(handler);
    this.out = new this.Observer(handler);
}

Signal.return = function (value) {
    return new Signal(value).out;
};

Signal.prototype.Handler = SignalHandler;
Signal.prototype.Generator = SignalGenerator;
Signal.prototype.Observer = SignalObserver;

function SignalHandler(value, index) {
    this.observers = [];
    this.value = value;
    this.index = index;
}

SignalHandler.prototype.Iteration = Iteration;

SignalHandler.prototype.yield = function (value, index) {
    this.value = value;
    this.index = index;
    var observers = this.observers;
    var length = observers.length;
    var observerIndex = observers.length;
    while (observerIndex--) {
        observers[observerIndex].yield(value, index);
    }
};

function SignalGenerator(handler) {
    handlers.set(this, handler);
}

SignalGenerator.prototype.yield = function (value, index) {
    var handler = handlers.get(this);
    handler.yield(value, index);
};

SignalGenerator.prototype.inc = function () {
    var handler = handlers.get(this);
    this.yield(handler.value + 1, Date.now());
};

SignalGenerator.prototype.dec = function () {
    var handler = handlers.get(this);
    this.yield(handler.value - 1, Date.now());
};

function SignalObserver(handler) {
    handlers.set(this, handler);
}

SignalObserver.prototype.next = function () {
    var handler = handlers.get(this);
    return new handler.Iteration(handler.value, false, handler.index);
};

// `forEach` registers an observer for the signal and returns the observer.
// An observer can be cancelled.
SignalObserver.prototype.forEach = function (callback, thisp) {
    var handler = handlers.get(this);
    var observers = handler.observers;
    var observer = new Observer(callback, thisp, handler);
    observers.unshift(observer);
    if (handler.value != null) {
        observer.yield(handler.value, handler.index);
    }
    return observer;
};

// `map` produces a new signal that yields the return value of the given
// callback for each value in from this signal.

SignalObserver.prototype.map = function (callback, thisp) {
    var signal = new Signal();
    this.forEach(function (value, index) {
        signal.in.yield(callback.call(thisp, value, index, this), index);
    }, this);
    return signal.out;
};

// `filter` produces a signal that yields the values from this signal if they
// pass a test.

SignalObserver.prototype.filter = function (callback, thisp) {
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

SignalObserver.prototype.reduce = function (callback, basis, thisp) {
    var signal = new Signal();
    this.forEach(function (value, index) {
        basis = callback.call(thisp, basis, value, index, this);
        signal.in.yield(basis, index);
    }, this);
    return signal.out;
};

// Transforms this signal into a pulse.
// Each time this signal produces a value, the returned signal will produce the
// given value.

SignalObserver.prototype.pulse = function (value) {
    return this.map(function () {
        return value;
    });
};

// Transforms this signal into a pulse counter.
// For each value that this signal produces, the returned signal will produce
// the count of values seen so far.

SignalObserver.prototype.count = function (count, increment) {
    var signal = new Signal();
    count = count || 0;
    this.forEach(function (_, index) {
        count = (increment ? increment(count) : count + 1);
        signal.in.yield(count, index);
    });
    return signal.out;
};

// Lifts a function from value space into signal space, such that instead of
// accepting and returning values, it instead accepts and returns signals.

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

// Generates operator methods using lift, so signals can be composed.

for (var name in Operators) {
    (function (operator, name) {
        Signal[name] = Signal.lift(operator, Operators);
        SignalObserver.prototype[name] = function (that) {
            return Signal[name](this, that);
        };
    })(Operators[name], name);
}

