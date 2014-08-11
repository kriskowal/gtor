
# A General Theory of Reactivity

*A work in progress.*

In the context of a computer program, reactivity is the process of receiving
external stimuli and propagating events.
This is a rather broad definition that covers a wide variety of topics.
The term is usually reserved for systems that respond in turns to sensors,
schedules, and above all, problems that exist between the chair and keyboard.

The field of reactivity is carved into plots ranging from "reactive programming"
to the subltly distinct "*functional* reactive programming", with acrage set
aside for "self adjusting computation" and with neighbors like "bindings".
Adherents favor everything from "continuation passing style" to "promises", or
the related concepts of "deferreds", "futures", and "tasks".
Other problems lend themselves to "observables", sometimes called "signals" or
"behaviors", and everyone agrees that "streams" are a good idea, but
"publishers" and "subscribers" are distinct.

In 1905, Einstein created a theory of special relativity that unified the
concepts of space and time, and went on to incorporate gravity, to bring the
three fundamentals of physical law into a single model.
To a similar end, [various][Rx] minds in the field of reactivity have been
converging on a model that unifies at least promises and observables.

[Rx]: https://github.com/Reactive-Extensions/RxJS/blob/aaebfe8962cfa06a6c80908d079928ba5b800c66/doc/readme.md

             | **Singular**         | **Plural**
:----------: | :------------------: | :---------------------:
**Spatial**  | Value                | Iterable&lt;Value&gt;
**Temporal** | Promise&lt;Value&gt; | Observable&lt;Value&gt;

However, this description fails to capture all of the varigated concepts of
reactivity.
As the common paraphrase of Einstein goes, everything should be made as simple
as possible, but no simpler.


## Concepts

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
Erik Miejer shows us the parallelism and reflection that exists between various
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
A reader is an **asynchronous iterator** and a writer is an **asynchronous
generator**.


Interface  |               |          |          |
---------- | ------------- | -------- | -------- |
Value      | Value         | Singular | Spatial  |
Getter     | Getter        | Singular | Spatial  |
Setter     | Setter        | Singular | Spatial  |
Array      | Value         | Plural   | Spatial  |
Iterator   | Getter        | Plural   | Spatial  |
Generator  | Setter        | Plural   | Spatial  |
Deferred   | Value         | Singular | Temporal |
Promise    | Getter        | Singular | Temporal |
Resolver   | Setter        | Singular | Temporal |
Reader     | Getter        | Plural   | Temporal |
Writer     | Setter        | Plural   | Temporal |
Stream     | Value         | Plural   | Temporal |


Just as an array is an exemplar of an entire taxonomy of collections, promises
and streams are merely representatives of their class of reactive primitives.


### Singular and temporal

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


### Plural and temporal

There are many plural reactive value types.
Each has a different adaptation for dealing with limited resources.

A **stream** has many of the same constraints as an array.
Imagine a plane with space and time.
If you rotate an array from the space axis to the time axis, it would become a
stream.
The order of the contained values is important, and every value is significant.

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
If a homophone is a disaster, what are synonymous homophones?


## Primitives

Let us consider each primitive in detail.
Since the temporal primitives have spatial analogies, and since some of these
spatial primitives are relatively new to JavaScript, we will review these first.


### Iterators

An iterator is an object that allows us to lazily but synchronously consume
multiple values.
Iterators are not new to JavaScript, but there is a new standard forming at time
of writing.

Iterators implement a `next()` method that must either return an object with the
next or final value in the sequence.
Although the standard does not give this object a name, we will call it an
**iteration**.
An iteration has a `value` property and must have a `done` property if the
sequence has ended.

Iterators are an interface with many implementations.
The canonical iterator yields the values from an array.

```js
var iterator = iterate([1, 2, 3]);
var iteration = iterator.next();
expect(iteration.value).toBe(1);
iteration = iterator.next();
expect(iteration.value).toBe(2);
iteration = iterator.next();
expect(iteration.value).toBe(3);
iteration = iterator.next();
expect(iteration.done).toBe(true);
```

We propose that an iteration might also have an optional `index` property.
This would allow the iterator to provide some additional context from the
source.

```js
var iterator = iterate("ABC");
var iteration = iterator.next();
expect(iteration.value).toBe("A");
expect(iteration.index).toBe(0);
iteration = iterator.next();
expect(iteration.value).toBe("B");
expect(iteration.index).toBe(1);
iteration = iterator.next();
expect(iteration.value).toBe("C");
expect(iteration.index).toBe(2);
```

What distinguishes an iterator from an array is that it is **lazy**.
They do not necessarily end.
We can have iterators for non-terminating sequences, like counting or the
fibonacci sequence.
The `range` function produces a sequence of values within an interval and
separated by a stride.

```js
function range(start, stop, step) {
    return {next: function () {
        var iteration;
        if (start < stop) {
            iteration = {value: start};
            start += step;
        } else {
            iteration = {done: true};
        }
        return iteration;
    }};
}
```

If the `stop` value of the range is `Infinity`, the iterator will have no end,
will never produce a `done` iteration.
Unlike an array, an idefinite iterator consumes no more memory than an empty
one.

```js
var iterator = range(0, Infinity, 1);
expect(iterator.next().value).toBe(0);
expect(iterator.next().value).toBe(1);
expect(iterator.next().value).toBe(2);
// ...
```

The **eager** equivalent would produce an array, but would only work for bounded
intervals since it must create an exhaustive collection in memory before
returning.

```js
function range(start, stop, step) {
    var result = [];
    while (start < stop) {
        result.push(start);
        start += step;
    }
    return result;
}

expect(range(0, 6, 2)).toEqual([0, 2, 4]);
```

Iterators may have alternate implementations of some methods familiar from
arrays.
For example, `forEach` would walk the iterator until it is exhausted.
`map` would produce a new iterator of values passed through some transform,
while `filter` would produce a new iterator of the values that pass a test.
An iterator can support `reduce`, which would exhaust the iteration, but
`reduceRight` would be less sensible since iterators only walk forward.
Iterators may also have some methods that are unique to their character, like
`dropWhile` and `takeWhile`.

We can save time and space by implementing pipelines with iterators instead of
arrays.
The following example can be interpreted as either eager or lazy, depending on
whether `range` returns an array or an iterator.
If we start with an array, `map` will create another array of 1000 values and
`filter` will create another large array.
If we start with an iterator, we will never construct an array of any size,
instead percolating one value at a time as the reducer pulls them from the
filter, as the filter pulls them from the mapping, and as the mapping pulls them
from the range.

```js
range(0, 1000, 1)
.map(function (n) {
    return n * 2;
})
.filter(function (n) {
    return n % 3 !== 0;
})
.reduce(function (a, b) {
    return a + b;
})
```


### Generator Functions

Consider the eager and lazy `range` function implementations.
We lose a certain clarity when we convert the array range maker into an iterator
range maker.
Generator functions alleviate this problem by offering a way to express
iterations procedurally, with a lazy behavior.

A JavaScript engine near you may already support generator functions.
The syntax consists of adding an asterisk to the function declaration and using
`yield` to produce iterations.
Calling a generator function does not execute the function, but instead sets up
a state machine to track where we are in the function and returns an iterator.
Whenever we ask the iterator for an iteration, the state machine will resume the
execution of the function until it produces an iteration or terminates.

```js
function *range(start, stop, step) {
    while (start < stop) {
        yield start;
        start += step;
    }
}

var iterator = range(0, Infinity, 1);
expect(iterator.next().value).toBe(0);
expect(iterator.next().value).toBe(1);
expect(iterator.next().value).toBe(2);
// ...
```

Notice that the range generator function restores and perhaps even exceeds the
clarity of the range array maker.

Calling `next` has three possible outcomes.
If the iterator encounters a `yield`, the iteration will have a `value`.
If the iterator runs the function to either an express or implied `return`, the
iteration will have a `value` and `done` will be true.
If the iterator runs to an explicit return, this terminal iteration carries the
return value.
If the generator function throws an error, this will propagate out of `next()`.

Generators and iterators are **unicast**.
The consumer expects to see every value from the producer.
Since generators and iterators cooperate, information flows both forward as
values, and backward as requests for more values.

However, the consumer can send other information back to the producer.
The `next` method, familiar from basic iterators, gains the ability to determine
the value of the `yield` expression from which the generator resumes.
As a trivial example, consider a generator that echos whatever the consumer
requests.

```js
function *echo() {
    var message;
    while (true) {
        message = yield message;
    }
}

var iterator = echo();
expect(iterator.next().value).toBe(undefined);
expect(iterator.next("Hello").value).toBe(undefined);
expect(iterator.next("Goodbye").value).toBe("Hello");
expect(iterator.next().value).toBe("Goodbye");
expect(iterator.next().value).toBe(undefined);
```

We must prime the generator because it does not begin with a `yield`.  We
advance, the state machine to the first `yield` and allow it to produce the
initial, undefined message.
We then populate the message variable with a value, receiving its former
undefined content again.
Then we begin to see the fruit of our labor as the values we previously sent
backward come forward again.
This foreshadows the ability of stream readers to push back on stream writers.

Additionally, the iterator gains a `throw` method that allows the iterator to
terminate the generator by causing the `yield` expression to raise the given
error.
The error will pass through any try- catch or finally blocks in the generators
stack, and unless handled, through your own stack.
As such, like `next`, the `throw` method may either return an iterator or throw
an error.
This foreshadows the ability of a stream reader to prematurely stop a stream
writer.

```js
iterator.throw(new Error("Do not want!"));
```

Note that in Java, [iterators][Java Iterator] have a `hasNext()` method.
This is not implementable for generators owing to the [Halting Problem][].
The iterator must try to get a value from the generator before the generator can
conclude that it cannot produce another value.

[Java Iterator]: http://docs.oracle.com/javase/7/docs/api/java/util/Iterator.html
[Halting Problem]: http://en.wikipedia.org/wiki/Halting_problem


### Generators

There is no proposal for a standard generator, but for the sake of completeness,
if an array iterator consumes an array, an array generator would lazilly produce
one.
An array generator object would implement `yield`, `return`, and `throw` as
methods with behavior analogous to the same keywords within a generator
function.
The `yield` method would add a value to the array.

```js
var array = [];
var generator = generate(array);
generator.yield(10);
generator.yield(20);
generator.yield(30);
expect(array).toEqual([10, 20, 30]);
```

Since ECMAScript 5, at Doug Crockford’s behest, JavaScript allows keywords to be
used for property names.

Just as iterations can carry an index from an array iterator, `yield` would
accept an optional index argument.

```js
var array = [];
var generator = generate(array);
generator.yield(30, 2);
generator.yield(20, 1);
generator.yield(10, 0);
expect(array).toEqual([10, 20, 30]);
```

And just as array iterators are just one implementation of the iterator
interface, the generator interface could have many interfacets.
Generator objects foreshadow the existence of stream writers.


### Asynchronous Values

The asynchronous analogue of a getter is a promise.
Each promise has a corresponding resolver as its asynchronous setter.
Collectively the promise and resolver are a deferred value.

The salient method of a promise is `then`, which creates a new promise for the
result of a function that will eventually observe the value of the promise.
If a promise were plural, the `then` method might be called `map`.

```js
var promiseForThirty = promiseForTen.then(function (ten) {
    return ten + 20;
})
```

Promises can also have a `done` method that observes the value but does not
return a promise nor captures the result of the observer.
Again, if a promise were plural, the `done` method might be called `forEach`.

```js
promiseForTen.done(function (ten) {
});
```

The `then` method also supports a second function that would observe whether the
input promise radiates an exception, and there is a `catch` method to use as a
shorthand if you are only interested in catching errors.

```js
promise.then(onreturn, onthrow);
promise.catch(onthrow);
```

In keeping with the design of `forEach` and `map` in JavaScript, the `then` and
`catch` methods might also take a `thisp`, an object to use as `this` in the
observer functions.

```js
array.forEach(onyield, thisp);
promise.then(onreturn, onthrow, thisp);
```

A resolver is the singular analogue of a generator.
Rather than yielding, returning, and throwing errors, the resolver can only
return or throw.

```js
resolver.return(10);
resolver.throw(new Error("Sorry, please return during business hours."));
```

A deferred value can be deferred further by resolving it with another promise.
This can occur either expressly through the resolver, or implicitly by returning
a promise as the result of a observer function.

```js
var authenticated = getUsernameFromConsole()
.then(function (username) {
    return Promise.all([
       getUserFromDatabase(username),
       getPasswordFromConsole()
    ])
    .then(function ([user, password]) {
        if (hash(password) !== user.passwordHash) {
            throw new Error("Can't authenticate because the password is invalid");
        }
    })
})
```

The `then` method internally creates a new deferred, returns the promise, and
later forwards the return value of the observer to the resolver.

```js
var userPromise = getUserFromDatabase(username);
var userDeferred = new Deferred();
var resolver = userDeferred.resolver;
resolver.return(userPromise);
return userDeferred.promise;
```

With a promise, information flows only from the first call to a resolver method
to all promise observers, whether they are registered before or after the
resolution.

With a task, information flows from the first call to a resolver method to the
first call to an observer method, regardless of their relative order, but one
kind of information can flow upstream.
The observer may unsubscribe with an error.
This is conceptually similar to throwing an error back into a generator from an
iterator and warrants the same interface.

```js
task.throw(new Error("Never mind"));
```

This interface foreshadows its plural analogue: streams.


### Asynchronous Functions

Generator functions have existed in other languages, like Python, for quite some
time, so folks have made some clever uses of them.
We can combine promises and generator functions to emulate asynchronous
functions.
The key insight is a single, concise method that decorates a generator, creating
an internal "promise trampoline".
An asynchronous function returns a promise for the eventual return value, or the
eventual thrown error, of the generator function.
However, the function may yield promises to wait for intermediate values on its
way to completion.
The trampoline takes advantage of the ability of an iterator to send a value
from `next` to `yield`.

```js
var authenticated = Promise.async(function *() {
    var username = yield getUsernameFromConsole();
    var user = getUserFromDatabase(username);
    var password = getPasswordFromConsole();
    [user, password] = yield Promise.all([user, password]);
    if (hash(password) !== user.passwordHash) {
        throw new Error("Can't authenticate because the password is invalid");
    }
})
```

Mark Miller’s [implementation][Async] of the `async` decorator is succinct and
insightful.
We produce a wrapped function that will create a promise generator and proceed
immediately.
Each requested iteration has three possible outcomes: yield, return, or throw.
Yield waits for the given promise and resumes the generator with the eventual
value.
Return stops the trampoline and returns the value, all the way out to the
promise returned by the async function.
If you yield a promise that eventually throws an error, the async function
resumes the gnerator with that error, giving it a chance to recover.

[Async]: http://wiki.ecmascript.org/doku.php?id=strawman:async_functions#reference_implementation

```js
Promise.async = function async(generate) {
    return function () {
        function resume(verb, argument) {
            var result;
            try {
                result = generator[verb](argument);
            } catch (exception) {
                return Promise.throw(exception);
            }
            if (result.done) {
                return result.value;
            } else {
                return Promise.return(result.value).then(donext, dothrow);
            }
        }
        var generator = generate.apply(this, arguments);
        var donext = resume.bind(this, "next");
        var dothrow = resume.bind(this, "throw");
        return donext();
    };
}
```

As much as JavaScript legitimizes the async promise generators by supporting
returning and throwing, now that Promises are part of the standard, the powers
that sit on the ECMAScript standards committee are contemplating special `async`
and `await` syntax for this case.
The syntax is inspired by the same feature of C#.

```js
var authenticate = async function () {
    var username = await getUsernameFromConsole();
    var user = getUserFromDatabase(username);
    var password = getPasswordFromConsole();
    [user, password] = await Promise.all([user, password]);
    return hash(password) === user.passwordHash;
})
```

One compelling reason to support special syntax is that `await` may have higher
precedence than the `yield` keyword.

```js
async function addPromises(a, b) {
    return await a + await b;
}
```

By decoupling **async functions** from **generator functions**, JavaScript opens
the door for **async generator functions**, foreshadowing a **plural** and
**temporal** getter, a standard form for readable streams.


### Promise Queues

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

Interface     |         |        |          |
------------- | ------- | ------ | -------- |
PromiseQueue  | Value   | Plural | Temporal |
queue.get     | Getter  | Plural | Temporal |
queue.put     | Setter  | Plural | Temporal |

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


### Semaphores

Semaphores are flags or signs used for communication and were precursors to
telegraphs and traffic lights.
In programming, semaphores are usually used to synchronize programs that share
resources, where only one process can use a resource at one time.
For example, if a process has a pool of four database connections, it would use
a semaphore to manage that pool.

Typically, semaphores are used to block a thread or process from continuing
until a resource becomes available.
The process will "down" the semaphore whenever it enters a region where it needs
a resource, and will "up" the semaphore whenever it exits that region.
The terminology goes back to raising and lowering flags.
You can imagine your process as being a train and a semaphore as guarding the
entrace to a particular length of track.
Your process stops at the gate until the semaphore goes up.

Of course, in a reactive program, we don’t block.
Instead of blocking, we return promises and continue when a promise resolves.
We can use a promise as a non-blocking mutex for a single resource, and a
promise queue as a non-blocking semaphore for multiple resources.

In this example, we establish three database connections that are shared by a
function that can be called to do some work with the first available connection.
We get the resource, do our work, and regardless of whether we succeed or fail,
we put the resource back in the pool.

```js
var connections = new Queue();
connections.put(connectToDb());
connections.put(connectToDb());
connections.put(connectToDb());

function work() {
    return connections.get()
    .then(function (db) {
        return workWithDb(db)
        .finally(function () {
            connections.put(db);
        })
    });
}
```


### Promise Buffers

Consider another application.
You have a producer and a consumer, both doing work asynchronously, the producer
periodically sending a value to the consumer.
To ensure that the producer does not produce faster than the consumer can
consume, we put an object between them that regulates their flow rate, a buffer.
The buffer uses a promise queue to transport values from the producer to the
consumer, and another promise queue to communicate that the consumer is ready
for another value from the producer.
The following is a sketch to that effect.

```js
var outbound = new PromiseQueue();
var inbound = new PromiseQueue();
var buffer = {
    iterator: {
        next: function (value, index) {
            outbound.put({
                value: value,
                index: index,
                done: false
            });
            return inbound.get();
        },
        throw: function (error) {
            outbound.put(Promise.throw(error));
            return inbound.get();
        }
    },
    generator: {
        yield: function (value, index) {
            inbound.put({
                value: value,
                index: index,
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

Stream            |         |          |              |
----------------- | ------- | -------- | ------------ |
Promise Buffer    | Value   | Plural   | Temporal     |
Promise Iterator  | Getter  | Plural   | Temporal     |
Promise Generator | Setter  | Plural   | Temporal     |

A buffer has a reader and writer, but there are implementations of reader and
writer that interface with the outside world, mostly files and sockets.

Note that `next` and `yield` are duals.
I previously proposed an extension to iterators that would allow an iteration to
carry the `index` for each `value` from an array or similar source.
I also proposed that a generator object would implement `yield(value, index)`
such that it could produce such indexes with an optional second argument.
Since `next` is the dual of `yield`, it would be able to send an `index` back to
the producer.


### Promise Iterators

One very important PromiseIterator lift a spatial iterator into the temporal
dimension so it can be consumed on demand over time.
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
    return Promise.resolve(this.iterator.next());
};
```

The conversion may seem superfluous at first.
However, consider that a synchronous iterator might, apart from implementing
`next()`, also implement methods analogous methods to `Array`, like `forEach`,
`map`, `filter`, and `reduce`.
Likewise, an asynchronous iterator might provide analogues to these functions
lifted into the asynchronous realm.

#### map

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

#### forEach

Synchronous `forEach` does not produce an output collection or iterator.
However, it does return `undefined` *when it is done*.
Of course synchronous functions are implicitly completed when they return,
but asynchronous functions are done when the asynchronous value they return
settles.

Asynchronous `forEach` would return a task.
Since streams are **unicast**, it stands to reason that the asynchonous result
of `forEach` on a stream would be able to propagate a cancellation upstream,
stopping the flow of data from the producer side.
Of course, the task can be easily forked or coerced into a promise if it needs
to be shared freely among multiple consumers.

```js
var task = reader.forEach(function (n) {
    // ...
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

#### reduce

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

#### pipe

An asynchronous iterator would have additional methods like `copy` or `pipe`
that would send iterations from this reader to another writer.
It would have `buffer` which would construct a buffer with some capacity.
The buffer would try to always have a value on hand for its consumer by
prefetching values from its producer.
If the producer is faster than the consumer, this can help avoid round trip
latency when the consumer needs a value from the producer.

#### read

Just as it is useful to transform a synchronous collection into an iterator and
an iterator into a reader, it is also useful to go the other way.
An asynchronous iterator would also have methods that would return a promise for
a collection of all the values from the source, for example `all`, or in the
case of readers that iterate collections of bytes or characters, `join` or
`read`.


#### Remote iterators

Consider also that a reader may be a proxy for a remote reader.
A promise iterator be easily backed by a promise for a remote object.

```js
function RemotePromiseIterator(promise) {
    this.remoteIteratorPromise = promise.invoke("iterate");
}
RemotePromiseIterator.prototype.next = function (value, index) {
    return this.remoteIteratorPromise.invoke("next");
};

var remoteReader = remoteFilesystem.invoke("open", "primes.txt");
var reader = new RemotePromiseIterator(remoteReader);
reader.forEach(console.log);
```

Apart from `then` and `done`, promises provide methods like `get`, `call`, and
`invoke` to allow promises to be created from promises and for messages to be
pipelined to remote objects.
An `iterate` method should be a part of that protocol to allow values to be
streamed on demand over any message channel.


### Promise Generators

A promise generator is analogous in all ways to a plain generator.
Promise generators implement `yield`, `return`, and `throw`.
The return and throw methods both terminate the stream.
Yield accepts a value and an index.
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
function fibStream(a, b, index) {
    return buffer.in.yield(a)
    .then(function () {
        return fibStream(b, a + b, index + 1);
    });
}
fibStream(1, 1, 0).done();
return buffer.out;
```

If the consumer would like to terminate the producer prematurely, it calls the
`throw` method on the corresponding promise iterator.
This will eventually propagate back to the promise returned by the generator’s
`yield`, `return`, or `throw`.

```js
buffer.out.throw(new Error("That's enough, thanks"));
```


### Promise Generator Functions

Jafar Husain recently [asked the ECMAScript committee][JH], whether generator
functions and async functions were composable, and if so, how they should
compose.
One of the key questions was whether an async generator should return a promise
for an iterator or an iterator that produces promises.
We draw many of the same conclusions.
In the context of this framework, the answer is clear.

[JH]: https://docs.google.com/file/d/0B4PVbLpUIdzoMDR5dWstRllXblU

An asynchronous generator function uses both `await` and `yield`.
The `await` term allows the function to idle until some asynchronous work has
settled, and the `yield` allows the function to produce a value.
An asynchronous generator returns a promise iterator, the output side of a
stream.

Recall that an iterator returns an iteration, but a promise iterator returns a
promise for an iteration, and also a promise generator returns a similar promise
for the acknowledgement from the iterator.

```js
promiseIterator.next()
.then(function (iteration) {
    console.log(iteration.value, "at", iteration.index);
    if (iteration.done) {
        console.log("fin");
    }
});

promiseGenerator.yield("alpha", 0)
.then(function (iteration) {
    console.log("iterator has consumed alpha at index 0");
});
```

This example will fetch quotes from the works of Shakespeare, retrieve quotes
from each work, and push those quotes out to the consumer.
Note that the `yield` expression returns a promise for the value to flush, so
awaiting on that promise allows the generator to pause until the consumer
catches up.

```js
async function *shakespeare(titles) {
    for (title of titles) {
        var quotes = await getQuotes(title);
        for (quote of quotes) {
            await yield quote;
        }
    }
}

var reader = shakespeare(["Hamlet", "Macbeth", "Othello"]);
reader.reduce(function (length, quote) {
    return length + quote.length;
}, 0, null, 100)
.then(function (totalLength) {
    console.log(totalLength);
});
```

It may be valuable for a yield to implicitly await on both the value it takes in
and the promise it evaluates to.


### Observables

There is more than one way to solve the problem of over-commitment,
over-scheduling, or excessive concurrency.
Streams have a very specific contract that makes pressurization necessary.
Specifically, a stream is intended to transport the entirety of a collection and
strongly resembles a spatial collection that has been rotated 90 degrees into a
temporal collection.
However, there are other contracts that lead us to very different strategies to
avoid over-commitment and they depend entirely on the meaning of the data in
transit.
The appropriate transport is domain specific.

Consider a sensor, like a thermometer or thermocouple.
At any given time, the subject will have a particular temperature.
The temperature may change continuously in response to events that are not
systematically observable.
Suppose that you poll the thermocouple at one second intervals and place that on
some plural, asynchronous setter.
Suppose that this ultimately gets consumed by a visualization that polls the
corresponding plural, asynchronous getter sixty times per second.
The visualization is only interested in the most recently sampled value from the
sensor.

Consider a variable like the position of a scrollbar.
The value is discrete.
It does not change continuously.
Rather, it changes only in response to an observable event.
Each time one of these scroll events occurs, we place the position on the
setter side of some temporal collection.
Any number of consumers can subscribe to the getter side and it will push a
notification their way.

Both of these cases are distinct from streams and have interesting relationships
with each other.
With the temperature sensor, changes are continuous, whereas with the scroll
position observer, the changes are discrete.
With the temperature sensor, we sample the data at a much lower frequency than
the display, in which case it is sufficient to remember the last sensed
temperature and redisplay it.
If we were to sample the data at a higher frequency than the display, it would
be sufficient for the transport to forget old values each time it receives a new
one.
Also, unlike a stream, these cases are both well adapted for many producer and
many consumer scenarios.

Also unlike streams, one of these concepts pushes data and the other polls or
pulls data.
A stream has pressure, which is a kind of combined pushing and pulling.
Data is pulled toward the consumer by a vacuum.
Producers are pushed back by pressure when the vacuum is filled, thus the term:
back-pressure.

The discrete event pusher is a Signal.
The continuous, pollable is a variable.


Interface          |               |      |
------------------ | --------------| ---- |
Signal Observable  | Get           | Push |
Signal Generator   | Set           | Push |
Signal             | Value         | Push |
Variable Iterator  | Get           | Poll |
Variable Generator | Set           | Poll |
Variable           | Value         | Poll |


-   TODO make sure this is a summary of the topics in the end

Yet even variables have variations like probes, gauges, counters,
flow gauges, accumulators, flushable accumulators, and rotating counters.


### Signals

A signal represents a value that changes over time.
The signal is asynchronous and plural, like a stream.
Unlike a stream, a signal can have plural producers and consumers.

A signal has a getter side and a setter side.
The asynchronous getter for a signal is an observable instead of a reader.
Unlike a readable stream, you do not use `next()` to pull or poll an
asynchronous value from the observable.
The observable implements `forEach`, which subscribes an observer to receive
push notifications whenever the signal value changes.

```js
signal.iterator.forEach(function (value, time, signal) {
    console.log(value);
})
```

The signal generator is the asynchronous setter.
Like a stream writer, it implements `yield`.
However, unlike a stream writer, `yield` does not return a promise.

```js
signal.generator.yield(10);
```

Signals do not support pressure.
Just as `yield` does not return a promise, the callback you give to `forEach`
does not accept a promise.
A signal can only push.
The consumer (or consumers) cannot push back.

Just as streams relate to buffers, not every observable must be paired with a
signal generator.
A noteworth example of an external observable is a clock.
A clock emits a signal with the current time at a regular period and offset.

```js
var tick = new Clock(1000);
var tock = new Clock(1000, 500);
tick.forEach(function (time) {
    console.log("tick", time);
})
tock.forEach(function (tock) {
    console.log("tock", time);
});
```

-   TODO strobe signal

Signals may correspond to system or platform signals like keyboard or mouse
input or other external sensors.
Furthermore, a signal generator might dispatch a system level signal to another
process, for example SIGHUP, which typically asks a daemon to reload its
configuration.

```js
daemon.signals.yield("SIGHUP");
```

-   TODO illustrate producing estimated time to completion signal for `all`,
    `join`, or `read` on a reader.
-   TODO signal forEach, map, filter, reduce
-   TODO signal to pulse
-   TODO signal counter
-   TODO signal reservoir sampling
-   TODO signal operator lifting


### Variables or Behaviors

In the simplest case, a variable is merely a mutable property of a scope.
However, a `Variable` with a captial `V` is an object that supports the
synchronous iterator and generator interfaces.
This is a sketch of a variable.

```js
var value = null;
var index = null;
var variable = {
    iterator: {
        next: function () {
            return {value: value, index: index, done: false};
        }
    },
    generator: {
        yield: function (_value, _index) {
            value = _value;
            index = _index;
        }
    }
};
```

The significance of a variable is that it can capture a signal, transforming a
push interface into a pull interface.
Whatever the signal last emitted is the value that will be subsequently polled
or forgotten.
The variable allows the sample rate of a producer to differ from the sample rate
of a consumer.
It is also straight-forward to convert a variable back to a signal at an
arbitrary interval.

```js
input.forEach(variable.yield, variable);
var output = new Signal();
var clock = new Clock(100); // 10Hz
clock.forEach(function () {
    var iteration = variable.next();
    output.generator.yield(iteration.value, iteration.index);
});
return output.iterator;
```


### Probes

A probe is a synchronous plural getter.
On one hand, probes are a special case of an iterator, but like a variable,
represent a time series of an underlying value.
The probe constructor lifts a simple callback.
The callback must return the next value in the series.

Consider this sketch of the `map` method of a `Variable`.
The map method of a variable produces a probe that will transform the current
value of the underlying variable on demand.

```js
Variable.prototype.map = function (callback, thisp) {
    return new Probe(function (index) {
        var iteration = this.next(null, index);
        return callback.call(thisp, iteration.value, iteration.index, this);
    }, this);
};
```

Suppose you have a promise.
Promises may provide a signal for their estimated time to completion.
Whenever the ETC changes, you receive the new time.
The user interface, however, requires a progress variable it can poll for each
animation frame.
We can channel the estimated time completion signal into a last-known estimated
time to completion variable, and then use a probe to transform the ETC into a
progress estimate.

```js
var start = Date.now();
return promise.observeEstimate()
.variable()
.map(function (estimate) {
    var now = Date.now();
    return (now - start) / (estimate - start);
});
```

-   TODO explain operators in a lift

Consider lifting an operator to a variable operator.
`Variable.lift(add)` will take the `add(x:number, y:number): number` operator
and return a `add(x:Variable&lt;number&gt;, y:Variable&lt;number&gt;):Variable&lt;number&gt;`
variable operator.

```js
Variable.lift = function (operator, thisp) {
    return function variableOperator() {
        var operandVariables = Array.prototype.slice.call(arguments);
        return new Probe(function (time) {
            var operands = operandVariables.map(function (operandVariable) {
                return operandVariable.next().value;
            });
            return new Iteration(operator.apply(thisp, operands), time);
        });
    };
};

Variable.add = Variable.lift(Operators.add);

Variable.prototype.add = function (that) {
    return Variable.add(this, that);
};
```


### Derrivative Signals

Suppose that your kernel tracks the total number of transmitted bytes by every
interface in a four byte unsigned integer, but owing to the limited size of the
variable and the amount of traffic that this network sees, the integer
periodically overflows.
The measurement is not useful for tracking the total number of bytes sent
because the integer is always relative to the last time it overflowed, but as
long as you consistently poll the integer more frequently than it overflows, it
is still useful for monitoring the rate of flow.

So you set up a clock to emit a signal once a second.
Each time you receive this signal, you probe the kernel for its transmitted
bytes figure.

```js
var clock = new Clock(1000);
var tx = clock.map(function (time) {
    return getTrasmittedBytes("eth0");
})
```


-   TODO


```js
Signal.prototype.dt = function () {
    var previousValue;
    var previousTime;
    var signal = new Signal();
    this.forEach(function (value, time) {
        if (previousTime) {
            signal.generator.yield(
                (value - previousValue) /
                (time - previousTime),
                time
            );
        }
        previousTime = time;
        previousValue = value;
    });
    return signal.iterator;
}
```

-   TODO

```js
var positionSignal = observePosition();
var velocitySignal = positionSignal.dt();
var accelerationSignal = velocitySignal.dt();
var jerkSignal = accelerationSignal.dt();
var snapSignal = jerkSignal.dt();
var crackleSignal = snapSignal.dt();
var popSignal = crackleSignal.dt();
```

-   TODO

```js
Reader.prototype.tap = function (generator) {
    return this.map(function (value, time) {
        generator.yield(value, time);
        return value;
    });
};
```

```js
var chunkSignal = new Signal();
var contentPromise = stream.tap(chunkSignal.generator).read();
var estimateSignal = contentPromise.observeEstimate();
var start = Date.now();
var progressVariable = estimateSignal.variable().map(function (estimate) {
    return (now - start) / (estimate - start);
});
var chunkVelocitySignal = chunkSignal.map(function (chunk) {
    return chunk.length;
}).dt();
```

### Gauges

-   TODO ellaborate

### Counters

-   TODO ellaborate

### Flow Gauges

-   TODO ellaborate

### Accumulators

-   TODO ellaborate

### Flushable Accumulators

-   TODO ellaborate

### Rotating Counters

-   TODO ellaborate

### Signals, Variables, and Streams

Variables and signals can be channeled into a writable stream.
Particularly if you do not want to miss any values produced by a signal, you can
send the signal output directly into a buffer’s input.

```js
var buffer = new Buffer();
signal.iterator.forEach(buffer.generator.yield, buffer.generator);
return buffer.iterator.forEach(process);
```

However, note that when the `process` is slower than the signal, the buffer will
flood, and when the signal is slower than the processor, the buffer will drain.
For this case, it might be prudent to use a monitor to watch the size of the
buffer.
This is a sketch of a monitor method for a signal that would provide both a
readable stream and a signal that will keep us appraised of the buffer size.

```js
SignalIterator.prototype.monitor = function () {
    var buffer = new Buffer();
    var signal = new Signal();
    var length = 0;
    this.forEach(function (value, index) {
        buffer.generator.yield(value, index);
        signal.generator.yield(++length);
    });
    return {
        iterator: {
            next: function () {
                signal.yield(--length);
                return buffer.next();
            }
        },
        monitor: signal.iterator
    }
};
```

Recall that we can promote any iterable to a readable stream.
We earlier implied that this would be useful for performing asynchronous work on
each value from an array or collection, maybe even the output of an indefinite
iterator or generator.
A variable iterator is also a suitable input for a reader

```js
return new Reader(variable.iterator).forEach(process);
```

However, the variable produces an infinite series of values and depending on how
frequently the variable gets updated and how frequently a process may be
completed, the processor may receive many duplicate values.
To avoid duplicates, it may be better to channel the variable into a high
frequency signal that filters duplicates.
Consider a `uniq` method on a signal.

```js
SignalIterator.prototype.uniq = function (equals) {
    var output = new Signal();
    var previous;
    this.forEach(function (value, time) {
        if (!equals(previous, value)) {
            output.generator.yield(value, time);
            previous = value;
        }
    });
    return output.iterator;
};
```

Unix systems reserve the term `uniq` for sequences that do not have adjacent
duplicates, but are not universally unique.
The common idiom is to implement a fully `unique` method by sorting a stream and
then passing it through a `uniq` filter.

Likewise, we can create a signal from the output of a stream.

```js
var signal = new Signal();
reader.forEach(signal.yield, signal);
```

However, the signal will create an eternal vaccum at the end of the stream,
drawing values out of the stream as quickly as the stream can produce them.
The benefit of converting a stream to a signal is that with a signal, multiple
consumers can listen to every value that comes out of the stream.
If multiple consumers draw data from a readable stream using `forEach` directly,
each value produced by the stream will only be seen by one of the consumers.
Signals and variables are broadcast.
Streams are unicast.


### Publishers and Subscribers

The difference between a signal and a subscription is that a subscription can be
canceled.
If a subscription is canceled, the publisher does not need to send messages.
We note that signals are similar to streams but do not use promises.
This means that return values from signal methods and in signal callbacks are
unused.
These unused return values are useful for making cancellation composable.

Interface          |               |      |            |
------------------ | --------------| ---- | ---------- |
Subscriber         | Get           | Push | Cancelable |
Publisher          | Set           | Push | Cancelable |
Channel            | Value         | Push |            |
Signal Observable  | Get           | Push |            |
Signal Generator   | Set           | Push |            |
Signal             | Value         | Push |            |

-   TODO signals, cancellation, and multiple subscribers. The void of return
    values leaves open the possibility of chained signals and automatic
    cancellation.
-   TODO making cancellation composite
-   TODO creating streams from publisher subscriber
-   TODO consume a signal and produce a reservoir sample variable


## Cases

### Progress and estimated time to completion

For example, imagine you are copying the values from a stream into an array.
You know how long the array will be and when you started reading.
Knowing these variables and assuming that the rate of flow is steady, you can
infer the amount of **progress** that has been made up to the current time.
This is a simple matter of dividing the number of values you have so far
received, by the total number of values you expect to receive.

```js
var progress = index / length;
```

This is a discrete measurement that you can push each time you receive another
value.
It is discrete because it does not change between events.

You can also infer the average **throughput** of the stream, also a discrete
time series.

```js
var elapsed = now - start;
var throughput = index / elapsed;
```

From progress you can divine an **estimated time of completion**.
This will be the time you started plus the time you expect the whole stream to
take.

```js
var stop = start + elapsed / progress;
var stop = start + elapsed / (index / length);
var stop = start + elapsed * length / index;
```

We could update a progress bar whenever we receive a new value, but frequently
we would want to display a smooth animation continuously changing.
Ideally, progress would proceed linearly from 0 at the start time to 1 at the
stop time.
You could sample progress at any moment in time and receive a different value.
Values that lack an inherent resolution are *continuous*.
It becomes the responsibility of the consumer to determine when to sample,
**pull** or **poll** the value.

For the purposes of a smooth animation of a continuous variable, the frame rate
is a sensible polling frequency.
We can infer a continous progress time series from the last known estimated time
of completion.

```js
var progress = (now - start) / (estimate - start);
```


### Further cases

-   promises
-   streams
-   observables
-   variables
    -   probes
    -   accumulators
    -   floods

-   promises to observables
-   observables to promise streams
-   observables to variables
-   variables to observables

-   heavy lifting
    -   Value => Promise<Value>
    -   Iterator<Value> => PromiseStream<Value>
    -   Value => Variable<Value>
    -   (...Value) -> Value => (...Variable<Value>) -> Variable<Value>
    -   (...Value) -> Value => (...Signal<Value>) -> Signal<Value>
    -   (...Value) -> Value => (...Promise<Value>) -> Promise<Value>

-   function *() {}
-   async function () {}
-   async function *() {}


-   a clock user interface
-   measuring the rate of flow for a periodically overflowing counter
-   creating derivative measurements
-   sampling data
-   type ahead suggestions
-   distributed search
-   distributed sort (quick sort, insertion sort, merge sort)
-   infinite scroll
-   indefinite scroll
-   definite but long scroll

-   TODO

## Glossary

-   accumulator
-   array
-   asynchronous
-   await
-   behavior
-   blocking
-   broadcast
-   buffer
-   cancelable
-   continuous
-   control
-   counter
-   deferred
-   discrete
-   flow gauge
-   future
-   gauge
-   getter
-   getter getter
-   iterable
-   iterator
-   multiple
-   non-blocking
-   observable
-   observer
-   operation
-   poll
-   pressure
-   probe
-   promise
-   publisher
-   pull
-   pulse
-   push
-   readable
-   result
-   retriable
-   sensor
-   setter
-   setter setter
-   signal
-   single
-   sink
-   spatial
-   stream
-   strobe
-   subscriber
-   synchronous
-   task
-   temporal
-   throttle
-   unicast
-   value
-   writable
-   yield

-   TODO consider Behavior for Variable name
-   TODO Nit: Node.js Event Emitter isn't an event emitter
-   TODO draw attention to RRD tool http://oss.oetiker.ch/rrdtool/
-   TODO retry with promises and iterators
-   TODO hot vs cold https://github.com/Reactive-Extensions/RxJS/blob/master/doc/gettingstarted/creating.md#cold-vs-hot-observables
-   TODO dispose vs cancel
-   TODO http://conal.net/ Conal Elliott
-   TODO promise status labels on the then method, then(onreturn?, onthrow?,
    thisp?, label?, ms?)
-   TODO stream operator lifting
-   TODO stream forking

