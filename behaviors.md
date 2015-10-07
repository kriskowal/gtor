
# Behaviors

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

