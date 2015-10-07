# Generators

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

