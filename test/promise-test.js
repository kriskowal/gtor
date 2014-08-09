"use strict";

var Promise = require("../promise");

describe("then", function () {

    it("lifts a value", function () {
        return Promise.return(10)
        .then(function (ten) {
            expect(ten).toBe(10);
        })
    });

    describe("defer", function () {
        it("makes a promise resolver pair", function () {
            var d = Promise.defer();
            d.resolver.return(10);
            return d.promise.then(function (v) {
                expect(v).toBe(10);
            });
        });
    });

    it("forwards this", function () {
        var delegate = {beep: 10, boop: function () {
            expect(this.beep).toBe(10);
        }};
        return Promise.return().then(delegate.boop, delegate);
    });

});

