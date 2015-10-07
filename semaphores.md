
# Semaphores

Semaphores are flags or signs used for communication and were precursors to
telegraphs and traffic lights.
In programming, semaphores are usually used to synchronize programs that share
resources, where only one process can use a resource at one time.
For example, if a process has a pool of four database connections, it would use
a semaphore to manage that pool.

Typically, semaphores are used to block a thread or process from continuing
until a resource becomes available.
The process will "down" the semaphore whenever it enters a region where it needs
a resource, and will "up" the semaphore whenever it exits that region.
The terminology goes back to raising and lowering flags.
You can imagine your process as being a train and a semaphore as guarding the
entrance to a particular length of track.
Your process stops at the gate until the semaphore goes up.

Of course, in a reactive program, we don’t block.
Instead of blocking, we return promises and continue when a promise resolves.
We can use a promise as a non-blocking mutex for a single resource, and a
promise queue as a non-blocking semaphore for multiple resources.

In this example, we establish three database connections that are shared by a
function that can be called to do some work with the first available connection.
We get the resource, do our work, and regardless of whether we succeed or fail,
we put the resource back in the pool.

```js
var connections = new Queue();
connections.put(connectToDb());
connections.put(connectToDb());
connections.put(connectToDb());

function work() {
    return connections.get()
    .then(function (db) {
        return workWithDb(db)
        .finally(function () {
            connections.put(db);
        })
    });
}
```

