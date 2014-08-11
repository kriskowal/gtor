
// A promise buffer is an asynchronous stream of objects.
//
// A promise buffer is **unicast**, in the sense that it is a cooperation
// between a single producer and a single consumer, mediated by the buffer to
// control the throughput of both sides.
//
// Since a promise buffer is unicast, it is also **cancelable**.
// The iterator side of the promise buffer has the ability to prematurely
// terminate the generator by throwing an exception back.

"use strict";

var Iteration = require("./iteration");
var Promise = require("./promise");
var PromiseQueue = require("./promise-queue");
var Signal = require("./signal");
var Task = require("./task");
var WeakMap = require("weak-map");

// Promise buffers use an internal handler object, shared by its internal
// iterator and generator, that tracks shared private state.
var handlers = new WeakMap();

// ## PromiseBuffer

// The first argument of a promise buffer may either be a number or an iterable
// which is used to "prime" the buffer up to a certain size or with certain
// content.
// These values, or this quantity of undefined values, initializes the queue of
// promises that will be returned by the generator, allowing the generator to
// get ahead of the consumer, filling the buffer up to this size before
// pressure from the consumer pushes back.

module.exports = PromiseBuffer;
function PromiseBuffer(values) {
    if (!(this instanceof PromiseBuffer)) {
        return new PromiseBuffer();
    }
    var handler = new this.Handler(values);
    // A promise buffer has an input side and an output side.
    // The output is analogous to an iterator, but instead of producing
    // iterations, it produces promises for iterations.
    this.out = new this.Iterator(handler, this);
    // The input is analogous to a generator, but `yield`, `return`, and
    // `throw` all return promises for returning iterations, indicating when
    // and whether the producer should proceed, and perhaps carrying
    // information back to the producer.
    this.in = new this.Generator(handler, this);
}

// The Handler, Iterator, and Generator constructors can be overridden but note
// that only the proper Iterator, Generator, and Handler constructors have
// access to the internal handler map.
// Overridden constructors are responsible for calling their super constructor.
PromiseBuffer.prototype.Handler = PromiseBufferHandler;
PromiseBuffer.prototype.Iterator = PromiseIterator;
PromiseBuffer.prototype.Generator = PromiseGenerator;

function PromiseBufferHandler(values) {
    // The buffer has two internal promise queues that ferry iterations.
    // The input queue ferries data iterations from the producer to the
    // consumer.
    this.in = new PromiseQueue();
    // The output queue ferries acknowledgement or flush iterations from the
    // consumer to the producer.
    this.out = new PromiseQueue();
    // If the constructor provided a buffer size, we prime the output queue
    // with that quantity of undefined iterations.
    if (typeof values === "number") {
        while (values--) {
            this.prime();
        }
    // If the constructor provides any other value, we assume that it is
    // iterable and implements forEach, which we use to populate the
    // acknowledgement queue, with both the value and the index of each input
    // value.
    } else if (values) {
        values.forEach(this.prime, this);
    }
}

// The prime method, used above by the handler constructor to initialize the
// acknowledgement queue, allowing the producer to get ahead of the consumer by
// an iteration.
PromiseBufferHandler.prototype.prime = function (value, index) {
    this.out.put(new this.Iteration(value, false, index));
};

// The get method is used by the iterator side to put an iteration on the
// acnowledgement queue and take a promise for an iteration off the data queue.
PromiseBufferHandler.prototype.get = function (iteration) {
    this.in.put(iteration);
    return this.out.get();
};

// The put method is used by the generator side to put an iteration on the data
// queue and take a promise off the acknowledgement queue.
PromiseBufferHandler.prototype.put = function (iteration) {
    this.out.put(iteration);
    return this.in.get();
};

PromiseBufferHandler.prototype.Iteration = Iteration;


// ## PromiseGenerator

// A promise generator implements the same interface as a synchronous generator
// except that each of its methods, `yield`, `return`, and `throw`, return
// promises that the generator should wait for before proceeding, indcating
// when and whether the consumer is ready for more data.
// These promises may eventually throw, indicating that the generator should
// stop prematurely.

function PromiseGenerator(handler, parent) {
    handlers.set(this, handler);
    this.parent = parent;
    this.yield = this.yield.bind(this);
    this.return = this.return.bind(this);
    this.throw = this.throw.bind(this);
}

PromiseGenerator.prototype.Promise = Promise;

// Sends a data iteration to the iterator, with a given value and optional
// index.
// Returns a promise for when and whether to proceed.
PromiseGenerator.prototype.yield = function (value, index) {
    var handler = handlers.get(this);
    return handler.put(new handler.Iteration(value, false, index));
};

// Informs the iterator that the stream has gracefully concluded, optionally
// with a return value.
// Returns a promise for when and whether to proceed.
PromiseGenerator.prototype.return = function (value) {
    var handler = handlers.get(this);
    return handler.put(new handler.Iteration(value, true));
};

// Sends an eventual error instead of an iteration to the consumer, indicating
// that the generator terminated without grace.
// Returns a promise for when and whether to proceed.
PromiseGenerator.prototype.throw = function (error) {
    var handler = handlers.get(this);
    return handler.put(this.Promise.throw(error || new Error("Producer canceled stream")));
};


// ## PromiseIterator

// A promise iterator implements the same interface as a synchronous iterator
// except that instead of returning iterations, it returns promises for
// iterations.
function PromiseIterator(handler, parent) {
    handlers.set(this, handler);
    this.parent = parent;
}

// Requests a promise for the next iteration from the generator side, and sends
// an acknowledgement iteration back to the generator so that it may produce
// another iteration.
// The acknowledgement may carry a value and optionally the index of that
// value.
PromiseIterator.prototype.next = function (value, index) {
    var handler = handlers.get(this);
    return handler.get(new handler.Iteration(value, false, index));
}

// Sends an eventual error back to the generator requesting premature
// termination, possibly canceling or aborting the generator.
// Returns a promise for the next iteration if the generator recovers from the
// thrown error.
// Otherwise, the generator should propagate the error back to the iterator.
PromiseIterator.prototype.throw = function (error) {
    var handler = handlers.get(this);
    return handler.put(Promise.throw(error || new Error("Consumer canceled stream")));
};

// ---

// All methods hereafter are defined in terms of the primitive `next`.

// ### copy or pipe

// The `copy` method pipes data from this iterator into the given generator and
// returns a cancelable task for the completion of the copy.
// Optionally, `copy` may forward this stream’s return value to the generator
// upon completion.
/* TODO consider naming this pipe or pipeTo */
PromiseIterator.prototype.copy = function (generator, options) {
    var done = this.forEach(generator.yield, generator);
    /* TODO consider naming the option `return` */
    if (!options || options.close !== false) {
        done = done.then(function (value) {
            return generator.return(value);
        });
    }
    return done;
};

// The pipe as in `pipeThrough` idea is a bit of a bust because using .map does
// the same job as passing an equivalent PromiseMachine with buffered input and
// output but doesn't have the dangling promise and silent errors.
/*
PromiseIterator.prototype.pipe = function (pipe, options) {
    this.copy(pipe.in, options); // a cancelable promise dangles here
    return pipe.out;
};
*/

// ### do
//
// The `do` method is a utility for `forEach` and `map`, responsible for
// setting up an appropriate semaphore for the concurrency limit.

PromiseIterator.prototype.do = function (callback, errback, limit) {
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

PromiseIterator.prototype.forEach = function (callback, thisp, limit) {
    // We create a task for the result.
    var result = Task.defer(function (error) {
        // If the task is canceled, we will propagate the error back to the
        // generator.
        this.throw(error);
    }, this);
    // The default concurrency limit is 1.
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

PromiseIterator.prototype.map = function (callback, thisp, limit) {
    // We use our own PromiseBuffer constructor so subtypes can alter behavior.
    var result = new this.parent.constructor();
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

PromiseIterator.prototype.filter = function (callback, thisp, limit) {
    var result = new this.parent.constructor(); // PromiseBuffer, polymorphic
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
    // when (count == 0 && done)
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

