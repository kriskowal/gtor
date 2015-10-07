
# Conclusion

Reactive primitives can be categorized in multiple dimensions.
The interfaces of analogous non-reactive constructs including getters, setters,
and generators are insightful in the design of their asynchronous counterparts.
Identifying whether a primitive is singular or plural also greatly informs the
design.

We can use pressure to deal with resource contention while guaranteeing
consistency.
We can alternately use push or poll strategies to skip irrelevant states for
either continuous or discrete time series data with behaviors or signals.

There is a tension between cancelability and robustness, but we have primitives
that are useful for both cases.
Streams and tasks are inherently cooperative, cancelable, and allow
bidirectional information flow.
Promises guarantee that consumers and producers cannot interfere.

All of these concepts are related and their implementations benefit from mutual
availability.
Promises and tasks are great for single result data, but can provide a
convenient channel for plural signals and behaviors.

Bringing all of these reactive concepts into a single framework gives us an
opportunity to tell a coherent story about reactive programming, promotes a
better understanding about what tool is right for the job, and obviates the
debate over whether any single primitive is a silver bullet.

