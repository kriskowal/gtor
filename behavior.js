
// A behavior is a **pull** or **poll** representation of a value that varies
// **continuously** over time.
// Behaviors only model the **getter** side of the *getter, setter, value*
// triad because they produce the value for any given time on demand.

"use strict";

var WeakMap = require("collections/weak-map");
var Operators = require("./operators");
var Iteration = require("./iteration");

// ### BehaviorHandler

// The private handler for a behavior captures its internal state.

function BehaviorHandler(callback, thisp) {
    this.callback = callback;
    this.thisp = thisp;
}

// We have to set this up before constructing singleton behaviors.
var handlers = new WeakMap();

// ## Behavior
//
// The behavior constructor accepts a method and optional context object for
// that method.
// This method will be polled at each time the behavior is called upon to
// produce a new value.

module.exports = Behavior;
function Behavior(callback, thisp) {
    // Behaviors use a weak map of hidden records for private state.
    var handler = new BehaviorHandler(callback, thisp);
    handlers.set(this, handler);
}

// The `return` static method creates a behavior that provides the given
// constant value.
Behavior.return = function (value) {
    return new Behavior(function () {
        return value;
    });
};

// The `index` singleton behavior provides the time or "index" any time it is
// polled.
Behavior.index = new Behavior(function (index) {
    return index;
});

// The `get` method of a behavior produces
Behavior.prototype.get = function (index) {
    var handler = handlers.get(this);
    return handler.callback.call(handler.thisp, index);
};

// The `next` method of a behavior returns an iteration that captures both the
// value and index time, and gives a behavior the same shape as an iterable.
Behavior.prototype.next = function (index) {
    return new Iteration(this.get(index), false, index);
};

// The static `lift` method accepts an operator and its context object and
// produces the analogous operator on behaviors.
// The resulting operator accepts and returns behaviors instead of values.
// Each time the user polls the returned behavior they will get the result of
// applying the current value of each behavior argument to the operator.
//
// For example, `Beahavior.lift(add)` will produce a `behaviorAdd` operator.
// `behaviorAdd(Behavior.return(10), Behavior.return(20))` will produce a
// behavior that will always yield `30`.
Behavior.lift = function (operator, operators) {
    return function operatorBehavior() {
        var operands = Array.prototype.slice.call(arguments); /* TODO unroll */
        return new Behavior(function (index) {
            var values = operands.map(function (operand) {
                return operand.get(index);
            });
            if (values.every(Operators.defined)) {
                return operator.apply(operators, values);
            }
        });
    };
};

// The `tupleLift` static method is the same as `lift` accept that the returned
// behavior operator accepts an array of behaviors instead of variadic behavior
// arguments.
Behavior.tupleLift = function (operator, operators) {
    return function operatorBehavior(operands) {
        return new Behavior(function (index) {
            var values = operands.map(function (operand) {
                return operand.get(index);
            });
            if (values.every(Operators.defined)) {
                return operator.apply(operators, values);
            }
        });
    };
};

// Using `lift` and `tupleLift`, we generate both a method for both the
// behavior constructor and prototype for each of the operators defined in the
// `Operators` module.
for (var name in Operators) {
    (function (operator, name) {
        Behavior[name] = Behavior.lift(operator, Operators);
        var tupleLift = Behavior.tupleLift(operator, Operators);
        Behavior.prototype[name] = function () {
            var operands = [this];
            for (var index = 0; index < arguments.length; index++) {
                operands[index + 1] = arguments[index];
            }
            return tupleLift(operands);
        };
    })(Operators[name], name);
}

