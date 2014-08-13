
var Behavior = require("../behavior");

it("", function () {
    expect(Behavior.return(10).get()).toBe(10);
});

it("", function () {
    expect(new Behavior(function () {
        return 10;
    }).get()).toBe(10);
});

it("", function () {
    expect(Behavior.return(20).add(Behavior.return(10)).get()).toBe(30);
});

it("", function () {
    expect(Behavior.index.add(Behavior.return(20)).get(10)).toBe(30);
});

