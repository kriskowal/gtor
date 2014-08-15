
var WeakMap = require("weak-map");
var Promise = require("./promise");
var Iteration = require("./iteration");
var Stream = require("./stream");

var handlers = new WeakMap();

// ## ByteStream

module.exports = ByteStream;
function ByteStream(setup, length) {
    var buffer = this.constructor.buffer(length);
    handlers.set(this, handlers.get(buffer.out));
    ByteStream_bind(this);
    setup(buffer.in.yield, buffer.in.return, buffer.in.throw);
}

ByteStream.buffer = function (length) {
    var handler = new ByteHandler(length);
    var input = Object.create(ByteSource.prototype);
    ByteSource_bind(input);
    handlers.set(input, handler);
    var output = Object.create(ByteStream.prototype);
    ByteStream_bind(output);
    handlers.set(output, handler);
    return {in: input, out: output};
};

ByteStream_bind = function (stream) {
    stream.next = stream.next.bind(stream);
}

ByteStream.of = function (buffer, length) {
    return new this(function (_yield, _return, _throw) {
        _yield(buffer).then(function (iteration) {
            return _return(iteration.value);
        }, _throw).done();
    }, length);
};

ByteStream.prototype = Object.create(Stream.prototype);
ByteStream.prototype.constructor = ByteStream;

ByteStream.prototype.next = function () {
    var handler = handlers.get(this);
    return handler.next();
};

// ## ByteSource

function ByteSource() {
}

ByteSource_bind = function (source) {
    source.yield = source.yield.bind(source);
    source.return = source.return.bind(source);
    source.throw = source.throw.bind(source);
}

ByteSource.prototype.yield = function (chunk) {
    if (!(chunk instanceof Buffer)) {
        throw new Error("Can't write non-buffer to stream");
    }
    var handler = handlers.get(this);
    return handler.yield(new Window(chunk));
};

ByteSource.prototype.return = function (value) {
    var handler = handlers.get(this);
    return handler.return(value);
};

ByteSource.prototype.throw = function (error) {
    var handler = handlers.get(this);
    return handler.throw(error);
};

// ## ByteHandler

function ByteHandler(length) {
    length = length || 4096;
    this.buffer = new Buffer(length);
    this.buffer.fill(255); // XXX debug
    this.head = 0; // first index of stored bytes
    this.tail = 0; // last index of stored bytes
    /* if head < tail, contiguous
     * if tail < head, broken into two regions
     * [head, length) and [0, tail) */
    this.length = 0; // the quantity of stored bytes
    /* head === tail may mean empty or full */
    this.index = 0;
    this.read = 0; // [head, read) is being read
    this.write = 0; // [tail, write) is being written
    this.closed = false;
    this.returnValue = null;
    this.exhausted = Promise.defer();
    this.canRead = Promise.defer();
    this.canWrite = Promise.defer();
    this.canWrite.resolver.return();
}

ByteHandler.prototype.next = function () {
    if (this.read !== this.head) {
        // Releases the last window that was checked out for reading.
        this.length -= this.read - this.head;
        this.head = this.read % this.buffer.length;
        this.canWrite.resolver.return();
    }
    // Returns a promise for a chunk of bytes that can be read.
    return this.canRead.promise.then(function () {
        this.canRead = Promise.defer();
        var more;
        /* trying to check out the next contiguous RRRR region */
        if (!this.length) {
            /* WWWWW HT WWWW head === tail && !length, means empty*/
            this.exhausted.resolver.return();
            return new Iteration(this.returnValue, true);
        } else if (this.head < this.tail) {
            /* head !== length is implied by remainder operator above. */
            /* RRRRR HT RRRR head === tail && length, means full */
            /* WWW H RRRR T WWW */
            this.read = this.tail;
            more = false;
        } else {
            /* RRR T WWWW H RRR */
            this.read = this.length;
            more = this.tail !== 0;
        }
        if (more || this.closed) {
            // Causes canRead to open even though length is 0
            this.canRead.resolver.return();
        }
        var index = this.index;
        this.index += this.read - this.head;
        return new Iteration(this.buffer.slice(this.head, this.read), false, index);
    }, this);
};

ByteHandler.prototype.yield = function (source) {
    if (this.closed) {
        throw new Error("Can't write to closed stream");
    }
    // Writing, closing, and aborting all imply that the last slice from any of
    // these methods is now free space for reading.
    return this.canWrite.promise.then(function () {
        this.canWrite = Promise.defer();
        var length;
        var more;
        if (this.length === this.buffer.length) {
            throw new Error("Can't write until previous flush completes (wait for returned promise)");
        } else if (this.head <= this.tail) {
            /* WWW H RRRR T WWW */
            length = Math.min(source.length, this.buffer.length - this.tail);
            more = this.head !== 0;
        } else {
            /* RRR T WWWW H RRR */
            length = Math.min(source.length, this.head - this.tail);
            more = false;
        }
        if (length) {
            source.flush(this.buffer.slice(this.tail, this.tail + length));
            this.tail = (this.tail + length) % this.buffer.length;
            this.length += length;
            this.canRead.resolver.return();
        }
        if (more) {
            this.canWrite.resolver.return();
        }
        // If the flush did not exhaust the source, there was not enough room
        // in the target buffer window and we filled it to the brim.
        // We must wait for another opportunity to write.
        if (source.length) {
            return this.yield(source);
        } else {
            return new Iteration();
        }
    }, this);
};

ByteHandler.prototype.return = function (value) {
    if (this.closed) {
        throw new Error("Can't write to closed stream");
    }
    this.closed = true;
    this.returnValue = value;
    this.canRead.resolver.return();
    return this.exhausted.promise;
};

ByteHandler.prototype.throw = function (error) {
    if (this.closed) {
        throw new Error("Can't write to closed stream");
    }
    this.closed = true;
    this.canRead.resolver.throw(error);
    return Promise.return(Iteration.done);
};

// ## Window

function Window(buffer, tail, head) {
    this.buffer = buffer;
    this.tail = tail || 0;
    this.head = head || buffer.length;
    this.length = this.head - this.tail;
}

Window.prototype.flush = function (target) {
    var length = Math.min(this.length);
    this.buffer.copy(target, 0, this.tail);
    this.tail += target.length;
    this.length -= target.length;
};

Window.prototype.capture = function () {
    return this.buffer.slice(this.tail, this.head);
};

