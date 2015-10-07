
# Concepts

For the purpose of discussion, we must establish a vocabulary.
Some of these names have a long tradition, or at least some precedent in
JavaScript.
Some are disputed, borrowed, or fabricated.

A **value** is **singular** and **spatial**.
It can be accessed or modified.
If we break this atom, it will fall into two parts: the **getter** and the
**setter**.
Data flows in one direction, from the setter to the getter.

The duality of a getter and a setter, a producer and a consumer, or a writer and
a reader, exists in every reactive primitive.
Erik Meijer shows us the parallelism and reflection that exists between various
types of reactive duals in his [keynote for Lang.NEXT, 2014][EM].

[EM]: http://channel9.msdn.com/Events/Lang-NEXT/Lang-NEXT-2014/Keynote-Duality

Singular is as opposed to **plural** or multiple.
An array, or generally any collection, contains multiple values.
An **iterator** is a plural getter.
A **generator** and iterator form the plural dual for values in space.

Spatial is as opposed to **temporal**.
Reactivity is about time.

A **promise** is a getter for a single value from the past or the future.
In JavaScript, and in the language E from which we borrowed the concept, the
corresponding setter is a **resolver**.
Collectively, an asynchronous value is a **deferred**.

If a promise is the temporal analogue of a value, a **stream** is the temporal
analogue of an array.
The producer side of a stream is a writer and the consumer side is a reader.
A **reader** is an asynchronous iterator and a **writer** is an asynchronous
generator.


| Interface  |               |          |          |
| ---------- | ------------- | -------- | -------- |
| Value      | Value         | Singular | Spatial  |
| Getter     | Getter        | Singular | Spatial  |
| Setter     | Setter        | Singular | Spatial  |
| Array      | Value         | Plural   | Spatial  |
| Iterator   | Getter        | Plural   | Spatial  |
| Generator  | Setter        | Plural   | Spatial  |
| Deferred   | Value         | Singular | Temporal |
| Promise    | Getter        | Singular | Temporal |
| Resolver   | Setter        | Singular | Temporal |
| Stream     | Value         | Plural   | Temporal |
| Reader     | Getter        | Plural   | Temporal |
| Writer     | Setter        | Plural   | Temporal |


## Singular and temporal

An observer can subscribe to eventually see the value of a promise.
They can do this before or after the promise has a value.
Any number of observers can subscribe multiple times and any single observer can
subscribe to the same promise multiple times.

As such, promises model dependency.
Promises and resolvers can be safely distributed to any number of producers and
consumers.
If multiple producers race to resolve a promise, the experience of each producer
is indistinguishable regardless of whether they won or lost the race.
Likewise, if multiple consumers subscribe to a promise, the experience of each
consumer is indistinguishable.
One consumer cannot prevent another consumer from making progress.
Information flows in one direction.
Promises make reactive programs more robust and composable.

Promises are **broadcast**.

The law that no consumer can interfere with another consumer makes it impossible
for promises to abort work in progress.
A promise represents a result, not the work leading to that result.

A **task** has mostly the same form and features as a promise, but is unicast by
default and can be cancelled.
A task can have only one subscriber, but can be explicitly forked to create a
new task that depends on the same result.
Each subscriber can unsubscribe, and if all subscribers have unsubscribed and no
further subscribers can be introduced, a task can abort its work.

Tasks are **unicast** and therefore cancelable.

See the accompanying sketch of a [task][] implementation.

[task]: http://kriskowal.github.io/gtor/docs/task

There is also an esoteric difference between a promise and a future.
Promise resolvers accept either a value or a promise and will recursively unwrap
transitive promises for promises.
In most if not all strongly typed languages, this behavior makes it hard if not
impossible to infer the type of a promise.
A **future** is a promise’s strongly typed alter ego, which can take advantage
of type inference to avoid having to explicitly cast the type of a promise.

Promises, tasks, and futures are three variations of a singular reactive value.
They vary by being either broadcast or unicast, or by being suitable for strong
or weak type systems.


## Plural and temporal

There are many plural reactive value types.
Each has a different adaptation for dealing with limited resources.

A **stream** has many of the same constraints as an array.
Imagine a plane with space and time.
If you rotate an array from the space axis to the time axis, it would become a
stream.
The order is important, and every value is significant.

Consumers and producers are unlikely to process values at the same rate.
If the consumer is faster than the producer, it must idle between receiving
values.
If a producer is faster than their corresponding consumer, it must idle between
sending values.

This pushing and pulling is captured by the concept of **pressure**.
On the producer side, a vacuum stalls the consumer and a pressure sends values
forward.
On the consumer side, a vacuum draws values forward and pressure, often called
**back pressure**, stalls the producer.
Pressure exists to ensure that every value transits the setter to the getter.

Since the consumer of a stream expects to see every value, streams are **unicast**
like tasks.
As they are unicast they are also cancelable.
Streams are a cooperation between the reader and the writer and information
flows both ways.
Data flows forward, acknowledgements flow backward, and either the consumer or
producer can terminate the flow.

Although a stream is unicast, it is certainly possible to branch a stream into
multiple streams in a variety of ways.
A fork in a stream is an operator that ensures that every value gets sent to
each of an array of consumers.
The slowest of the forks determines the pressure, so the pressure of a fork can
only be higher than that of a single consumer.
The simpler strategy of providing a stream to multiple consumers produces a
“round robin” load balancing effect, where each consumer receives an exclusive,
possibly random, portion of the stream.
The pressure of a shared stream can only be lower than that of a single
consumer.

In the following example, the `map` operator creates two new streams from a
single input stream.
The slow map will see half as many values as the fast map.
The slow map will consume and produce five values per second, and the fast map
will consume and produce ten, sustaining a maximum throughput of fifteen values
per second if the original stream can produce values that quickly.
If the original stream can only produce ten or less values per second, the
values will be distributed fairly between both consumers.

```js
var slow = stream.map(function (n) {
    return Promise.return(n).delay(200);
});
var fast = stream.map(function (n) {
    return Promise.return(n).delay(100);
});
```

In contrast, **publishers** and **subscribers** are **broadcast**.
Information flows only one direction, from the publishers to the subscribers.
Also, there is no guarantee of continuity.
The publisher does not wait for a subscriber and the subscriber receives
whatever values were published during the period of their subscription.
A stream would buffer all values produced until the consumer arrives.

With *time series data*, values that change over time but belie
the same meaning, order and integrity may not be important.
For example, if you were bombarded with weather forecasts, you could discard
every report except the one you most recently received.
Alternately, consider a value that represents the current time.
Since the current time is always changing, it would not be meaningful, much less
possible, to respond every moment it changes.

Time series data comes in two varieties: **discrete** and **continuous**.
Discrete values should be **pushed** whereas continuous values should be
**pulled** or **polled**.
(If a homophone is a disaster, what are synonymous homophones?)

The current time or temperature are examples of **continuous behaviors**.
Animation frames and morse code are examples of **discrete signals**.

Let us consider each primitive in detail.
Since the temporal primitives have spatial analogies, and since some of these
spatial primitives are relatively new to JavaScript, we will review these first.

