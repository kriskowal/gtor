
# Promise Iterators

One very important kind of promise iterator lifts a spatial iterator into the
temporal dimension so it can be consumed on demand over time.
In this sketch, we just convert a synchronous `next` method to a method that
returns a promise for the next iteration instead.
We use a mythical `iterate` function which would create iterators for all
sensible JavaScript objects and delegate to the `iterate` method of anything
else that implements it.
There is talk of using symbols in ES7 to avoid recognizing accidental iterables
as this new type of duck.

```js
function PromiseIterator(iterable) {
    this.iterator = iterate(iterable);
}
PromiseIterator.prototype.next = function () {
    return Promise.return(this.iterator.next());
};
```

The conversion may seem superfluous at first.
However, consider that a synchronous iterator might, apart from implementing
`next()`, also implement methods analogous to `Array`, like `forEach`,
`map`, `filter`, and `reduce`.
Likewise, an asynchronous iterator might provide analogues to these functions
lifted into the asynchronous realm.

The accompanying sketch of a stream constructor implements a method
`Stream.from`, analogous to ECMAScript 6's own `Array.from`.
This function coerces any iterable into a stream, consuming that iterator on
demand.
This allows us, for example, to run an indefinite sequence of jobs, counting
from 1, doing four jobs at any time.

```js
Stream.from(Iterator.range(1, Infinity))
.forEach(function (n) {
    return Promise.delay(1000).thenReturn(n);
}, null, 4)
.done();
```

## map

For example, asynchronous `map` would consume iterations and run jobs on each of
those iterations using the callback.
However, unlike a synchronous `map`, the callback might return a promise for
its eventual result.
The results of each job would be pushed to an output reader, resulting in
another promise that the result has been consumed.
This promise not only serves to produce the corresponding output iteration, but
also serves as a signal that the job has completed, that the output has been
consumed, and that the `map` can schedule additional work.
An asynchronous `map` would accept an additional argument that would limit the
number of concurrent jobs.

```js
promiseIterator.map(function (value) {
    return Promise.return(value + 1000).delay(1000);
});
```

## forEach

Synchronous `forEach` does not produce an output collection or iterator.
However, it does return `undefined` *when it is done*.
Of course synchronous functions are implicitly completed when they return,
but asynchronous functions are done when the asynchronous value they return
settles.
`forEach` returns a promise for `undefined`.

Since streams are **unicast**, asynchronous `forEach` would return a task.
It stands to reason that the asynchronous result of `forEach` on a stream would
be able to propagate a cancellation upstream, stopping the flow of data from the
producer side.
Of course, the task can be easily forked or coerced into a promise if it needs
to be shared freely among multiple consumers.

```js
var task = reader.forEach(function (n) {
    console.log("consumed", n);
    return Promise.delay(1000).then(function () {
        console.log("produced", n);
    });
})
var subtask = task.fork();
var promise = Promise.return(task);
```

Like `map` it would execute a job for each iteration, but by default it would
perform these jobs in serial.
Asynchronous `forEach` would also accept an additional argument that would
*expand* the number of concurrent jobs.
In this example, we would reach out to the database for 10 user records at any
given time.

```js
reader.forEach(function (username) {
    return database.getUser(username)
    .then(function (user) {
        console.log(user.lastModified);
    })
}, null, 10);
```

## reduce

Asynchronous `reduce` would aggregate values from the input reader, returning a
promise for the composite value.
The reducer would have an internal pool of aggregated values.
When the input is exhausted and only one value remains in that pool, the reducer
would resolve the result promise.
If you provide a basis value as an argument, this would be used to "prime the
pump".
The reducer would then start some number of concurrent aggregator jobs, each
consuming two values.
The first value would preferably come from the pool, but if the pool is empty,
would come from the input.
The second value would come unconditionally from the input.
Whenever a job completes, the result would be placed back in the pool.

## pipe

An asynchronous iterator would have additional methods like `copy` or `pipe`
that would send iterations from this reader to another writer.
This method would be equivalent to using `forEach` to forward iterations and
`then` to terminate the sequence.

```js
iterator.copy(generator);
// is equivalent to:
iterator.forEach(generator.yield).then(generator.return, generator.throw);
```

Note that the promise returned by yield applies pressure on the `forEach`
machine, pushing ultimately back on the iterator.

## buffer

It would have `buffer` which would construct a buffer with some capacity.
The buffer would try to always have a value on hand for its consumer by
prefetching values from its producer.
If the producer is faster than the consumer, this can help avoid round trip
latency when the consumer needs a value from the producer.

## read

Just as it is useful to transform a synchronous collection into an iterator and
an iterator into a reader, it is also useful to go the other way.
An asynchronous iterator would also have methods that would return a promise for
a collection of all the values from the source, for example `all`, or in the
case of readers that iterate collections of bytes or characters, `join` or
`read`.

