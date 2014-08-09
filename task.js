"use strict";

var asap = require("asap");
var WeakMap = require("weak-map");

var handlers = new WeakMap();

module.exports = Task;
function Task() {
}

function DeferredTask(cancel, thisp) {
    var handler = new TaskHandler(); // TODO polymorph constructors
    this.in = new TaskResolver(handler);
    this.out = new TaskObservable(handler);
    handler.cancel = cancel;
    handler.cancelThisp = thisp;
}

Task.isTask = isTask;
function isTask(object) {
    return Object(object) === object && !!handlers.get(object);
};

function isThenable(object) {
    return Object(object) === object && typeof object.then === "function";
}

Task.defer = function (cancel, thisp) {
    return new DeferredTask(cancel, thisp);
};

Task.return = function (value) {
    if (isTask(value)) {
        return value;
    } else if (isThenable(value)) {
        throw new Error("Thenables not yet implemented");
    } else {
        var handler = new TaskHandler();
        handler.state = "fulfilled";
        handler.value = value;
        return new TaskObservable(handler);
    }
};

Task.throw = function (error) {
    var handler = new TaskHandler();
    handler.state = "rejected";
    handler.error = error;
    return new TaskObservable(handler);
};

Task.all = function Task_all(tasks) {
    // TODO estimated time to completion
    function cancelAll(error) {
        // Cancel all other outstanding tasks
        for (var otherIndex = 0; otherIndex < tasks.length; otherIndex++) {
            tasks[otherIndex].throw();
        }
        result.in.throw(error);
    }
    var remaining = tasks.length;
    var result = Task.defer(cancelAll);
    var results = Array(tasks.length);
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
        }, function Task_all_anyThrow(error) {
            cancelAll(error);
        });
    });
    return result.out;
};

Task.any = function (tasks) {
    // TODO
};

Task.race = function (tasks) {
    // TODO
};

Task.delay = function (ms, value) {
    return Task.return(value).delay(ms);
};

function TaskHandler() {
    this.became = null;
    this.cancel = null;
    this.cancelThisp = null;
    this.state = "pending";
    this.value = null;
    this.error = null;
    this.observed = false;
    this.onreturn = null;
    this.onthrow = null;
    this.thisp = null;
}

function Task_getHandler(task) {
    var handler = handlers.get(task);
    while (handler && handler.became) {
        handler = handler.became;
    }
    handlers.set(task, handler);
    return handler;
}

TaskHandler.prototype.done = function (onreturn, onthrow, thisp) {
    if (this.observed) {
        throw new Error("Can't observe a task multiple times. Use fork");
    }
    this.observed = true;
    this.onreturn = onreturn;
    this.onthrow = onthrow;
    this.thisp = thisp;
    if (this.state !== "pending") {
        asap(this);
    }
};

// The task interface for `asap`.
// So we can reuse the task handler instead of creating a closure.
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
    this.onreturn = null;
    this.onthrow = null;
    this.thisp = null;
};

TaskHandler.prototype.become = function (task) {
    var handler = Task_getHandler(task);
    if (this.state !== "pending") {
        return;
    }
    this.became = handler;
    this.cancel = null;
    this.cancelThisp = null;
    if (this.observed) {
        handler.done(this.onreturn, this.onthrow, this.thisp);
    }
};

TaskHandler.prototype.throw = function (error) {
    this.cancel.call(this.cancelThisp);
    this.become(Task.throw(error || new Error("Consumer canceled task")));
};

function TaskResolver(handler) {
    handlers.set(this, handler);
    this.return = this.return.bind(this);
    this.throw = this.throw.bind(this);
}

TaskResolver.prototype.return = function (value) {
    var handler = Task_getHandler(this);
    handler.become(Task.return(value));
};

TaskResolver.prototype.throw = function (error) {
    var handler = Task_getHandler(this);
    handler.become(Task.throw(error));
};

function TaskObservable(handler) {
    handlers.set(this, handler);
}

// TODO TaskObservable.prototype = Object.create(Observable);
// Such that it is possible to create parallel signaling for status and
// estimated time to completion, or other arbitrary signals from the resolver
// to the observable.

TaskObservable.prototype.done = function (onreturn, onthrow, thisp) {
    var self = this;
    var handler = Task_getHandler(self);
    handler.done(onreturn, onthrow, thisp);
};

TaskObservable.prototype.then = function (onreturn, onthrow, thisp) {
    // TODO accept status and estimated time to completion arguments in
    // arbitrary order.
    var handler = Task_getHandler(this);
    var task = Task.defer(this.cancel, this);
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

TaskObservable.prototype.spread = function (onreturn, onthrow, thisp) {
    return this.then(function (args) {
        return onreturn.apply(thisp, args);
    }, onthrow, thisp);
};

TaskObservable.prototype.catch = function (onthrow, thisp) {
    return this.then(null, onthrow, thisp);
};

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

TaskObservable.prototype.thenReturn = function (value) {
    return this.then(function () {
        return value;
    });
};

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

TaskObservable.prototype.fork = function () {
    var parentHandler = Task_getHandler(this);
    parentHandler.done(function (value) {
        left.in.return(value);
        right.in.return(value);
    }, function (error) {
        left.in.throw(error);
        right.in.throw(error);
    });
    // TODO estimated time to completion forwarding
    var leftCanceled = false, rightCanceled = false;
    var left = Task.defer(function () {
        if (leftCanceled) {
            return;
        }
        leftCanceled = true;
        if (rightCanceled) {
            parentHandler.throw();
        }
    });
    handlers.set(this, Task_getHandler(left.out));
    var right = Task.defer(function () {
        if (rightCanceled) {
            return;
        }
        rightCanceled = true;
        if (leftCanceled) {
            parentHandler.throw();
        }
    });
    return right.out;
};

TaskObservable.prototype.delay = function (ms) {
    var self = this;
    var task = Task.defer(function cancelDelayedTask() {
        self.throw();
        clearTimeout(handle);
    });
    var result = Task.defer();
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

TaskObservable.prototype.timeout = function (ms, message) {
    var self = this;
    var task = Task.defer(function cancelTimeoutTask() {
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

