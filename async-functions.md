
# Asynchronous Functions

Generator functions have existed in other languages, like Python, for quite some
time, so folks have made some clever uses of them.
We can combine promises and generator functions to emulate asynchronous
functions.
The key insight is a single, concise method that decorates a generator, creating
an internal "promise trampoline".
An asynchronous function returns a promise for the eventual return value, or the
eventual thrown error, of the generator function.
However, the function may yield promises to wait for intermediate values on its
way to completion.
The trampoline takes advantage of the ability of an iterator to send a value
from `next` to `yield`.

```js
var authenticated = Promise.async(function *() {
    var username = yield getUsernameFromConsole();
    var user = getUserFromDatabase(username);
    var password = getPasswordFromConsole();
    [user, password] = yield Promise.all([user, password]);
    if (hash(password) !== user.passwordHash) {
        throw new Error("Can't authenticate because the password is invalid");
    }
})
```

Mark Miller’s [implementation][Async] of the `async` decorator is succinct and
insightful.
We produce a wrapped function that will create a promise generator and proceed
immediately.
Each requested iteration has three possible outcomes: yield, return, or throw.
Yield waits for the given promise and resumes the generator with the eventual
value.
Return stops the trampoline and returns the value, all the way out to the
promise returned by the async function.
If you yield a promise that eventually throws an error, the async function
resumes the generator with that error, giving it a chance to recover.

[Async]: http://wiki.ecmascript.org/doku.php?id=strawman:async_functions#reference_implementation

```js
Promise.async = function async(generate) {
    return function () {
        function resume(verb, argument) {
            var result;
            try {
                result = generator[verb](argument);
            } catch (exception) {
                return Promise.throw(exception);
            }
            if (result.done) {
                return result.value;
            } else {
                return Promise.return(result.value).then(donext, dothrow);
            }
        }
        var generator = generate.apply(this, arguments);
        var donext = resume.bind(this, "next");
        var dothrow = resume.bind(this, "throw");
        return donext();
    };
}
```

As much as JavaScript legitimizes the async promise generators by supporting
returning and throwing, now that Promises are part of the standard, the powers
that sit on the ECMAScript standards committee are contemplating special `async`
and `await` syntax for this case.
The syntax is inspired by the same feature of C#.

```js
var authenticate = async function () {
    var username = await getUsernameFromConsole();
    var user = getUserFromDatabase(username);
    var password = getPasswordFromConsole();
    [user, password] = await Promise.all([user, password]);
    return hash(password) === user.passwordHash;
})
```

One compelling reason to support special syntax is that `await` may have higher
precedence than the `yield` keyword.

```js
async function addPromises(a, b) {
    return await a + await b;
}
```

By decoupling **async functions** from **generator functions**, JavaScript opens
the door for **async generator functions**, foreshadowing a **plural** and
**temporal** getter, a standard form for readable streams.

