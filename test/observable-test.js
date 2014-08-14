
"use strict";

var Observable = require("../observable");

it("can get a value", function (done) {
    var s = Observable.signal();
    s.in.yield(10);
    s.out.forEach(function (x) {
        expect(x).toBe(10);
        done();
    });
});

it("can get a value with revealing constructor", function (done) {
    new Observable(function (_yield) {
        _yield(10);
    }).forEach(function (x) {
        expect(x).toBe(10);
        done();
    });
});

