// The operators module provides named function objects corresponding to
// language operators.

"use strict";

// The equals and compare operators provided by the Collections package allow
// deep comparison of arbitrary values and delegate to the eponymous methods of
// instances if they are defined.

require("collections/shim-object");

exports.equals = Object.equals;

exports.compare = Object.compare;

exports.not = function (x) { return !x };

exports.and = function (x, y) { return x && y };

exports.or = function (x, y) { return x || y };

exports.add = function (x, y) {
    return x + y;
};

exports.sub = function (x, y) {
    return x - y;
};

exports.div = function (x, y) {
    return x / y;
};

exports.mul = function (x, y) {
    return x * y;
};

exports.tuple = function () {
    return Array.prototype.slice.call(arguments);
};

// Behaviors and signals will propagate undefined if any operand is not
// defined.

exports.defined = function (value) {
    // !NaN && !null && !undefined
    return value === value && value != null;
};

