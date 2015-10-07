
# Remote iterators

Consider also that a reader may be a proxy for a remote reader.
A promise iterator be easily backed by a promise for a remote object.

```js
function RemotePromiseIterator(promise) {
    this.remoteIteratorPromise = promise.invoke("iterate");
}
RemotePromiseIterator.prototype.next = function (value) {
    return this.remoteIteratorPromise.invoke("next");
};

var remoteReader = remoteFilesystem.invoke("open", "primes.txt");
var reader = new RemotePromiseIterator(remoteReader);
reader.forEach(console.log);
```

Apart from `then` and `done`, promises provide methods like `get`, `call`, and
`invoke` to allow promises to be created from promises and for messages to be
pipelined to remote objects.
An `iterate` method should be a part of that protocol to allow values to be
streamed on demand over any message channel.

