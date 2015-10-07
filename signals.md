
# Observables and Signals

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

