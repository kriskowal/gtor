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
