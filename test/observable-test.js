
"use strict";

var Observable = require("../observable");

it("can observe after emit", function (done) {
    var s = Observable.signal();
    s.in.yield(10);
    s.out.forEach(function (x) {
        expect(x).toBe(10);
        done();
    });
});

it("can observe before emit", function (done) {
    var s = Observable.signal();
    s.out.forEach(function (x) {
        expect(x).toBe(10);
        done();
    });
    s.in.yield(10);
});

it("can be cancelled", function () {
    var setUp = false;
    var observer = new Observable(function (_yield) {
        setUp = true;
        _yield(10);
    }).forEach(function () {
        expect(true).toBe(false);
    });
    expect(setUp).toBe(true);
    observer.cancel();
});

it("can get a value with revealing constructor", function (done) {
    new Observable(function (_yield) {
        _yield(10);
    }).forEach(function (x) {
        expect(x).toBe(10);
        done();
    });
});

it("can count", function (done) {
    var signal = Observable.signal();
    var i = 0;
    signal.in.yield(0);
    signal.out.forEach(function (n) {
        if (n < 3) {
            expect(n).toBe(i++);
            signal.in.yield(i);
        } else {
            done();
        }
    });
});

