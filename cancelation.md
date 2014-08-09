
-   TODO

-   From MarkM:
    The requestor saying it is no longer interested should not be a source of
    possible requestee inconsistent state that the requestee needs to recover from,
    unless the requestee goes out of its way to take on that burden in order to stop
    early.
    The key thing is that cancellation is the communication of lack of interest or
    impatience (see recent paper again) from requestor to requestee, and so is
    handled well by a promise going in the direction opposite to results.

-   KrisK
    the other open issue in my mind is whether cancel() (in whatever form it comes)
    should return a promise, and whether that promise should settled before
    attempting another request, 
    yes, and GC does not communicate impatience effectively.
    and furthermore, the possibility that cancel() (in whatever form it takes) might
    be able to provide a useful “all clear” promise, though the producer should by
    no means rely upon the consumer to observe that promise before making another
    request.
    a signal that internal consistency has been restored.
    a signal that it would internally wait for before accepting another request
    anyway, so that is moot.

# Canceling asynchronous tasks

Promises are a tool for managing asynchronous code.
A promise represents the eventual result of a function call that can't be
completed without blocking.
It is simple to create a new promise that depends on the result of one or more
other promises, and more than one promise can depend on another.

MontageJS makes a great deal of use of promises, [using Q][Q].
Although you can use MontageJS modules without ever encountering a promise,
the module system uses them extensively, and you can use promises to coordinate
Undo and Redo operations.

[Q]: https://github.com/kriskowal/q

Whenever you set out to do some work asynchronously, you return a promise.
This is an example of creating a promise for some value after a delay.

```js
var Promise = require("q").Promise;
function delay(value, ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve(value);
        }, delay);
    });
}
```

Promises seem like an obvious object to support a method for canceling work.
If you are using `setTimeout` directly, you would use `clearTimeout` to cancel
the delay.
However, this conflicts with the requirement that a single promise object can
have multiple consumers.
A good promise implementation ensures that information flows only from the
producer to consumer.
If one consumer can cancel the promise, it would be able to use this capability
to interfere with any other consumer of that promise.

That being said, the desire for promises to support cancellation is
well-grounded.
If a promise represents a large quantity of work, as it often does, it does not
make sense to continue doing that work when there remain no consumers interested
in the result.
It makes even less sense if the consumer goes on to ask a similar question that
will require the same resources, like a database lock or even just time on the
CPU.
The issue compounds further when the user is fickle and frequently changing its
query, as in search-as-you-type interfaces.

## Proof by contradiction

To support cancellation, we would need a new reactive primitive.
Provisionally, let us call such an object a Task because it is foremost a
representation of work in progress, not merely a proxy for the result.
The interface and terminology for a Task would have much in common with a
Promise, but would differ subtly in usage.

There would need to be a single producer to single consumer relationship.
Branches in the chain from producer to consumer would still be possible,
but would need to be explicit.
Upon construction, a task would be in a detached state.
It has a producer but it does not have a consumer.
A consumer would be attached with a method like `then`.

In this example, we implement `task.delay(ms)`, which will cause the task's result
to be delayed by a certain duration after its result has been fulfilled.
If the task is cancelled, the timer will be cancelled, and the returned task will
be implicitly rejected with a cancellation error.
In the `Task` constructor, we have an opportunity to return a cancellation hook.

```js
Task.prototype.delay = function Task_delay(ms) {
    return this.then(function (value) {
        return new Task(function (resolve, reject, estimate) {
            var handle = setTimeout(function () {
                resolve(value);
            }, delay);
            return function cancel() {
                clearTimeout(handle);
            };
        });
    });
}
```

Once a consumer has been attached, any subsequent attempt to attach another
consumer would throw an error.

```js
var plusTenTask = task.then(function (value) { return value + 10 });
// The next line throws an error.
var plusTwentyTask = task.then(function (value) { return value + 20 });
```

The second consumer must throw an error to preserve the one-producer to
one-consumer relationship.
If we cancel `plusTenTask`, it implies that we can cancel `task`.
This would interfere with the resolution of `plusTwentyTask`.

## Explicitly branching

Although a task can only have one consumer by default, there does need to be a
mechanism by which a result can be retained for multiple consumers explicitly.
A call to `fork` would retain the result for a subsequent consumer.
This could be accomplished internally in a variety of ways, but ultimately
counting interested consumers.

```js
var plusTenTask = task.fork().then(function (value) { return value + 10 });
var plusTwentyTask = task.then(function (value) { return value + 20 });
```

Now, if we cancel `plusTenTask`, we know that one out of the two parties
interested in the result of `task` have been cancelled, and thus, we cannot
cancel `task`. If we then cancel `plusTwentyTask`, we know that there are no
consumers interested in the `task` and the cancellation can propagate.

A common pattern for promises is memoization.
We can keep a promise around just in case at some point in the future, another
consumer becomes interested in the result.

```js
var memo = new Dict();
function getUser(userName) {
    if (!memo.has(userName)) {
        memo.set(reallyGetUser(userName));
    }
    return memo.has(userName);
}
```

The first call to `getUser("alice")` will create a promise for her user record.
However, if that promise is cancelled, it provides no indication that the
underlying task may be cancelled, assuming of course that it has not already
completed.
At some point, another consumer might call `getUser("alice")` and will expect
*not* to receive promise for a cancellation error.

With tasks, the story is different.
We want the memo to strictly grow and we *never* intend to cancel any task once
a user record has been requested.
To ensure this, we must explicitly call `fork` for each new consumer.

```js
var memo = new Dict();
function getUser(userName) {
    if (!memo.has(userName)) {
        memo.set(reallyGetUser(userName));
    }
    return memo.has(userName).fork();
}
```

This illustrates the necessity that a task *enforce* its single consumer
mandate.
If the task implicitly forked, there would be no indication that the explicit
`fork` were missing.
The following example would throw an exception if the author of `getUser`
neglected to explicitly call `fork`.

```js
getUser("alice").then(getPassword);
getUser("alice").then(getPassword);
```

## Distributed garbage collection

Also, consider the case of remote tasks.
If we have a connection between two processes and one process requests a promise
for the result of a task on the other, the far side must retain a promise for the
result indefinitely, since the near side may continue communicating with it
indefinitely.
There are bodies of research in distributed garbage collection addressing this
topic.

With tasks, once a result has been communicated to the other side of a
connection, assuming that it has not been consumed by a `fork`, the far side no
longer needs to retain a reference to it.
If the consumer does *fork* the far reference, the reference can be retained
until all forks are either consumed or cancelled.

## *Quod est absurdum*

A task is a form of a promise with explicit reference management, a concept that
we largely left behind in garbage collected languages like JavaScript.
This is a hint as to how and why promises are the better bet in the long term.

In due course, we can expect [Weak references][WeakRef] and post-mortem
finalization to be introduced to JavaScript.
This would be a new language primitive that would allow us to receive a message
by way of callback *after* a weakly-held reference has been garbage collected.
Dropping a promise is the surest sign that a consumer is no longer interested in
the result of a promise, both locally and remotely.
When we can observe that a promise has been dropped, we may be able to
implicitly cancel the associated work.

[WeakRef]: http://wiki.ecmascript.org/doku.php?id=strawman:weak_references

Until then however, tasks remain an interesting idea.

