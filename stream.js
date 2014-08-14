
// A stream represents either end of a buffer that transports values
// asynchronously in either direction.
// By convention, values are transported in one direction, and acknowledgements
// are returned.
//
// A stream is a promise iterator and a promise generator.
// All of the kernel methods, `yield` or `next`, `return`, and `throw`,
// both send and receive promises for iterations.
//
// Promise streams borrow the jargon of iterators and generators but each
// method is equivalent to a conventional stream method name.
//
// - `yield` is akin to `write`.
// - `next` is akin to `read`.
// - `yield` and `next` are interchangeable. The argument is written and the
//   return value is a promise for what will be read.
// - `return` is akin to `close`.
// - `throw` is akin to `abort`, `cancel`, or `destroy`.
//
// A stream is **unicast**, in the sense that it is a cooperation between a
// single producer and consumer, mediated by the buffer to control the
// throughput of both sides.
//
// Since a stream is unicast, it is also **cancelable**.
// Either side of a connection can terminate the other.

var Task = require("./task");
var Signal = require("./signal");
var Promise = require("./promise");
var PromiseQueue = require("./promise-queue");
var Iteration = require("./iteration");
var WeakMap = require("weak-map");

// Every stream has a private dual, the opposite end of the stream.
// For the input, there is the output; for the output, there is the input.
var duals = new WeakMap();
// Every stream has a private promise queue for transporting iterations.
// The stream uses its own queue to receive iterations from its dual, and uses
// the dual's queue to send iterations to its dual.
var queues = new WeakMap();

// ## Stream
//
// Like promises and tasks, streams use the [revealing constructor
// pattern][Revealing Constructor].
//
// [Revealing Constructor]: http://domenic.me/2014/02/13/the-revealing-constructor-pattern/
//
// However, unlike promises, streams are symmetric and support bidirectional
// communication.
// By convention, the stream constructor creates an output stream and reveals
// the methods of the input stream as arguments to a setup function.

module.exports = Stream;
function Stream(setup, length) {
    var buffer = Stream.buffer(length);
    setup(buffer.in.yield, buffer.in.return, buffer.in.throw);
    return buffer.out;
}

// The `buffer` constructor method of a stream creates a tangled pair of
// streams, dubbed `in` and `out`.
//
// The `buffer` method is analogous to `Promise.defer`.

Stream.buffer = function (length) {
    var outgoing = new PromiseQueue(); // syn
    var incoming = new PromiseQueue(); // ack
    var input = Object.create(Stream.prototype);
    var output = Object.create(Stream.prototype);
    duals.set(input, output);
    duals.set(output, input);
    queues.set(input, incoming);
    queues.set(output, outgoing);
    Stream_bind(input);
    Stream_bind(output);
    // If the user provides a buffer length, we prime the incoming message
    // queue with that many iterations.
    // This allows the producer to stay this far ahead of the consumer.
    while (length != null && length--) {
        incoming.put(new Iteration());
    }
    return {in: input, out: output};
};

// The `from` method creates a stream from an iterable or a promise iterable.
Stream.from = function (iterable) {
    return new this(function (_yield, _return) {
        Promise.return(iterable)
        .invoke("forEach", _yield)
        .then(_return)
        .done();
    });
};

// The kernel methods of a stream are bound to the stream so they can be passed
// as free variables.
// Particularly, the methods of an input stream are revealed to the setup
// function of an output stream's constructor.
function Stream_bind(stream) {
    stream.next = stream.next.bind(stream);
    stream.yield = stream.yield.bind(stream);
    stream.return = stream.return.bind(stream);
    stream.throw = stream.throw.bind(stream);
}

Stream.prototype.Iteration = Iteration;

// ### Kernel Methods

// The `next` and `yield` methods are equivalent.
// By convention, `next` is used to consume, and `yield` to produce,
// but both methods have the same signature and behavior.
// They return a promise for the next iteration from the other side of the
// connection, and send an iteration with the given value to the other.

Stream.prototype.next = function (value, index) {
    return this.yield(value, index);
};

Stream.prototype.yield = function (value, index) {
    var dual = duals.get(this);
    var incoming = queues.get(this);
    var outgoing = queues.get(dual);
    outgoing.put(new this.Iteration(value, false, index));
    return incoming.get();
};

// The `return` method sends a final iteration to the other side of a stream,
// which by convention terminates communication in this direction normally.

Stream.prototype.return = function (value) {
    var dual = duals.get(this);
    var incoming = queues.get(this);
    var outgoing = queues.get(dual);
    outgoing.put(new this.Iteration(value, true));
    return incoming.get();
};

// The `throw` method sends an error to the other side of the stream,
// in an attempt to break communication in this direction, and, unless the
// other side handles the exception, the error should bounce back.

Stream.prototype.throw = function (error) {
    var dual = duals.get(this);
    var incoming = queues.get(this);
    var outgoing = queues.get(dual);
    outgoing.put(Promise.throw(error));
    return incoming.get();
};

// ### do
//
// The `do` method is a utility for `forEach` and `map`, responsible for
// setting up an appropriate semaphore for the concurrency limit.

Stream.prototype.do = function (callback, errback, limit) {
    var next;
    // If there is no concurrency limit, we are free to batch up as many jobs
    // as the producer can create.
    if (limit == null) {
        next = function () {
            return this.next()
            .then(function (iteration) {
                // Before even beginning the job, we start waiting for another
                // value.
                next.call(this);
                return callback(iteration);
            }, null, this)
        };
    } else {
        // If there is a concurrency limit, we will use a promise queue as a
        // semaphore.  We will enqueue a value representing a resource
        // (undefined) for each concurrent task.
        var semaphore = new PromiseQueue();
        while (limit--) {
            semaphore.put();
        }
        next = function () {
            // Whenever a resource is available from the queue, we will start
            // another job.
            return semaphore.get()
            .then(function (resource) {
                // Each job begins with waiting for a value from the iterator.
                return this.next()
                .then(function (iteration) {
                    // Once we have begun a job, we can begin waiting for
                    // another job.
                    // A resource may already be available on the queue.
                    next.call(this);
                    // We pass the iteration forward to the callback, as
                    // defined by either `forEach` or `map`, to handle the
                    // iteration appropriately.
                    return Promise.try(callback, null, iteration)
                    .finally(function () {
                        // And when the job is complete, we will put a resource
                        // back on the semaphore queue, allowing another job to
                        // start.
                        semaphore.put(resource);
                    })
                }, null, this);
            }, null, this)
            .done(null, errback);
        }
    }
    next.call(this);
};

// ### forEach
//
// The `forEach` method will execute jobs, typically in serial, and returns a
// cancelable promise (`Task`) for the completion of all jobs.
// The default concurrency limit is 1, making `forEach` as serial as it is for
// arrays, but can be expanded by passing a number in the third argument
// position.

Stream.prototype.forEach = function (callback, thisp, limit) {
    // We create a task for the result.
    var result = new Task(function (error) {
        // If the task is canceled, we will propagate the error back to the
        // generator.
        this.throw(error);
    }, this);
    // The default concurrency for `forEach` limit is 1, making it execute
    // serially.
    // For other operators, `map` and `filter`, there is no inherent
    // parallelism limit.
    if (limit == null) { limit = 1; }
    // We will use signals to track the number of outstanding jobs and whether
    // we have seen the last iteration.
    var count = new Signal(0);
    var done = new Signal(false);
    // We will capture the return value in scope.
    var returnValue;
    // Using the do utility function to limit concurrency and give us
    // iterations, or prematurely terminate, in which case we forward the error
    // to the result task.
    this.do(function (iteration) {
        // If this was the last iteration, capture the return value and
        // dispatch the done signal.
        if (iteration.done) {
            returnValue = iteration.value;
            done.in.yield(true);
        } else {
            // Otherwise, we start a new job.
            // Incrementing the number of outstanding jobs.
            count.in.inc();
            // Kick off the job, passing the callback argument pattern familiar
            // to users of arrays, but allowing the task to return a promise to
            // push back on the producer.
            return Promise.try(callback, thisp, iteration.value, iteration.index)
            .finally(function () {
                // And then decrementing the outstanding job counter,
                // regardless of whether the job succeeded.
                count.in.dec();
            })
        }
    }, result.in.throw, limit);
    // We have not completed the task until all outstanding jobs have completed
    // and no more iterations are available.
    count.out.equals(Signal.return(0)).and(done.out).forEach(function (done) {
        if (done) {
            result.in.return(returnValue);
        }
    });
    return result.out;
};

// ### map
//
// The `map` method runs jobs in parallel, taking values from this iterator and
// sending them to the returned promise iterator.
// There is no default limit to concurrency, but you can pass a number.
// Also, the order in which values pass from the input to the output is
// determined by how quickly the jobs are processed.
// However, the index of the input iterations propagates to the output
// iterations.
// A concurrency limit of 1 will ensure that order is preserved.

Stream.prototype.map = function (callback, thisp, limit) {
    // We use our own constructor so subtypes can alter behavior.
    var result = new this.constructor.buffer();
    // As with `forEach`, we track the number of outstanding jobs and whether
    // we have seen the last iteration.
    var count = new Signal(0);
    var done = new Signal(false);
    // And we will capture the return value here to pass it along to the result
    // stream.
    var returnValue;
    this.do(function (iteration) {
        // If this is the last iteration, track the return value and dispatch
        // the done signal.
        if (iteration.done) {
            returnValue = iteration.value;
            done.in.yield(true);
        } else {
            // Otherwise, start another job, first incrementing the outstanding
            // job counter so the result stream can't terminate until we are
            // done.
            count.in.inc();
            // Then pass the familiar argument pattern for map callbacks,
            // except allowing the job to return a promise for the result.
            return Promise.try(callback, thisp, iteration.value, iteration.index)
            .then(function (value) {
                // We forward the result to the output iterator, preserving its
                // index if not its order.
                return result.in.yield(value, iteration.index);
            })
            .finally(function () {
                // Regardless of whether the job succeeds or fails, we drop the
                // outstanding job count so the stream has an opportunity to
                // terminate if no more iterations are available.
                count.in.dec();
            });
        }
    }, result.in.throw, limit);
    // If no more iterations are available and all jobs are done, we can close
    // the output stream with the same return value as the input stream.
    count.out.equals(Signal.return(0)).and(done.out).forEach(function (done) {
        if (done) {
            result.in.return(returnValue);
        }
    });
    return result.out;
};

// ### filter
//
// The filter method runs concurrent tests to determine whether to include an
// iteration from the input stream on the output stream.
// The regularity of the duration of the test will determine whether iterations
// are likely to be processed in order, but a concurrency limit of 1 guarantees
// that the input and output order will be the same.

Stream.prototype.filter = function (callback, thisp, limit) {
    var result = new this.constructor.buffer();
    // As with map and forEach, we use signals to track the termination
    // condition.
    var count = new Signal(0);
    var done = new Signal(false);
    var returnValue;
    this.do(function (iteration) {
        // If this is the last iteration, we track the return value to later
        // forward to the output stream and note that no more iterations are
        // available, pending any outstanding jobs.
        if (iteration.done) {
            returnValue = iteration.value;
            done.in.yield(true);
        } else {
            // Otherwise we start another job, incrementing the outstanding job
            // counter and using the usual filter argument pattern.
            count.in.inc();
            return Promise.try(callback, thisp, iteration.value, iteration.index)
            .then(function (value) {
                // Only if the test passes do we forward the value, and its
                // original index, to the output stream.
                if (value) {
                    return result.in.yield(iteration.value, iteration.index);
                }
            })
            .finally(function () {
                // Regardless of whether the test ran without error, we note
                // that the job is done.
                count.in.dec();
            });
        }
    }, result.in.throw, limit);
    /* when (count == 0 && done) */
    count.out.equals(Signal.return(0)).and(done.out).forEach(function (done) {
        // When there are no more outstanding jobs and the input has been
        // exhausted, we forward the input return value to the output stream.
        if (done) {
            result.in.return(returnValue);
        }
    });
    return result.out;
};

// ### reduce
//
// The `reduce` method runs concurrent jobs to acrete values from the input
// stream until only one value remains, returning a cancelable promise (task)
// for that last value.
//
// Yet to be ported.

/* TODO reduce, some, every */

// ### fork
//
// The fork method creates an array of streams that will all see every value
// from this stream.
// All of the returned streams put back pressure on this stream.
// This stream can only advance when all of the output streams have advanced.

Stream.prototype.fork = function (length) {
    length = length || 2;
    var buffers = new Array(length).map(function () {
        return this.constructor.buffer();
    }, this);
    var inputs = buffers.map(function (buffer) {
        return buffer.in;
    });
    var outputs = buffers.map(function (buffer) {
        return buffer.out;
    });
    this.forEach(function (value, index) {
        return Promise.all(inputs.map(function (input) {
            return input.yield(value, index);
        }));
    }).then(function (value) {
        return Promise.all(inputs.map(function (input) {
            return input.return(value);
        }));
    }, function (error) {
        return Promise.all(inputs.map(function (input) {
            return input.throw(value);
        }));
    }).done();
    return outputs;
};

