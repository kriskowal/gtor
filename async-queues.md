
# Promise Queues

Consider an asynchronous queue.
With a conventional queue, you must put a value in before you can take it out.
That is not the case for a promise queue.
Just as you can attach an observer to a promise before it is resolved, with a
promise queue, you can get a promise for the next value in order before that
value has been given.

```js
var queue = new Queue();
queue.get().then(function (value) {
    console.log(value);
})
queue.put("Hello, World!");
```

Likewise of course you can add a value to the queue before observing it.

```js
var queue = new Queue();
queue.put("Hello, World!");
queue.get().then(function (value) {
    console.log(value);
})
```

Although promises come out of the queue in the same order their corresponding
resolutions enter, a promise obtained later may settle sooner than another
promise.
The values you put in the queue may themselves be promises.

```js
var queue = new Queue();
queue.get().then(function () {
    console.log("Resolves later");
});
queue.get().then(function () {
    console.log("Resolves sooner");
});
queue.put(Promise.delay(100));
queue.put();
```

A promise queue qualifies as an asynchronous collection, specifically a
collection of results: values or thrown errors captured by promises.
The queue is not particular about what those values mean and is a suitable
primitive for many more interesting tools.

| Interface     |         |        |          |
| ------------- | ------- | ------ | -------- |
| PromiseQueue  | Value   | Plural | Temporal |
| queue.get     | Getter  | Plural | Temporal |
| queue.put     | Setter  | Plural | Temporal |

The implementation of a promise queue is sufficiently succinct that there’s no
harm in embedding it here.
This comes from Mark Miller's [Concurrency Strawman][] for ECMAScript and is a
part of the Q library, exported by the `q/queue` module.
Internally, a promise queue is an asynchronous linked list that tracks the
`head` promise and `tail` deferred.
`get` advances the `head` promise and `put` advances the `tail` deferred.

```js
module.exports = PromiseQueue;
function PromiseQueue() {
    if (!(this instanceof PromiseQueue)) {
        return new PromiseQueue();
    }
    var ends = Promise.defer();
    this.put = function (value) {
        var next = Promise.defer();
        ends.resolve({
            head: value,
            tail: next.promise
        });
        ends.resolve = next.resolve;
    };
    this.get = function () {
        var result = ends.promise.get("head");
        ends.promise = ends.promise.get("tail");
        return result;
    };
}
```

[Concurrency Strawman]: http://wiki.ecmascript.org/doku.php?id=strawman:concurrency

The implementation uses methods defined in a closure.
Regardless of how this is accomplished, it is important that it be possible to
pass the free `get` function to a consumer and `put` to a producer to preserve
the principle of least authority and the unidirectional flow of data from
producer to consumer.

See the accompanying sketch of a [promise queue][] implementation.

[promise queue]: http://kriskowal.github.io/gtor/docs/promise-queue

A promise queue does not have a notion of termination, graceful or otherwise.
We will later use a pair of promise queues to transport iterations between
**streams**.

