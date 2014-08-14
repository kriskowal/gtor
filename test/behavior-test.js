
var Behavior = require("../behavior");

it("", function () {
    expect(Behavior.yield(10).next().value).toBe(10);
});

it("", function () {
    expect(new Behavior(function () {
        return 10;
    }).next().value).toBe(10);
});

it("", function () {
    expect(Behavior.yield(20).add(Behavior.yield(10)).next().value).toBe(30);
});

describe("index behavior", function () {
    it("produces the given index", function () {
        expect(Behavior.index.add(Behavior.yield(20)).next(10).value).toBe(30);
    });
});

