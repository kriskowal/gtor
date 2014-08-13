"use strict";

var Task = require("../task");

it("observe immediately completed task", function () {
    return Task.return(10).done(function (value) {
        expect(value).toBe(10);
    })
});

it("observe immediately failed task", function () {
    return Task.throw(new Error("Can't finish"))
    .catch(function (error) {
    })
});

it("coerces return values to returned tasks and forwards", function () {
    return Task.return(10).then(function (a) {
        return a + 20;
    }).then(function (b) {
        expect(b).toBe(30);
    });
});

it("recover from failed task", function () {
    return Task.throw(new Error("Can't finish"))
    .catch(function (error) {
        expect(error.message).toBe("Can't finish");
    })
    .then(function () {
        expect(true).toBe(true);
    })
});

it("can't observe multiple times", function () {
    var task = Task.return();
    task.done();
    expect(function () {
        task.done();
    }).toThrow();
});

it("multiple resolution is ignored", function () {
    // TODO consider carefully whether this makes sense outside the cancellation case
    var task = new Task();
    task.in.return(10);
    task.in.return(20);
    return task.out.then(function (value) {
        expect(value).toBe(10);
    });
});

it("cancelling before settling has effect", function () {
    var canceled = false;
    var thisp = {};
    var task = new Task(function () {
        canceled = true;
        expect(this).toBe(thisp);
    }, thisp);
    task.out.throw(); // TODO evaluate whether this should indeed be synchronous
    expect(canceled).toBe(true);
    task.in.return(); // should be ignored
    return task.out.catch(function (error) {
        expect(error && error.message).toBe("Consumer canceled task");
    });
});

it("cancelling after settling has no effect", function () {
    var canceled = false;
    var task = new Task(function () {
        canceled = true;
    });
    task.in.return();
    return task.out.then(function () {
        task.out.throw();
        expect(canceled).toBe(false);
    });
});

describe("timeout", function () {

    it("works", function () {
        var canceled = false;
        return new Task(function () {
            canceled = true;
        }).out.delay(1000).timeout(0)
        .catch(function (error) {
            expect(canceled).toBe(true);
            expect(error && error.message).toBe("Timed out after 0ms");
        });
    });

});

describe("delay", function () {

    it("works", function () {
        var now = Date.now();
        var task = Task.return(10)
        .delay(100)
        .then(function (n) {
            expect(Date.now()).toBeNear(now + 100, 40);
            expect(n).toBe(10);
        });
        return task;
    });

    it("can be canceled", function () {
        var now = Date.now();
        var canceled = false;
        var task = new Task(function () {
            canceled = true;
        }).out;
        var delayed = task.delay(100);
        delayed.throw();
        expect(canceled).toBe(true);
        return delayed.catch(function (error) {
            expect(Date.now()).toBeNear(now, 10); // as opposed to + 100
            expect(error && error.message).toBe("Consumer canceled task");
        });
    });

});

describe("all", function () {

    it("works", function () {
        return Task.all([1, 2, 3])
        .spread(function (a, b, c) {
            expect(a).toBe(1);
            expect(b).toBe(2);
            expect(c).toBe(3);
        })
    });

    it("can be canceled in aggregate", function () {
        var canceled = {};
        var all = Task.all([1, 2, 3].map(function (n) {
            return new Task(function () {
                canceled[n] = true;
            }).out.delay(1000);
        }));
        all.throw();
        var now = Date.now();
        return all.catch(function (error) {
            expect(Date.now()).toBeNear(now, 10); // immediate
            expect(canceled).toEqual({1: true, 2: true, 3: true}); // all children
            expect(error && error.message).toBe("Consumer canceled task");
        });
    });

    it("can be canceled by individual cancelation", function () {
        var canceled = {};
        var tasks = [1, 2, 3].map(function (n) {
            return new Task(function () {
                canceled[n] = true;
            }).out.delay(1000);
        });
        tasks[1].throw();
        var now = Date.now();
        return Task.all(tasks).catch(function (error) {
            expect(Date.now()).toBeNear(now, 10); // immediate
            expect(canceled).toEqual({1: true, 2: true, 3: true}); // all children
            expect(error && error.message).toBe("Consumer canceled task");
        });
    });

    it("can be canceled by individual failure", function () {
        var canceled = {};
        var tasks = [1, 2, 3].map(function (n) {
            return new Task(function () {
                canceled[n] = true;
            }).out.delay(1000);
        });
        var task = new Task();
        tasks.push(task.out);
        task.in.throw(new Error("Failed"));
        var now = Date.now();
        return Task.all(tasks).catch(function (error) {
            expect(Date.now()).toBeNear(now, 10); // immediate
            expect(canceled).toEqual({1: true, 2: true, 3: true}); // all children
            expect(error && error.message).toBe("Failed");
        });
    });

});

describe("fork", function () {

    it("works", function () {
        var parent = Task.return(10);
        var child = parent.fork();
        return Task.all([parent, child]).spread(function (a, b) {
            expect(a).toBe(10);
            expect(b).toBe(10);
        });
    });

    it("can be canceled by child", function () {
        var canceled = false;
        var root = new Task(function () {
            canceled = true;
        });
        var child = root.out.fork();
        root.out.throw();
        expect(canceled).toBe(false);
        child.throw();
        expect(canceled).toBe(true);
    });

    it("can be canceled by parent", function () {
        var canceled = false;
        var root = new Task(function () {
            canceled = true;
        });
        var child = root.out.fork();
        child.throw();
        expect(canceled).toBe(false);
        root.out.throw();
        expect(canceled).toBe(true);
    });

});

