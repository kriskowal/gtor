
# A General Theory of Reactivity

*A work in progress.*

In the context of a computer program, reactivity is the process of receiving
external stimuli and propagating events.
This is a rather broad definition that covers a wide variety of topics.
The term is usually reserved for systems that respond in turns to sensors,
schedules, and above all, problems that exist between the chair and keyboard.

The field of reactivity is carved into plots ranging from "reactive programming"
to the subtly distinct "*functional* reactive programming", with acrage set
aside for "self adjusting computation" and with neighbors like "bindings" and
"operational transforms".
Adherents favor everything from "continuation passing style" to "promises", or
the related concepts of "deferreds" and "futures".
Other problems lend themselves to "observables", "signals", or "behaviors", and
everyone agrees that "streams" are a good idea, but "publishers" and
"subscribers" are distinct.

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
Rather, Rx conflates all reactive primitives into a single Observable type that
can perform any role.
Just as an array is an exemplar of an entire taxonomy of collections, promises,
streams, and observables are merely representatives of their class of reactive
primitives.
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
Stream     | Value         | Plural   | Temporal |
Reader     | Getter        | Plural   | Temporal |
Writer     | Setter        | Plural   | Temporal |


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


### Plural and temporal

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


## Primitives

Let us consider each primitive in detail.
Since the temporal primitives have spatial analogies, and since some of these
spatial primitives are relatively new to JavaScript, we will review these first.


### Iterators

An iterator is an object that allows us to lazily but synchronously consume
multiple values.
Iterators are not new to JavaScript, but there is a new standard forming at time
of writing.

Iterators implement a `next()` method that returns an object that may have a
`value` property, and may have a `done` property.
Although the standard does not give this object a name, we will call it an
**iteration**.
If the iterator has produced the entirety of a sequence, the `done` property of
the iteration will be `true`.
Generator functions return iterators that expand on this basic definition.
The `value` of a non-final iteration corresponds to a `yield` expression and the
`value` of a `done` iteration corresponds to a `return` expression.

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

What distinguishes an iterator from an array is that it is **lazy**.
An iterator does not necessarily end.
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
and will never produce a `done` iteration.
Unlike an array, an indefinite iterator consumes no more memory than an empty
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
As a trivial example, consider a generator that echoes whatever the consumer
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

We must prime the generator because it does not begin with a `yield`.
We advance the state machine to the first `yield` and allow it to produce the
initial, undefined message.
We then populate the message variable with a value, receiving its former
undefined content again.
Then we begin to see the fruit of our labor as the values we previously sent
backward come forward again.
This foreshadows the ability of stream readers to push back on stream writers.

Additionally, the iterator gains a `throw` method that allows the iterator to
terminate the generator by causing the `yield` expression to raise the given
error.
The error will unravel the stack inside the generator.
If the error unravels a try-catch-finally block, the catch block may handle the
error, leaving the generator in a resumable state if the returned iteration is
not `done`.
If the error unravels all the way out of the generator, it will pass into the
stack of the `throw` caller.

The iterator also gains a `return` method that causes the generator to resume as
if from a `return` statement, regardless of whether it actually paused at a
`yield` expression.
Like a thrown error, this unravels the stack, executing finally blocks, but not
catch blocks.

As such, like `next`, the `throw` and `return` methods may either return an
iteration, done or not, or throw an error.
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
if an array iterator consumes an array, an array generator would lazily produce
one.
An array generator object would implement `yield` as a method with behavior
analogous to the same keyword within a generator function.
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
used for property names, making this parallel between keywords and methods
possible.
A generator might also implement `return` and `throw` methods, but a meaningful
implementation for an array generator is a stretch of the imagination.
Although an array generator is of dubious utility, it foreshadows the interface
of asynchronous generators, for which meaningful implementations of `return` and
`throw` methods are easier to obtain, and go on to inform a sensible design for
asynchronous generator functions.


### Asynchronous Values

The asynchronous analogue of a getter is a promise.
Each promise has a corresponding resolver as its asynchronous setter.
Collectively the promise and resolver are a deferred value.

The salient method of a promise is `then`, which creates a new promise for the
result of a function that will eventually observe the value of the promise.
If a promise were plural, the `then` method might be called `map`.
If you care to beg an esoteric distinction, it might be called `map` if the
observer returns a value and `flatMap` if the observer returns a promise.
The `then` method of a promise allows either.

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

At this point, the design described here begins to differ from the standard
`Promise` proposed for ECMAScript 6, arriving in browsers at time of writing.
The purpose of these differences is not to propose an alternative syntax, but to
reinforce the relationship between a promise and its conceptual neighbors.

A resolver is the singular analogue of a generator.
Rather than yielding, returning, and throwing errors, the resolver can only
return or throw.

```js
resolver.return(10);
resolver.throw(new Error("Sorry, please return during business hours."));
```

With the standard promise, a free `resolve` function is sufficient and ergonomic
for expressing both of these methods.
`resolver.return(promise)` is equivalent to `resolve(promise)`.
`resolver.return(10)` is equivalent to `resolve(10)` or
`resolve(Promise.resolve(10))`since non-promise values are automatically boxed
in an already-fulfilled promise.
`resolver.throw(error)` is equivalent to `resolve(Promise.reject(error))`.
In all positions, `resolve` is the temporal analogue of `return` and `reject` is
the temporal analogue of `throw`.
Since promises as we know them today bridged the migration gap from ECMAScript 3
to ECMAScript 6, it was also necessary to use non-keywords for method names.

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
This is a sketch of a `then` method that illustrates this adapter.
Note that we create a deferred, use the resolver, and return the promise.
The adapter is responsible for catching errors and giving the consumer an
opportunity to do further work or to recover.

```js
Promise.prototype.then = function Promise_then(onreturn, onthrow) {
    var self = this;
    var deferred = Promise.defer();
    var resolver = deferred.resolver;
    this.done(function (value) {
        if (onreturn) {
            try {
                resolver.return(onreturn(value));
            } catch (error) {
                resolver.throw(error);
            }
        } else {
            resolver.return(value);
        }
    }, function (error) {
        if (onthrow) {
            try {
                resolver.return(onthrow(value));
            } catch (error) {
                resolver.throw(error);
            }
        } else {
            resolver.throw(error);
        }
    });
    return deferred.promise;
```

The standard `Promise` does not reveal `Promise.defer()`.
Instead, it is hidden by `then` and by the `Promise` constructor, which elects
to hide the deferred object and the resolver object, instead "revealing" the
`resolve` and `reject` methods as free arguments to a setup function, furthering
the need to give these functions names that are not keywords.

```js
var promise = new Promise(function (resolve, reject) {
    // ...
});
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
resumes the generator with that error, giving it a chance to recover.

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

See the accompanying sketch of a [promise queue][] implementation.

[promise queue]: http://kriskowal.github.io/gtor/docs/promise-queue

A promise queue does not have a notion of termination, graceful or otherwise.
We will later use a pair of promise queues to transport iterations between
**streams**.


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
entrance to a particular length of track.
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

Stream            |         |          |              |
----------------- | ------- | -------- | ------------ |
Promise Buffer    | Value   | Plural   | Temporal     |
Promise Iterator  | Getter  | Plural   | Temporal     |
Promise Generator | Setter  | Plural   | Temporal     |

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


### Promise Iterators

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

```js
promiseIterator.map(function (value) {
    return Promise.return(value + 1000).delay(1000);
});
```

#### forEach

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
This method would be equivalent to using `forEach` to forward iterations and
`then` to terminate the sequence.

```js
iterator.copy(generator);
// is equivalent to:
iterator.forEach(generator.yield).then(generator.return, generator.throw);
```

Note that the promise returned by yield applies pressure on the `forEach`
machine, pushing ultimately back on the iterator.

#### buffer

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
RemotePromiseIterator.prototype.next = function (value) {
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


### Asynchronous Generator Functions

Jafar Husain recently [asked the ECMAScript committee][JH1], whether generator
functions and async functions were composable, and if so, how they should
compose. (His [proposal][JH2] continues to evolve.)

[JH1]: https://docs.google.com/file/d/0B7zweKma2uL1bDBpcXV4OWd2cnc
[JH2]: https://github.com/jhusain/asyncgenerator

One key question is what type an async generator function would return.
We look to precedent.
A generator function returns an iterator.
A asynchronous function returns a promise.
Should the asynchronous generator return a promise for an iterator, an iterator
for promises?

If ``Iterator<T>`` means that an iterator implements `next` such that it
produces ``Iteration<T>``, the `next` method of an ``Iterator<Promise<T>>``
would return an ``Iteration<Promise<T>>``, which is to say, iterations that
carry promises for values.

There is another possibility.
An asynchronous iterator might implement `next` such that it produces
``Promise<Iteration<T>>`` rather than ``Iteration<Promise<T>>``.
That is to say, a promise that would eventually produce an iteration containing
a value, rather than an iteration that contains a promise for a value.

This is, an iterator of promises, yielding ``Iteration<Promise<T>>``:

```js
var iteration = iterator.next();
iteration.value.then(function (value) {
    return callback.call(thisp, value);
});
```

This is a promise iterator, yielding ``Promise<Iteration<T>>``:

```js
promiseIterator.next()
.then(function (iteration) {
    return callback.call(thisp, iteration.value);
})
```

Promises capture asynchronous results.
That is, they capture both the value and error cases.
If `next` returns a promise, the error case would model abnormal termination of
a sequence.
Iterations capture the normal continuation or termination of a sequence.
If the value of an iteration were a promise, the error case would capture
inability to transport a single value but would not imply termination of the
sequence.

In the context of this framework, the answer is clear.
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
    console.log(iteration.value);
    if (iteration.done) {
        console.log("fin");
    }
});

promiseGenerator.yield("alpha")
.then(function (iteration) {
    console.log("iterator has consumed alpha");
});
```

The following example will fetch quotes from the works of Shakespeare, retrieve
quotes from each work, and push those quotes out to the consumer.
Note that the `yield` expression returns a promise for the value to flush, so
awaiting on that promise allows the generator to pause until the consumer
catches up.

```js
async function *shakespeare(titles) {
    for (let title of titles) {
        var quotes = await getQuotes(title);
        for (let quote of quotes) {
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

It is useful for `await` and `yield` to be completely orthogonal because there
are cases where one will want to yield but ignore pressure from the consumer,
forcing the iteration to buffer.

Jafar also proposes the existence of an `on` operator.
In the context of this framework, the `on` operator would be similar to the
ECMAScript 6 `of` operator, which accepts an iterable, produces an iterator, and
then walks the iterator.

```js
for (let a of [1, 2, 3]) {
    console.log(a);
}

// is equivalent to:

var anIterable = [1, 2, 3];
var anIterator = anIterable[Symbol.iterate]();
while (true) {
    let anIteration = anIterator.next();
    if (anIteration.done) {
        break;
    } else {
        var aValue = anIteration.value;
        console.log(aValue);
    }
}
```

The `on` operator would operate on an asynchronous iterable, producing an
asynchronous iterator, and await each promised iteration.
Look for the `await` in the following example.

```js
for (let a on anAsyncIterable) {
    console.log(a);
}

// is equivalent to:

var anAsyncIterator = anAsyncIterable[Symbol.iterate]();
while (true) {
    var anAsyncIteration = anAsyncIterator.next();
    var anIteration = await anAsyncIteration;
    if (anIteration.done) {
        break;
    } else {
        var aValue = anIteration.value;
        console.log(aValue);
    }
}
```

One point of interest is that the `on` operator would work for both asynchronous
and synchronous iterators and iterables, since `await` accepts both values and
promises.

Jafar proposes that the asynchronous analogues of `iterate()` would be
`observe(generator)`, from which it is trivial to derrive `forEach`, but I
propose that the asynchronous analogues of `iterate()` would just be
`iterate()` and differ only in the type of the returned iterator.
What Jafar proposes as the `asyncIterator.observe(asyncGenerator)` method is
effectively equivalent to synchronous `iterator.copy(generator)` or
`stream.pipe(stream)`.
In this framework, `copy` would be implemented in terms of `forEach`.

```js
Stream.prototype.copy = function (stream) {
    return this.forEach(stream.next).then(stream.return, stream.throw);
};
```

And, `forEach` would be implemented in terms of `next`, just as it would be
layered on a synchronous iterator.


### Observables

There is more than one way to solve the problem of processor contention or
process over-scheduling.
Streams have a very specific contract that makes pressurization necessary.
Specifically, a stream is intended to transport the entirety of a collection and
strongly resembles a spatial collection that has been rotated 90 degrees onto
the temporal axis.
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

However, if we infer a smooth animation from the discrete scroll positions and
their times, we can sample the scroll position *function* on each animation
frame.

These cases are distinct from streams and have interesting relationships with
each other.
With the temperature sensor, changes are **continuous**, whereas with the scroll
position observer, the changes are **discrete**.
With the temperature sensor, we sample the data at a much lower frequency than
the display, in which case it is sufficient to remember the last sensed
temperature and redisplay it.
If we were to sample the data at a higher frequency than the display, it would
be sufficient for the transport to forget old values each time it receives a new
one.
Also, unlike a stream, these cases are both well adapted for multiple-producer
and multiple-consumer scenarios.

Also unlike streams, one of these concepts pushes data and the other polls or
pulls data.
A stream has pressure, which is a kind of combined pushing and pulling.
Data is pulled toward the consumer by a vacuum.
Producers are pushed back by pressure when the vacuum is filled, thus the term:
back-pressure.

The discrete event pusher is a Signal.
The continuous, pollable is a Behavior.


Interface          |               |      |
------------------ | --------------| ---- |
Signal Observable  | Get           | Push |
Signal Generator   | Set           | Push |
Signal             | Value         | Push |
Behavior Iterator  | Get           | Poll |
Behavior Generator | Set           | Poll |
Behavior           | Value         | Poll |


-   TODO make sure this is a summary of the topics in the end:

Yet even behaviors have variations like probes, gauges, counters,
flow gauges, accumulators, flushable accumulators, and rotating counters.


### Observables and Signals

A **signal** represents a value that changes over time.
The signal is asynchronous and plural, like a stream.
Unlike a stream, a signal can have multiple producers and consumers.
The output side of a signal is an **observable**.

A signal has a getter side and a setter side.
The asynchronous getter for a signal is an observable instead of a reader.
The observable implements `forEach`, which subscribes an observer to receive
push notifications whenever the signal value changes.

```js
signal.out.forEach(function (value, time, signal) {
    console.log(value);
})
```

The signal generator is the asynchronous setter.
Like a stream writer, it implements `yield`.
However, unlike a stream writer, `yield` does not return a promise.

```js
signal.in.yield(10);
```

Signals do not support pressure.
Just as `yield` does not return a promise, the callback you give to `forEach`
does not accept a promise.
A signal can only push.
The consumer (or consumers) cannot push back.

Observables *also* implement `next`, which returns an iteration that captures
the most recently dispatched value.
This allows us to poll a signal as if it were a behavior.

See the accompanying sketch of a [observable][] implementation.

[observable]: http://kriskowal.github.io/gtor/docs/observable

Just as streams relate to buffers, not every observable must be paired with a
signal generator.
A noteworthy example of an external observable is a clock.
A clock emits a signal with the current time at a regular period and offset.

```js
var tick = new Clock({period: 1000});
var tock = new Clock({period: 1000, offset: 500});
tick.forEach(function (time) {
    console.log("tick", time);
})
tock.forEach(function (time) {
    console.log("tock", time);
});
```

See the accompanying sketch of a [clock][] implementation.

[clock]: http://kriskowal.github.io/gtor/docs/clock

Signals may correspond to system or platform signals like keyboard or mouse
input or other external sensors.
Furthermore, a signal generator might dispatch a system level signal to another
process, for example SIGHUP, which typically asks a daemon to reload its
configuration.

```js
daemon.signals.yield("SIGHUP");
```


### Behaviors

A behavior represents a time series value.
A behavior may produce a different value for every moment in time.
As such, they must be **polled** at an interval meaningful to the consumer,
since the behavior itself has no inherent resolution.

Behaviors are analogous to Observables, but there is no corresponding setter,
since it produces values on demand.
The behavior constructor accepts a function that returns the value for a given
time.
An asynchronous behavior returns promises instead of values.

See the accompanying sketch of a [behavior][] implementation.

[behavior]: http://kriskowal.github.io/gtor/docs/behavior


## Cases

### Progress and estimated time to completion

Imagine you are copying the values from a stream into an array.
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

For the purposes of a smooth animation of a continuous behavior, the frame rate
is a sensible polling frequency.
We can infer a continuous progress time series from the last known estimated time
of completion.

```js
var progress = (now - start) / (estimate - start);
```


## Summary

Reactive primitives can be categorized in multiple dimensions.
The interfaces of analogous non-reactive constructs including getters, setters,
and generators are insightful in the design of their asynchronous counterparts.
Identifying whether a primitive is singular or plural also greatly informs the
design.

We can use pressure to deal with resource contention while guaranteeing
consistency.
We can alternately use push or poll strategies to skip irrelevant states for
either continuous or discrete time series data with behaviors or signals.

There is a tension between cancelability and robustness, but we have primitives
that are useful for both cases.
Streams and tasks are inherently cooperative, cancelable, and allow
bidirectional information flow.
Promises guarantee that consumers and producers cannot interfere.

All of these concepts are related and their implementations benefit from mutual
availability.
Promises and tasks are great for single result data, but can provide a
convenient channel for plural signals and behaviors.

Bringing all of these reactive concepts into a single framework gives us an
opportunity to tell a coherent story about reactive programming, promotes a
better understanding about what tool is right for the job, and obviates the
debate over whether any single primitive is a silver bullet.


## Further Work

There are many more topics that warrant discussion and I will expand upon these
here.

Reservoir sampling can be modeled as a behavior that watches a stream or signal
and produces a representative sample on demand.

A clock user interface is a good study in the interplay between behaviors,
signals, time, and animation scheduling.

Drawing from my experience at FastSoft, we exposed variables from the kernel's
networking stack so we could monitor the bandwidth running through our TCP
acceleration appliance.
Some of those variables modeled the number of packets transmitted and the number
of bytes transmitted.
These counters would frequently overflow.
There are several interesting ways to architect a solution that would provide
historical data in multiple resolutions, accounting for the variable overflow,
involving a combination of streams, behaviors, and signals.
I should draw your attention to design aspects of RRDTool.

An advantage of having a unified framework for reactive primitives is to create
simple stories for passing one kind of primitive to another.
Promises can be coerced to tasks, tasks to promises.
A signal can be used as a behavior, and a behavior can be captured by a signal.
Signals can be channeled into streams, and streams can be channeled into
signals.

It is worth exploring in detail how operators can be lifted in each of these
value spaces.

Implementing distributed sort using streams is also a worthy exercise.

Asynchronous behaviors would benefit from an operator that solves the thundering
herd problem, the inverse of throttling.

How to implement type ahead suggestion is a great case to explore cancelable
streams and tasks.

I also need to discuss how these reactive concepts can propagate operational
transforms through queries, using both push and pull styles, and how this
relates to bindings, both synchronous and asynchronous.

I also need to compare and contrast publishers and subscribers to the related
concepts of signals and streams.
In short, publishers and subscribers are broadcast, unlike unicast streams,
but a single subscription could be modeled as a stream.
However, a subscriber can typically not push back on a publisher, so how
resource contention is alleviated is an open question.

Related to publishing and subscribing, streams can certainly be forked, in which
case both branches would put pressure back on the source.

Streams also have methods that return tasks.
All of these could propagate estimated time to completion.
Each of the cases for `all`, `any`, `race`, and `read` are worth exploring.

High performance buffers for bytewise data with the promise buffer interface
require further exploration.

Implementing a retry loop with promises and tasks is illustrative.

Reactive Extensions (Rx) beg a distinction between [hot and cold][] observables,
which is worth exploring.
The clock reference implementation shows one way to implement a signal that can
be active or inactive based on whether anyone is looking.

[hot and cold]: https://github.com/Reactive-Extensions/RxJS/blob/master/doc/gettingstarted/creating.md#cold-vs-hot-observables

The research into continuous behaviors and the original idea of Functional
Reactive Programming by [Conal Elliott][] deserves attention.

[Conal Elliott]: http://conal.net/

The interplay between promises and tasks with their underlying progress behavior
and estimated time to completion and status signals require further explanation.
These ideas need to be incorporated into the sketches of promise and task
implementations.

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

## Acknowledgements

I am grateful to Domenic Denicola, Ryan Paul, and Kevin Smith for reviewing and
providing feedback on various drafts of this article.

