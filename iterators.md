
# Iterators

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

