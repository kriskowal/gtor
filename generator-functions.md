# Generator Functions

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

