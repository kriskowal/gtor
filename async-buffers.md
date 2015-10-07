
# Promise Buffers

Consider another application.
You have a producer and a consumer, both doing work asynchronously, the producer
periodically sending a value to the consumer.
To ensure that the producer does not produce faster than the consumer can
consume, we put an object between them that regulates their flow rate: a buffer.
The buffer uses a promise queue to transport values from the producer to the
consumer, and another promise queue to communicate that the consumer is ready
for another value from the producer.
The following is a sketch to that effect.

```js
var outbound = new PromiseQueue();
var inbound = new PromiseQueue();
var buffer = {
    out: {
        next: function (value) {
            outbound.put({
                value: value,
                done: false
            });
            return inbound.get();
        },
        return: function (value) {
            outbound.put({
                value: value,
                done: true
            })
            return inbound.get();
        },
        throw: function (error) {
            outbound.put(Promise.throw(error));
            return inbound.get();
        }
    },
    in: {
        yield: function (value) {
            inbound.put({
                value: value,
                done: false
            })
            return outbound.get();
        },
        return: function (value) {
            inbound.put({
                value: value,
                done: true
            })
            return outbound.get();
        },
        throw: function (error) {
            inbound.put(Promise.throw(error));
            return outbound.get();
        }
    }
};
```

This sketch uses the vernacular of iterators and generators, but each of these
has equivalent nomenclature in the world of streams.

-   `in.yield` means “write”.
-   `in.return` means “close”.
-   `in.throw` means “terminate prematurely with an error”.
-   `out.next` means “read”.
-   `out.throw` means “abort or cancel with an error”.
-   `out.return` means “abort or cancel prematurely but without an error”.

So a buffer fits in the realm of reactive interfaces.
A buffer has an asynchronous iterator, which serves as the getter side.
It also has an asynchronous generator, which serves as the setter dual.
The buffer itself is akin to an asynchronous, plural value.
In addition to satisfying the requirements needed just to satisfy the
triangulation between synchronous iterables and asynchronous promises,
it solves the very real world need for streams that support pressure
to regulate the rate of flow and avoid over-commitment.
An asynchronous iterator is a readable stream.
An asynchronous generator is a writable stream.

| Stream            |         |          |              |
| ----------------- | ------- | -------- | ------------ |
| Promise Buffer    | Value   | Plural   | Temporal     |
| Promise Iterator  | Getter  | Plural   | Temporal     |
| Promise Generator | Setter  | Plural   | Temporal     |

A buffer has a reader and writer, but there are implementations of reader and
writer that interface with the outside world, mostly files and sockets.

In the particular case of an object stream, if we treat `yield` and `next` as
synonyms, the input and output implementations are perfectly symmetric.
This allows a single constructor to serve as both reader and writer.
Also, standard promises use the [Revealing Constructor] pattern, exposing the
constructor for the getter side.
The standard hides the `Promise.defer()` constructor method behind the scenes,
only exposing the `resolver` as arguments to a setup function, and never
revealing the `{promise, resolver}` deferred object at all.
Similarly, we can hide the promise buffer constructor and reveal the input side
of a stream only as arguments to the output stream constructor.

```js
var reader = new Stream(function (write, close, abort) {
    // ...
});
```

The analogous method to `Promise.defer()` might be `Stream.buffer()`, which
would return an `{in, out}` pair of entangled streams.

[Revealing Constructor]: http://domenic.me/2014/02/13/the-revealing-constructor-pattern/

See the accompanying sketch of a [stream][] implementation.

[stream]: http://kriskowal.github.io/gtor/docs/stream

