
# A General Theory of Reactivity

*A work in progress.*

In the context of a computer program, reactivity is the process of receiving
external stimuli and propagating events.
This is a rather broad definition that covers a wide variety of topics.
The term is usually reserved for systems that respond in turns to sensors,
schedules, and above all, problems that exist between the chair and keyboard.

The field of reactivity is carved into plots ranging from "reactive programming"
to the subtly distinct "*functional* reactive programming", with acrage set
aside for "self adjusting computation" and with neighbors like "bindings" and
"operational transforms".
Adherents favor everything from "continuation passing style" to "promises", or
the related concepts of "deferreds" and "futures".
Other problems lend themselves to "observables", "signals", or "behaviors", and
everyone agrees that "streams" are a good idea, but "publishers" and
"subscribers" are distinct.

In 1905, Einstein created a theory of special relativity that unified the
concepts of space and time, and went on to incorporate gravity, to bring the
three fundamentals of physical law into a single model.
To a similar end, [various][Rx] minds in the field of reactivity have been
converging on a model that unifies at least promises and observables.

[Rx]: https://github.com/Reactive-Extensions/RxJS/blob/aaebfe8962cfa06a6c80908d079928ba5b800c66/doc/readme.md

|              | **Singular**         | **Plural**              |
| :----------: | :------------------: | :---------------------: |
| **Spatial**  | Value                | Iterable&lt;Value&gt;   |
| **Temporal** | Promise&lt;Value&gt; | Observable&lt;Value&gt; |

However, this description fails to capture all of the varigated concepts of
reactivity.
Rather, Rx conflates all reactive primitives into a single Observable type that
can perform any role.
Just as an array is an exemplar of an entire taxonomy of collections, promises,
streams, and observables are merely representatives of their class of reactive
primitives.
As the common paraphrase of Einstein goes, everything should be made as simple
as possible, but no simpler.

