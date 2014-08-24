"use strict";

// ## Iteration
//
// Various methods of both synchronous and asynchronous iterators and
// generators transport iterations, which represent either a yielded value of
// an ongoing sequence or the return value of a sequence that has terminated.
// While object literals are sufficient to capture iterations, the iteration
// constructor is handy for readability and allows V8 at least to use a hidden
// class for all instances.

module.exports = Iteration;
function Iteration(value, done, index) {
    this.value = value;
    this.done = done;
    this.index = index;
}

// The Collections library operators, and therefore the Jasminum expectation
// operators, defer to the `equals` method of any object that implements it.
Iteration.prototype.equals = function (that, equals, memo) {
    if (!that) return false;
    return (
        equals(this.value, that.value, equals, memo) &&
        this.index === that.index &&
        this.done === that.done
    );

};

// The `done` iteration singleton suffices for many cases where a terminal
// iteration does not need to carry a return value.
// This singleton exists only to avoid unnecessarily allocating a new iteration
// for each of these cases.
Iteration.done = new Iteration(undefined, true, undefined);

