
# Promise Generators

A promise generator is analogous in all ways to a plain generator.
Promise generators implement `yield`, `return`, and `throw`.
The return and throw methods both terminate the stream.
Yield accepts a value.
They all return promises for an acknowledgement iteration from the consumer.
Waiting for this promise to settle causes the producer to idle long enough for
the consumer to process the data.

One can increase the number of promises that can be held in flight by a promise
buffer.
The buffer constructor takes a `length` argument that primes the acknowledgement
queue, allowing you to send that number of values before having to wait for the
consumer to flush.

```js
var buffer = new Buffer(1024);
function fibStream(a, b) {
    return buffer.in.yield(a)
    .then(function () {
        return fibStream(b, a + b);
    });
}
fibStream(1, 1).done();
return buffer.out;
```

If the consumer would like to terminate the producer prematurely, it calls the
`throw` method on the corresponding promise iterator.
This will eventually propagate back to the promise returned by the generator’s
`yield`, `return`, or `throw`.

```js
buffer.out.throw(new Error("That's enough, thanks"));
```

