
# Progress and estimated time to completion

Imagine you are copying the values from a stream into an array.
You know how long the array will be and when you started reading.
Knowing these variables and assuming that the rate of flow is steady, you can
infer the amount of **progress** that has been made up to the current time.
This is a simple matter of dividing the number of values you have so far
received, by the total number of values you expect to receive.

```js
var progress = index / length;
```

This is a discrete measurement that you can push each time you receive another
value.
It is discrete because it does not change between events.

You can also infer the average **throughput** of the stream, also a discrete
time series.

```js
var elapsed = now - start;
var throughput = index / elapsed;
```

From progress you can divine an **estimated time of completion**.
This will be the time you started plus the time you expect the whole stream to
take.

```js
var stop = start + elapsed / progress;
var stop = start + elapsed / (index / length);
var stop = start + elapsed * length / index;
```

We could update a progress bar whenever we receive a new value, but frequently
we would want to display a smooth animation continuously changing.
Ideally, progress would proceed linearly from 0 at the start time to 1 at the
stop time.
You could sample progress at any moment in time and receive a different value.
Values that lack an inherent resolution are *continuous*.
It becomes the responsibility of the consumer to determine when to sample,
**pull** or **poll** the value.

For the purposes of a smooth animation of a continuous behavior, the frame rate
is a sensible polling frequency.
We can infer a continuous progress time series from the last known estimated time
of completion.

```js
var progress = (now - start) / (estimate - start);
```

