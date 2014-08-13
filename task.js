"use strict";

// A Task is analogous to a Deferred, and a TaskObservable is a cancelable
// promise.
// Like a promise, the observable is a proxy for the result of some work.
// The interface is largely the same, but a observable can only have one
// observer.
// For example, calling `then` a second time will throw an error.
// Instead, if a task has multiple observers, you can sacrifice cancelability
// by coercing it to a promise, or use `fork` before observing it.
// If every fork is cancelled, the cancelation will propagate back to the
// original job.
//
// The price of cancelability is a less robust system and more book keeping.
// A system that makes a great deal of use of tasks allows information to flow
// from any observable to any related task, even if distantly related.
// The cancelation of one task can propagate throughout an entire system of
// tasks, both forward and backward between consumers and producers.
// In exchange the system gains the ability to either free or avoid consuming
// resources proactively.

var asap = require("asap");
var WeakMap = require("weak-map");

// The resolver and observable side of a task share a hidden internal record
// with their shared state.
// Handlers are an alternative to using closures.
var handlers = new WeakMap();

// ## Task
//
// The task constructor creates a resolver "in" and an observer "out" pair
// with some shared internal state.
// Particularly, since tasks can be canceled, the task constructor accepts a
// reference to the cancellation method and optionally the instance that hosts
// it.

module.exports = Task;
function Task(cancel, thisp) { // TODO estimate, label
    var handler = new TaskHandler(); // TODO polymorph constructors
    this.in = new TaskResolver(handler);
    this.out = new TaskObservable(handler);
    handler.cancel = cancel;
    handler.cancelThisp = thisp;
}

// The `isTask` utility method allows us to identify a task that was
// constructed by this library.
// This library does not attempt to make it provably impossible to trick the
// Task.
Task.isTask = isTask;
function isTask(object) {
    return (
        Object(object) === object &&
        !!handlers.get(object) &&
        object instanceof TaskObservable
    );
};

// The `isThenable` method is used internally to identify other singular
// asynchronous duck types, including promises, which can be coerced into
// tasks.
function isThenable(object) {
    return Object(object) === object && typeof object.then === "function";
}

// The `return` function lifts a value into a task that has already completed
// with a value.
Task.return = function (value) {
    if (isTask(value)) {
        return value;
    } else if (isThenable(value)) {
        /* TODO implement thenable coercion */
        throw new Error("Thenables not yet implemented");
    } else {
        var handler = new TaskHandler();
        handler.state = "fulfilled";
        handler.value = value;
        return new TaskObservable(handler);
    }
};

// The `throw` function lifts an error into a task that has already failed with
// that error.
Task.throw = function (error) {
    var handler = new TaskHandler();
    handler.state = "rejected";
    handler.error = error;
    return new TaskObservable(handler);
};

// The `all` function accepts an array of tasks, or values that can be coerced
// into tasks, and produces a task that when completed will produce an array of
// the individual completion values.
Task.all = function Task_all(tasks) {
    // If the task is cancelled, or if any individual task fails, all of the
    // outstanding individual tasks will be cancelled.
    function cancelAll(error) {
        for (var otherIndex = 0; otherIndex < tasks.length; otherIndex++) {
            // Note that throwing an error upstream consitutes talking back to the producer.
            // This is a reminder that tasks are a cooperation between a single
            // consumer and a single producer and that information flows both
            // ways and in fact allows information to propagate laterally by
            // passing up one stream and down another.
            tasks[otherIndex].throw(error);
        }
        result.in.throw(error);
    }
    // The number of outstanding tasks, tracked to determine when all tasks are
    // completed.
    var remaining = tasks.length;
    var result = new Task(cancelAll);
    var results = Array(tasks.length);
    /* TODO estimated time to completion, label signals */
    var estimates = [];
    var estimate = -Infinity;
    var setEstimate;
    var estimates = tasks.map(function Task_all_each(task, index) {
        task = tasks[index] = Task.return(task); // Coerce values to tasks
        task.done(function Task_all_anyReturn(value) {
            results[index] = value;
            if (--remaining === 0) {
                result.in.return(results);
            }
        }, cancelAll);
    });
    return result.out;
};

// The `any` method accepts an array of tasks, or value coercable to tasks, and
// returns a task that will receive the value from the first task that
// completes with a value.
// After one succeeds, all remaining tasks will be cancelled.
// If one of the tasks fails, it will be ignored.
// If all tasks fail, this task will fail with the last error.
Task.any = function (tasks) {
    /* TODO */
};

// The `any` method accepts an array of tasks, or value coercable to tasks, and
// returns a task that will receive the value or error of the first task that
// either completes or fails.
// Afterward, all remaining tasks will be cancelled.
Task.race = function (tasks) {
    /* TODO */
};

// The `delay` method accepts a duration of time in miliseconds and returns a
// task that will complete with the given value after that amount of time has
// elapsed.
Task.delay = function (ms, value) {
    return Task.return(value).delay(ms);
};

// ## TaskHandler
//
// A task handler stores the common private state between a task resolver and a
// task observable.

function TaskHandler() {
    // When a task is resolved, it "becomes" a different task and its
    // observable, if any, must be forwarded to the new task handler.
    // In the `become` method, we also adjust the "handlers" table so any
    // subsequent request for this handler jumps to the end of the "became"
    // chain.
    this.became = null;
    // Tasks may be created with a corresponding canceler.
    this.cancel = null;
    this.cancelThisp = null;
    // Tasks may be "pending", "fulfilled" with a value, or "rejected" with an
    // error
    this.state = "pending";
    this.value = null;
    this.error = null;
    // A task may only be observed once.
    // Any future attempt to observe a task will throw an error.
    this.observed = false;
    // Since a task can only be observed once, we only need to track one
    // handler for fulfillment with a value or rejection with an error.
    // A promise keeps an array of handlers to forward messages to.
    // These handlers can be forgotten once a task settles since thereafter
    // the observer would be informed immediately.
    this.onreturn = null;
    this.onthrow = null;
    // The object to use as `this` in the context of `onreturn` and `onthrow`.
    this.thisp = null;
}

// Since a task handler can become another task handler, this utility method
// will look up the end of the chain of "became" properties and rewrite the
// handler look up table so we never have to walk the same length of chain
// again.
function Task_getHandler(task) {
    var handler = handlers.get(task);
    while (handler && handler.became) {
        handler = handler.became;
    }
    handlers.set(task, handler);
    return handler;
}

// The `done` method is kernel for subscribing to a task observer.
// If the task has already completed or failed, this will also arrange for the
// observer to be notified as soon as possible.
TaskHandler.prototype.done = function (onreturn, onthrow, thisp) {
    if (this.observed) {
        throw new Error("Can't observe a task multiple times. Use fork");
    }
    this.observed = true;
    this.onreturn = onreturn;
    this.onthrow = onthrow;
    this.thisp = thisp;
    // If we are observing a task after it completed or failed, we dispatch the
    // result immediately.
    if (this.state !== "pending") {
        // Instead of passing a callable closure, we pass ourself to avoid
        // allocating another object.
        // The task handler serves as a psuedo-function by implementing "call".
        asap(this);
    }
    // We handle the case of observing *before* completion or failure in the
    // `become` method.
};

// Above, we pass the task handler to `asap`.
// The event dispatcher treats functions and callable objects alike.
// This method will get called if this task has settled into a "fulfilled" or
// "rejected" state so we can call the appropriate handler.
TaskHandler.prototype.call = function () {
    if (this.state === "fulfilled") {
        if (this.onreturn) {
            this.onreturn.call(this.thisp, this.value);
        }
    } else if (this.state === "rejected") {
        if (this.onthrow) {
            this.onthrow.call(this.thisp, this.error);
        } else {
            throw this.error;
        }
    }
    // We release the handlers so they can be potentially garbage collected.
    this.onreturn = null;
    this.onthrow = null;
    this.thisp = null;
};

// The `become` method is the kernel of the task resolver.
TaskHandler.prototype.become = function (task) {
    var handler = Task_getHandler(task);
    // A task can only be resolved once.
    // Subsequent resolutions are ignored.
    // Ignoring, rather than throwing an error, greatly simplifies a great
    // number of cases, like racing tasks and cancelling tasks, where handling
    // an error would be unnecessary and inconvenient.
    if (this.state !== "pending") {
        return;
    }
    // The `became` property gets used by the internal handler getter to
    // rewrite the handler table and shorten chains.
    this.became = handler;
    // Once a task completes or fails, we no longer need to retain the
    // canceler.
    this.cancel = null;
    this.cancelThisp = null;
    // If an observer subscribed before it completed or failed, we forward the
    // resolution.
    // If an observer subscribes later, we take care of that case in `done`.
    if (this.observed) {
        handler.done(this.onreturn, this.onthrow, this.thisp);
    }
};

// The `throw` method is used by the promise observer to cancel the task from
// the consumer side.
TaskHandler.prototype.throw = function (error) {
    if (this.cancel) {
        this.cancel.call(this.cancelThisp);
    }
    this.become(Task.throw(error || new Error("Consumer canceled task")));
};


// ## TaskResolver
//
// The producer side of a task should get a reference to a task's resolver.
// The object provides the capability to settle the task with a completion
// value or a failure error.

function TaskResolver(handler) {
    handlers.set(this, handler);
    // The task resolver implicitly binds its return and throw methods so these
    // can be passed as free functions.
    this.return = this.return.bind(this);
    this.throw = this.throw.bind(this);
}

// The `return` method sets the tasks state to "fulfilled" (in the words of
// promises) or "completed" (in the vernacular of tasks), with a given value.
// If the corresponding observer was registered already, this will inform
// the observer as soon as possible.
// If the corresponding observer gets registered later, it will receive the
// result as soon as possible thereafter.
TaskResolver.prototype.return = function (value) {
    var handler = Task_getHandler(this);
    handler.become(Task.return(value));
};

// The `throw` method sets the tasks state to "rejected" (a term borrowed from
// promises) or "failed" (the corresponding task jargon), with the given error.
// Again, if the corresponding observer was registered already, this will
// inform the observer as soon as possible.
// If the corresponding observer gets registered later, it will receive the
// result as soon as possible thereafter.
TaskResolver.prototype.throw = function (error) {
    var handler = Task_getHandler(this);
    handler.become(Task.throw(error));
};


// ## TaskObservable
//
// The consumer side of a task should receive the task's observable.
// This object provides the ability to register exactly one observer for the
// result of the task, and the ability to cancel the task with an error.

function TaskObservable(handler) {
    handlers.set(this, handler);
}

/*
TODO TaskObservable.prototype = Object.create(Observable);
Such that it is possible to create parallel signaling for status and estimated
time to completion, or other arbitrary signals from the resolver to the
observable.
*/

// The `done` method registers an observer for any combination of completion or
// failure with the given methods and optional context object.
// The `done` method does not return a new task and does not capture errors
// thrown by the observer methods.
TaskObservable.prototype.done = function (onreturn, onthrow, thisp) {
    var self = this;
    var handler = Task_getHandler(self);
    handler.done(onreturn, onthrow, thisp);
};

// The `then` method registers an observer for any combination of completion or
// failure, and creates a new task that will be completed with the result of
// either the completion or failure handler.
TaskObservable.prototype.then = function (onreturn, onthrow, thisp) {
    // TODO accept status and estimated time to completion arguments in
    // arbitrary order.
    var handler = Task_getHandler(this);
    var task = new Task(this.cancel, this);
    var _onreturn, _onthrow;
    if (typeof onreturn === "function") {
        _onreturn = function (value) {
            try {
                task.in.return(onreturn.call(thisp, value));
            } catch (error) {
                task.in.throw(error);
            }
        };
    }
    if (typeof onthrow === "function") {
        _onthrow = function (error) {
            try {
                task.in.return(onthrow.call(thisp, error));
            } catch (error) {
                task.in.throw(error);
            }
        };
    }
    this.done(_onreturn, _onthrow);
    return task.out;
};

// The `spread` method fills a temporary need to be able to spread an array
// into the arguments of the completion handler of a `then` observer.
// ECMAScript 6 introduces the ability to spread arguments into an array in the
// signature of the method.
TaskObservable.prototype.spread = function (onreturn, onthrow, thisp) {
    return this.then(function (args) {
        return onreturn.apply(thisp, args);
    }, onthrow, thisp);
};

// The `catch` method registers an error observer on a task and returns a new
// task to be completed with the result of the observer.
// The observer may return another task or thenable to transfer responsibility
// to complete this task to another stage of the process.
TaskObservable.prototype.catch = function (onthrow, thisp) {
    return this.then(null, onthrow, thisp);
};

// The `finally` method registers an observer for when the task either
// completes or fails and returns a new task to perform some further work but
// forward the original value or error otherwise.
TaskObservable.prototype.finally = function (onsettle, thisp) {
    return this.then(function (value) {
        return onsettle.call(thisp).then(function Task_finally_value() {
            return value;
        })
    }, function (error) {
        return onsettle.call(thisp).then(function Task_finally_error() {
            throw error;
        });
    });
};

// The `get` method creates a task that will get a property of the completion
// object for this task.
TaskObservable.prototype.get = function (key) {
    return task.then(function (object) {
        return object[key];
    });
};

// The `call` method creates a task that will call the function that is the
// completion value of this task with the given spread arguments.
TaskObservable.prototype.call = function (thisp /*, ...args*/) {
    var args = [];
    for (var index = 1; index < arguments.length; index++) {
        args[index - 1] = arguments[index];
    }
    return task.then(function (callable) {
        return callable.apply(thisp, args);
    });
};

// The `invoke` method creates a task that will invoke a property of the
// completion object for this task.
TaskObservable.prototype.invoke = function (name /*, ...args*/) {
    var args = [];
    for (var index = 1; index < arguments.length; index++) {
        args[index - 1] = arguments[index];
    }
    return task.then(function (object) {
        return object[name].apply(object, args);
    });
};

// The `thenReturn` method registers an observer for the completion of this
// task and returns a task that will be completed with the given value when
// this task is completed.
TaskObservable.prototype.thenReturn = function (value) {
    return this.then(function () {
        return value;
    });
};

// The `thenReturn` method registers an observer for the completion of this
// task and returns a task that will fail with the given error when this task
// is completed.
TaskObservable.prototype.thenThrow = function (error) {
    return this.then(function () {
        return error;
    });
};

// Effects cancelation from the consumer side.
TaskObservable.prototype.throw = function (error) {
    var handler = Task_getHandler(this);
    if (handler.cancel) {
        handler.throw(error);
    }
};

// A task can only be observed once, but it can be forked.
// The `fork` method returns a new task that will observe the same completion
// or failure of this task.
// Hereafter, this task and all forked tasks must *all* be cancelled for this
// task's canceller to propagate.
TaskObservable.prototype.fork = function () {
    // The fork method works by fiddling with the handler of this task.
    // First, we extract this task's handler and make it the new parent for two
    // child tasks.
    var parentHandler = Task_getHandler(this);
    parentHandler.done(function (value) {
        left.in.return(value);
        right.in.return(value);
    }, function (error) {
        left.in.throw(error);
        right.in.throw(error);
    });
    /* TODO estimated time to completion forwarding */
    /* TODO use a signal operator to propagate cancellation */
    var leftCanceled = false, rightCanceled = false;
    var left = new Task(function (error) {
        if (leftCanceled) {
            return;
        }
        leftCanceled = true;
        if (rightCanceled) {
            parentHandler.throw(error);
        }
    });
    var right = new Task(function (error) {
        if (rightCanceled) {
            return;
        }
        rightCanceled = true;
        if (leftCanceled) {
            parentHandler.throw(error);
        }
    });
    // We replace our own handler with the left child
    handlers.set(this, Task_getHandler(left.out));
    // And return the task with the right child handler
    return right.out;
};

// The `delay` method of a task adds a delay of some miliseconds after the task
// *completes*.
// Cancelling the delayed task will cancel either the delay or the delayed
// task.
TaskObservable.prototype.delay = function (ms) {
    var self = this;
    var task = new Task(function cancelDelayedTask() {
        self.throw();
        clearTimeout(handle);
    });
    var result = new Task();
    var handle = setTimeout(function taskDelayed() {
        task.in.return(result.out);
    }, ms);
    this.done(function (value) {
        result.in.return(value);
    }, function (error) {
        task.in.throw(error);
    });
    return task.out;
};

// The `timeout` method will automatically cancel a task if it takes longer
// than a given delay in miliseconds.
TaskObservable.prototype.timeout = function (ms, message) {
    var self = this;
    var task = new Task(function cancelTimeoutTask() {
        this.throw();
        clearTimeout(handle);
    }, this);
    var handle = setTimeout(function Task_timeout() {
        self.throw();
        task.in.throw(new Error(message || "Timed out after " + ms + "ms"));
    }, ms);
    this.done(function Task_timeoutValue(value) {
        clearTimeout(handle);
        task.in.return(value);
    }, function Task_timeoutError(error) {
        clearTimeout(handle);
        task.in.throw(error);
    });
    return task.out;
};

