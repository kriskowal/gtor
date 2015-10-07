
# Asynchronous Generator Functions

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

