"use strict";

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

