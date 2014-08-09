
# Estimated Time to Completion

*Kris Kowal, published August 8, 2014.*

A promise is an object that represents a period of asynchronous work.
This is a simplified example of issuing an HTTP request in a browser, returning
a promise for the response when it has been received.

```js
function request(location) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open(GET, location, true);
        request.onload = request.load = function () {
            resolve(request);
        };
        request.onerror = request.error = reject;
        request.send();
    });
}
```

Between calling `request` and when the request calls `onload`, the HTTP request
may call another method, `onprogress`, multiple times as chunks of the response
body arrive asynchronously.
Although the promise represents the eventual result, the whole response, it can
also make these progress events observable.

Various promise implementations have loose support for progress
notifications.
Usually, you must call a `notify` function with an arbitrary progress value, and
the corresponding `progress` handler passed to the `then` method will receive
that value.

```js
function request(location) {
    var deferred = Promise.defer();
    var request = new XMLHttpRequest();
    request.open(GET, location, true);
    request.onload = request.load = function () {
        deferred.resolve(request.responseText);
    };
    request.onprogress = function () {
        var length = request.getResponseHeader("length");
        if (length !== null) {
            deferred.notify(request.response.length / length);
        }
    };
    request.onerror = request.error = deferred.reject;
    request.send();
    return deferred.promise;
}

request(url)
.then(function onFulfilled(response) {
}, function onRejected(error) {
}, function onProgressed(progress) {
    // <------------
})
```

The progress value is presumably a number in the interval from 0 to 1
representing how much progress has been made since the request was issued,
but the progress notification has been used to stream all manner of updates
including status messages.
Otherwise, the pattern is under-specified and conceptually flawed.
There is no meaningful way for the various operators that accept promises to
infer the progress of composite promises.


## Making progress

The next major version of Q will support an alternative to arbitrary progress
messages: estimated time to completion.
This feature is available for review in the [v2][] branch of Q but will likely
changed as the general theory of reactivity develops.

[v2]: https://github.com/kriskowal/q/tree/v2

An estimated time to completion is an *observable measurement*.
These measurements compose well based on a little knowledge of the work being
estimated.

In the most trivial case, one might have a promise for a result at an exact
time.
Such a promise can simply initialize its estimated time to completion.
The estimate will never change.

```js
function at(time) {
    return new Promise(function (resolve, reject, setEstimate) {
        setTimeout(function () {
            resolve();
        }, time - Date.now());
        setEstimate(time);
    });
}
```

## All

The Promise.all method accepts an array of promises and returns a promise for an
array with the respective values.
The estimated time to completion for the aggregate promise is, by definition,
the last of the individual estimates.
The resulting array will be available when all of the individual values are
available.
Whenever the estimate for one of these promises changes, the composite promise
should emit a new estimate.

[figure]

There are two ways to track incremental changes to the estimated time to
completion.
One is to use a heap data structure, a priority queue backed by a nearly
complete binary tree, using an array.
Such a data structure will always keep the last estimated time to completion on
top, requiring time proportional to the logarithm of the number of tracked
promises to update an estimate, `O(log n)`.

However, if instead one uses a simple array, they can find the last estimate
in time proportional to the number of input promises, `O(n)`.
Typically, these arrays are small, and this is sufficient.
But even if the array is very large, there are few cases where we need to
perform this linear search.
If an individual estimate changes, the change is only relevant if it applies to
the promise that once held the current aggregate estimate and it decreased.
If the individual promise exceeds the current estimate, it becomes the new
estimate.
In all other cases, the individual estimate changes have no affect on the
aggregate.
Typically, the probability that we will need to perform a linear search for the
new estimate is inversely proportional to the number of promises.  Thus, the
average time to update the aggregate estimate is amortized constant time,
`O(n / n)`.

I credit this epiphany to a conversation I had with Erik Bryn when we met after
Fluent 2014.

## Then

To be a useful measurement, the estimated time to completion must be composable
through the `then` method of a promise.
The then method takes an input promise, returns an output promise, and
in the relevant case, calls the fulfillment handler.
The estimated time to complete the output promise depends on the estimated time
to fulfill the input promise, plus the estimated duration of the fulfillment
handler.
Unfortunately, there are not many cases where we can divine a meaningful
estimate, but when we can, passing that duration as an argument to `then`
provides enough information to compose the output estimate.

For example, if the fulfillment handler is known to simply delay by one second,
we can pass that as an argument to `then`.

```js
return promise.then(function (value) {
    return Promise.return(value).delay(1000);
}, null, 1000)
```

In another case, the fulfillment handler might consistently require the same
amount of time, regardless of the inputs, in which case it is a simple matter of
measuring.
In other cases, we might need more sophisticated heuristics.

## Progress

One can derrive a “progress” value from the estimated time to completion, the
time that one began observing the promise, and the current time.

```
progress = (now - start) / (estimate - start)
```

However, the current time is always changing.
It is not useful for a producer to push a new measurement at an arbitrary
interval.
It is however useful for a consumer to pull (or poll) a new value on demand,
perhaps in tandem with the composition of animation frames.

If a task makes progress smoothly, the promise can produce its estimated time to
completion if it knows how much progress it has made until now from the time it
began working.

```
esimtate = start + progress * (now - start)
```

## Streams

The above formula is good for estimating the time until the termination of a
*stream* of known length.
At each time an object or chunk is produced or consumed, one can emit a new
estimated time to completion.

In the following example, we assume that `response` is an HTTP response with
`status`, `headers`, and `body`. The headers are normalized to lower-case key
names, and the body is a *promise stream*, in this case, of strings.

```js
function read(response) {
    var length = +response.headers["content-length"];
    var start = Date.now();
    var chunks = [];
    var chunksLength = 0;
    return new Promise(function (resolve, reject, setEstimate) {
        response.body
        .forEach(function (chunk) {
            chunks.push(chunk);
            chunksLength += chunk.length;
            var progress = chunksLength / length;
            var duration = Date.now() - start;
            setEstimate(start + progress * duration);
        })
        .then(function () {
            resolve(Buffer.concat(chunks));
        }, reject)
        .done();
    });
}
```

## Observing Estimates

A measurement that has a current value that can change over time is best modeled
as an *observable measurement*.
This is distinct from a promise itself which may not have a current result,
which may be a value or error, and can only resolve once.
It would be strange to use promise idioms to expose a promise’s own estimated
time to completion, just as it would be awkward to use an observable for the
result of an asynchronous function call.

For the experimental branch of Q, we can observe the estimate for a promise
using `observeEstimate`. The given callback will be informed of the current
estimate [as soon as possible][asap], and ASAP after each change.

[asap]: https://github.com/kriskowal/asap

```js
promise.observeEstimate(function (estimate) {
    component.estimate = estimate;
    component.needsDraw = true;
});
```

A pending promise can be informed of a new estimate using `setEstimate`.
As with all things promise, information flows only from the creator of the
promise to all its observers.
As such, the `setEstimate` method is the third argument of the `Promise`
initializer, and also exists on “deferred” objects.

```js
new Promise(function (resolve, reject, setEstimate) {
    setEstimate(Date.now() + 1000);
});
```

```js
var deferred = Promise.defer();
deferred.setEstimate(Date.now() + 1000);
return deferred.promise;
```

As consistent with most JavaScript interfaces, times are measured in miliseconds
since the Epoch.
An estimate of Infinity means that there is no meaningful estimate.
`observeEstimate` will always produce a number and defaults to Infinity.

The interface and behavior are subject to change as we shake-down this future
release of Q, and all [feedback][] is welcome for anyone willing to brave the
instability.

[feedback]: https://github.com/kriskowal/q

