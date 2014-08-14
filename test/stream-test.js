
"use strict";

var Stream = require("../stream");
var Promise = require("../promise");

describe("revealing constructor", function () {
    it("works", function () {
        var at = 0;
        return new Stream(function (_yield, _return) {
            _yield(10).then(function () {
                return _yield(20);
            }).then(function () {
                return _return(30);
            })
            .done();
        }).forEach(function (value) {
            at++;
            expect(value).toBe(at * 10);
        }).then(function (value) {
            at++;
            expect(value).toBe(at * 10);
        });
    });
})

it("single iteration produced then consumed", function () {
    var buffer = Stream.buffer();
    var produced = buffer.in.yield(10)
    .then(function (iteration) {
        expect(iteration.value).toBe(undefined);
        expect(iteration.done).toBe(false);
        expect(consumed.isFulfilled()).toBe(false);
    });
    var consumed = buffer.out.next()
    .then(function (iteration) {
        expect(iteration.value).toBe(10);
        expect(iteration.done).toBe(false);
        expect(produced.isFulfilled()).toBe(true);
    });
    return Promise.all([produced, consumed]).thenReturn();
});

it("synchronize and acknowledge cycle", function () {
    var buffer = Stream.buffer();
    var index = 0;
    var produced = buffer.in.yield(10)
    .then(function (iteration) {
        expect(iteration.value).toBe("A");
        expect(iteration.done).toBe(false);
        expect(index++).toBe(0);
        return buffer.in.return(20);
    }).then(function (iteration) {
        expect(iteration.value).toBe("B");
        expect(iteration.done).toBe(false);
        expect(index++).toBe(2);
    });
    var consumed = buffer.out.next("A")
    .then(function (iteration) {
        expect(iteration.value).toBe(10);
        expect(iteration.done).toBe(false);
        expect(index++).toBe(1);
        return buffer.out.next("B");
    }).then(function (iteration) {
        expect(iteration.value).toBe(20);
        expect(iteration.done).toBe(true);
        expect(index++).toBe(3);
    });
    return Promise.all([produced, consumed]).thenReturn();
});

describe("forEach", function () {

    it("works", function () {
        var stream = Stream.from([0, 1, 2]);
        var index = 0;
        return stream.forEach(function (value) {
            expect(value).toBe(index++);
        }).then(function (value) {
            expect(value).toBe(undefined);
        });
    });

});

describe("map", function () {

    it("works", function () {
        var index = 0;
        return Stream.from([1, 2, 3])
        .map(function (n, i) {
            expect(i).toBe(n - 1);
            return n + 1;
        }).forEach(function (n, i) {
            expect(i).toBe(index++);
            expect(n).toBe(i + 2)
        }).then(function (value) {
            expect(index).toBe(3);
            expect(value).toBe(undefined);
        });
    });

    it("executes two jobs in parallel", function () {
        var index = 0;
        var limit = 2;
        var delay = 100;
        var tolerance = 40;
        var start;
        return Stream.from([0, 1, 2, 3, 4, 5]).map(function (n) {
            return Promise.return(n).delay(delay);
        }, null, limit).forEach(function (n, i) {
            if (i === 0) {
                start = Date.now();
            } else {
                expect(Date.now() - start).toBeNear(delay * Math.floor(index / limit), tolerance);
            }
            expect(i).toBe(index);
            expect(n).toBe(index);
            index++;
        }).then(function (value) {
            expect(index).toBe(6);
            expect(value).toBe(undefined);
        })
        .timeout(1000);
    });

    it("weird feedback loop", function () {
        var buffer = Stream.buffer();
        buffer.in.yield(0); // kick this off
        var index = 0;
        return buffer.out.forEach(function (value) {
            expect(value).toBe(index++);
            if (value < 10) {
                return buffer.in.yield(value + 1);
            } else {
                return buffer.in.return("fin");
            }
        }, null, 2)
        .then(function (fin) {
            expect(fin).toBe("fin");
        });
    });

});

