# Asynchronous Values

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

