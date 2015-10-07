
# Observables

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


| Interface          |               |      |
| ------------------ | --------------| ---- |
| Signal Observable  | Get           | Push |
| Signal Generator   | Set           | Push |
| Signal             | Value         | Push |
| Behavior Iterator  | Get           | Poll |
| Behavior Generator | Set           | Poll |
| Behavior           | Value         | Poll |


-   TODO make sure this is a summary of the topics in the end:

Yet even behaviors have variations like probes, gauges, counters,
flow gauges, accumulators, flushable accumulators, and rotating counters.

