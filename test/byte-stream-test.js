
var ByteStream = require("../byte-stream");

describe("of", function () {
    it("pumps large byte array into small stream buffer", function () {
        var string = "Hello, World! Good bye!"
        var stream = ByteStream.of(new Buffer(string, "utf-8"), 3);
        return stream.forEach(function (chunk, index) {
            expect(chunk.toString()).toBe(string.slice(index, index + 3));
        })
        .then(function (value) {
            expect(value).toBe(undefined);
        });
    });
});

it("can write then read", function () {
    var buffer = ByteStream.buffer(10);
    var flushed = buffer.in.yield(new Buffer("a"));
    flushed.done();
    return buffer.out.next()
    .then(function (iteration) {
        expect(iteration.value.toString()).toBe("a");
    });
});

it("can read then write", function () {
    var buffer = ByteStream.buffer(10);
    var done = buffer.out.next()
    .then(function (iteration) {
        expect(iteration.value.toString()).toBe("a");
    });
    buffer.in.yield(new Buffer("a")).done();
    return done;
});

it("small writes to a buffer should accumulate", function () {
    var buffer = ByteStream.buffer(2);
    buffer.in.yield(new Buffer("a")).done();
    buffer.in.yield(new Buffer("b")).done();
    return buffer.out.next()
    .then(function (iteration) {
        expect(iteration.value.toString()).toBe("ab");
    });
});

it("successive writes to small buffer must wait for successive reads", function () {
    var buffer = ByteStream.buffer(1);
    buffer.in.yield(new Buffer("a"))
    .then(function () {
        return buffer.in.yield(new Buffer("b"));
    })
    .done();
    return buffer.out.next()
    .then(function (iteration) {
        expect(iteration.value.toString()).toBe("a");
        return buffer.out.next();
    })
    .then(function (iteration) {
        expect(iteration.value.toString()).toBe("b");
    });
});

