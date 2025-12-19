^^^^
title: "Tethers and Memory: How Goblin Actually Works"
author: Sheriff Docs
layout: docs
meta_kind: docs
meta_type: concepts
summary: The real reason Goblin doesn't use = for assignment.
^^^^

Goblin doesn't hide how computers work — it shows you the truth in a way that makes sense.

This guide explains **stashes**, **tethers**, and **addresses** with complete honesty. No lies, no hand-waving. By the end, you'll understand what's really happening when your code runs.

---

## Part 1: Everything Lives In Stashes

When you write:
```goblin
x | 5
```

Here's what actually happens:

1. Goblin allocates memory — a **stash** — somewhere (maybe address `0x55555555f2c0`)
2. Puts the number `5` inside that stash
3. The name `x` becomes a **tether** (like a rope) tied to that stash's address

**Memory diagram:**
```
Memory:
[0x55555555f2c0]: Stash containing 5

Tethers:
x -----> 0x55555555f2c0
```

You can see this yourself:
```goblin
x | 5
:say(:memaddr(x))  /// "0x55555555f2c0"
```

**The address tells you where the stash is.** The tether ties to that address.

The addresses will be different each time you run your program (operating system security), but that doesn't change what's happening — you can still see when tethers tie to the same address vs. different addresses.

**Key truth:** The name `x` doesn't "contain" the value 5. It's a tether tied to the address of a stash that holds 5.

---

## Part 2: Most Stashes Are Sealed

Here's where it gets important:
```goblin
x | 5
x |= 6
```

What happened? Did the `5` inside the stash turn into a `6`?

**No.** Here's what actually happened:

1. Goblin allocated a **new stash** at a different address
2. Put the number `6` inside it
3. **Retied the tether** `x` to point at the new address
4. The stash with `5` is still there, sealed shut, unchanged

**Memory diagram:**
```
Memory:
[0x55555555f2c0]: Stash containing 5 (sealed, abandoned)
[0x55555555f2e0]: Stash containing 6 (sealed)

Tethers:
x -----> 0x55555555f2e0
```

See it yourself:
```goblin
x | 5
:say(:memaddr(x))  /// "0x55555555f2c0"

x |= 6
:say(:memaddr(x))  /// "0x55555555f2e0" (different address!)
```

**Key truth:** Most stashes in Goblin are **sealed shut**. Once you put a value in, it stays there forever. When you "change" something, you're really creating a new stash and retying the tether.

**Other languages work this way under the hood too:** Python, JavaScript, Ruby, Java, and most modern languages use the same "names point to stashes" model. The difference is many of their stashes are **mutable containers** (lists, dicts, objects), and they rarely show you the addresses or talk about this honestly. Goblin makes the model explicit and **seals stashes by default**.

---

## Part 3: Tethers Point to Addresses, Not Each Other

This is the most important concept. Watch carefully:
```goblin
x | 5
y | x
x |= 6
:say(y)  /// 5 (not 6!)
```

**Why is `y` still 5?**

When you wrote `y | x`, you tethered `y` to **the address that `x` was pointing to at that moment** (the address of the stash holding `5`).

When you later wrote `x |= 6`, you **only moved the `x` tether**. The `y` tether stayed tied to the same address.

**Memory diagram:**
```
After y | x:
[0x55555555f2c0]: Stash containing 5

x -----> 0x55555555f2c0
y -----> 0x55555555f2c0  (both point to same address)

After x |= 6:
[0x55555555f2c0]: Stash containing 5
[0x55555555f2e0]: Stash containing 6

x -----> 0x55555555f2e0  (moved)
y -----> 0x55555555f2c0  (stayed put)
```

See it in action:
```goblin
x | 5
y | x

:say(:memaddr(x))  /// "0x55555555f2c0"
:say(:memaddr(y))  /// "0x55555555f2c0" (same!)
:say(:same_place?(x, y))  /// true

x |= 6

:say(:memaddr(x))  /// "0x55555555f2e0" (moved)
:say(:memaddr(y))  /// "0x55555555f2c0" (unchanged)
:say(:same_place?(x, y))  /// false
```

**Key truth:** Tethers point to **addresses**, not to other tethers. When you tether `y` to `x`, you're tethering to "wherever `x` is pointing **right now**" — not "wherever `x` will point in the future."

**This is different from C++ references or Rust's `&mut`**, which do create connections between names. Goblin's tethers are more like Python's or JavaScript's variable binding — they capture the current location, not the name itself.

---

## Part 4: Collections Work the Same Way

Everything we just learned applies to collections too:
```goblin
items | [:a :b :c]
```

Goblin allocates memory for a stash, puts the collection `[:a :b :c]` inside it, and tethers `items` to that address.
```goblin
items | [:a :b :c]
:say(:memaddr(items))  /// "0x5555555a1040"
```

Now watch what happens when you make a "backup":
```goblin
items | [:a :b :c]
backup | items

:say(:memaddr(items))   /// "0x5555555a1040"
:say(:memaddr(backup))  /// "0x5555555a1040" (same address!)
:say(:same_place?(items, backup))  /// true
```

Both `items` and `backup` are tethered to **the same address**. They're looking at the same stash.

**This is the idiomatic, safe way to share values in Goblin.** If you want two names to always see the same value with zero surprises, just tether them both to the same address once and never retether either one. Most of the time when you think you need "y follows x," this is what you actually want.

**Languages like Clojure, Erlang, and Elixir work exactly this way.** Immutable values are shared freely because nobody can change them.

---

## Part 5: The Fridge Metaphor (Understanding Garbage Collection)

Think of Goblin's garbage collector as the goblin who patrols the shared fridge at work.

If you don't have your name (a tether) on a stash anymore, you can't be mad when it disappears.

**No name, no claim. Finders keepers.**
```goblin
lunch | "sandwich"        /// Put your name on it
lunch |= "pizza"          /// Change your mind, new stash created
                          /// Old "sandwich" stash now abandoned
                          /// GC goblin: "Ah, no names? Cool, mine now."
```

When a stash has **zero tethers**, it becomes an **abandoned stash** — and the GC is free to eat it (reclaim that memory).

---

## Part 6: Creating New Stashes (What People Call "Mutation")

Watch what happens when you want to change part of a collection:
```goblin
items | [:a :b :c]
backup | items

items[0] |! :z

:say(items)   /// [:z :b :c]
:say(backup)  /// [:a :b :c]
```

**What happened?**

When you wrote `items[0] |! :z`, Goblin:

1. Created a **brand new stash** containing `[:z :b :c]` at a different address
2. Retethered `items` to point at the new address
3. Left the original stash completely unchanged

**Memory diagram:**
```
After items | [:a :b :c] and backup | items:
[0x5555555a1040]: Stash containing [:a :b :c]

items  -----> 0x5555555a1040
backup -----> 0x5555555a1040

After items[0] |! :z:
[0x5555555a1040]: Stash containing [:a :b :c]  (original, sealed, abandoned)
[0x5555555a1080]: Stash containing [:z :b :c]  (new stash)

items  -----> 0x5555555a1080  (retethered)
backup -----> 0x5555555a1040  (stayed put)
```

See it yourself:
```goblin
items | [:a :b :c]
backup | items

:say(:memaddr(items))   /// "0x5555555a1040"
:say(:memaddr(backup))  /// "0x5555555a1040" (same!)

items[0] |! :z

:say(:memaddr(items))   /// "0x5555555a1080" (new address!)
:say(:memaddr(backup))  /// "0x5555555a1040" (unchanged!)
:say(backup[0])         /// :a (original still exists)
```

**Key truth:** Goblin **never changes what's in a sealed stash**. Instead, it creates a new stash with your changes and retethers to it.

---

## Part 6a: Why Goblin Works This Way

Goblin could have chosen in-place mutation like C or Java. Why didn't it?

- **No aliasing bugs**: When `backup` and `items` point to the same stash, changing `items` can't accidentally break `backup` because you're creating a new stash
- **No hidden side effects**: You can pass a collection to a function and know it won't change behind your back
- **Perfect concurrency**: Multiple threads can read the same sealed stash with zero locks — the contents can never change
- **Predictability**: Values can't change when you're not looking

In-place mutation is faster in some cases, but the bugs it causes are expensive. Goblin chooses safety and simplicity by default, with explicit overwriting when you need it.

**This model is called "persistent data structures" or "immutable by default."** Languages like Clojure, Haskell, Erlang, Elixir, and Elm all work this way. Even Rust defaults to immutable bindings. Goblin is part of a well-established tradition — we're just more honest about showing you the stashes and addresses.

---

## Part 6b: Structural Sharing

Under the hood, Goblin may **share structure** between the old and new stashes for efficiency. When you write `items[0] |! :z`, Goblin doesn't copy all million elements — it creates a new stash that shares most of its internal structure with the original, only allocating what changed. 

But from your perspective, they're completely separate values at different addresses. The structural sharing is an optimization you never have to think about. The addresses prove they're different stashes.

**This is how Clojure's vectors and maps work**, and how Git stores file versions — shared structure where possible, but logically separate values.

---

## Part 7: The Four Tether Operators

Now that you understand how it all works, here are the four operators.

**All four operators create stashes and tether to them.** That's the only thing they do. The differences are in **when you use them** and **what syntax they provide**.

---

### `|` — Tether (First Time)
```goblin
name | value
```

**Creates a stash containing `value`, tethers the name to that stash's address.**

Use this the **first time** you bind a name in a scope.
```goblin
x | 5                  /// Create stash with 5, tether x to it
items | [:a :b :c]     /// Create stash with [:a :b :c], tether items to it
path | "../config.yall" /// Create stash with string, tether path to it
```

---

### `|=` — Retether (Replace Entire Value)
```goblin
name |= value
```

**Creates a new stash containing `value`, retethers the name to the new stash's address.**

The name must already exist in the current scope.

Use this when you want to **replace the entire value** with something new.
```goblin
count | 0
count |= count + 1    /// Create stash with 1, retether count to it

path | "./temp"
path |= "./output"    /// Create stash with "./output", retether path to it

items | [:a :b :c]
items |= [:z :b :c]   /// Create stash with [:z :b :c], retether items to it
```

**What's happening:** You're giving Goblin the complete new value. Goblin creates a stash for it, then retethers.

---

### `[=` — Shadow Tether (Temporary Override)
```goblin
name [= value
```

**Creates a stash containing `value`, creates a shadow tether to it in a nested scope.**

Leaves the outer tether intact. Inside this scope, the name refers to the new stash. When the scope ends, the shadow disappears.
```goblin
count | 5

act bump()
    count [= 999     /// Create stash with 999, shadow tether in this scope
    count |= count + 1
    :say(count)      /// 1000 (shadow was retethered)
xx

bump()
:say(count)          /// 5 (outer tether untouched)
```

**What's happening:** You're creating a temporary tether that only exists inside the nested scope. When the scope ends, the shadow tether disappears and the outer tether is unchanged.

**This is similar to Rust's shadowing**, but more explicit. In Rust you use `let` again; in Goblin you use a distinct operator so it's clear you're creating a shadow.

---

### `|!` — Collection Update Sugar (Change Elements Inside)
```goblin
collection[index] |! value
collection[key] |! value
```

**Creates a new stash containing the collection with the specified element changed, retethers to the new stash's address.**

Use this when you want to **change specific elements inside a collection** without writing out the entire new collection.
```goblin
items | [:a :b :c]
items[0] |! :z       /// Create stash with [:z :b :c], retether items to it

config | {theme: "dark", size: 12}
config["theme"] |! "light"  /// Create stash with updated map, retether config
```

**What's happening:** `|!` is **sugar for calling an update function**, which creates the new stash, which you then retether to.

Under the hood:
```goblin
items[0] |! :z

/// Is sugar for:
items |= :update_first(items, :z)
```

`|!` saves you from having to:
1. Call the update function yourself (`:update_first`)
2. Pass the collection to it
3. Use `|=` to retether the result

It's **not** sugar for `|=` itself. It's sugar for the whole pattern of "call update function, get new stash, then retether."

**Important:** `|!` is only for collections. For simple values, use `|=`:
```goblin
count | 5
count |= 6    /// Correct
count |! 6    /// Error - |! only works with collection[index]
```

---

## Part 8: Why This Matters

### No Aliasing Bugs
```goblin
original | [:a :b :c]
modified | original

modified[0] |! :z

:say(original)  /// [:a :b :c] (unchanged!)
:say(modified)  /// [:z :b :c]
```

Because `|!` creates a new stash (via calling an update function), `original` doesn't see the change. No surprises.

In C or Python, this would be a bug:
```python
original = ['a', 'b', 'c']
modified = original
modified[0] = 'z'
print(original)  # ['z', 'b', 'c'] — surprise!
```

**Python has this problem because lists are mutable containers.** When you write `modified = original`, both names point to the same mutable list. Goblin's sealed stashes eliminate this entire class of bugs.

### Easy Concurrency

Because stashes are sealed by default, multiple threads can read the same data without locks:
```goblin
config | :load("settings.yall")

/// Thread 1 and Thread 2 can both read config safely
/// No locks needed — the stash is sealed
```

**This is how Erlang and Elixir achieve their legendary concurrency.** Immutable data means no data races.

### Predictable Code

You never have to worry about "who else is looking at this stash?" The answer doesn't matter — they're looking at a sealed stash that can never change.

---

## Part 9: When You Actually Need To Overwrite Memory

95% of the time, Goblin's sealed stashes are what you want. But sometimes you genuinely need to **overwrite the contents of a stash** (counters, caches, stateful systems).

For that, Goblin gives you **explicit overwrite**:
```goblin
counter | 0

:say(:memaddr(counter))  /// "0x5555555a2000"

:overwrite!(:memaddr(counter), 5)

:say(:memaddr(counter))  /// "0x5555555a2000" (SAME address!)
:say(counter)            /// 5
```

**Notice:** You must pass the **address**, not just the name. This forces you to think about what you're doing — you're overwriting memory at a specific location.

If you try to pass a name instead of an address, Goblin will error:
```goblin
:overwrite!(counter, 5)  /// ERROR: overwrite! requires an address
                          /// Pass :memaddr(counter) to confirm you
                          /// understand you're overwriting memory
```

**The address requirement isn't about safety — it's about honesty.** When you write `:overwrite!(:memaddr(counter), 5)`, you're explicitly saying "I know this address, I know what's there, and I'm deliberately overwriting it."

---

### Critical Safety Rule

**Important:** Only use `:overwrite!` on addresses that still have at least one live tether. If you keep an address after every tether to that stash has gone out of scope, Goblin is free to reclaim or reuse that memory. Overwriting a reclaimed address is undefined behavior — you're scribbling over memory that might belong to something else now.
```goblin
addr | :memaddr(x)

x | 5
x |= 6    /// x retethered, old stash might be garbage collected

:overwrite!(addr, 999)  /// DANGER: addr might point to reclaimed memory
```

Don't do this. Keep at least one tether alive if you're going to overwrite.

---

### Why This Is Dangerous
```goblin
counter | 0
watcher | counter       /// Both tethered to same address

:say(:memaddr(counter))  /// "0x5555555a2000"
:say(:memaddr(watcher))  /// "0x5555555a2000" (same!)

:overwrite!(:memaddr(counter), 5)

:say(counter)   /// 5
:say(watcher)   /// 5 (watcher sees it too - same stash!)
```

**Everyone looking at that address sees the change.** The stash didn't move. The contents were overwritten.

This is **real in-place mutation**. It's the only place in Goblin where you're actually changing bytes at an address instead of creating a new stash.

---

### Compare: Normal Operations vs Overwrite

All the normal tether operators create **new stashes**:
```goblin
items | [:a :b :c]
:say(:memaddr(items))  /// "0x1000"

items |= [:z :b :c]    /// Create NEW stash, retether
:say(:memaddr(items))  /// "0x2000" (different address!)

items[0] |! :w         /// Create NEW stash (via update function), retether  
:say(:memaddr(items))  /// "0x3000" (different address!)
```

Every time you use `|=` or `|!`, you get a new address. The old stashes stay unchanged.

**Overwrite is different:**
```goblin
items | [:a :b :c]
:say(:memaddr(items))  /// "0x1000"

:overwrite!(:memaddr(items), [:z :b :c])
:say(:memaddr(items))  /// "0x1000" (SAME address!)
```

The address didn't change. The stash contents were overwritten. Anyone else looking at `0x1000` sees the change.

---

### When To Use This

Use `:overwrite!` when:
- You need a shared mutable counter accessed by multiple functions
- You're building a cache that needs to update in place
- You're interfacing with C libraries that require mutable buffers
- Performance profiling proves you need in-place mutation (rare)

**Don't use it** for normal programming. Creating new stashes and retethering is simpler, safer, and easier to reason about.

**Creating new stashes is the idiomatic Goblin way.** `:overwrite!` is an escape hatch for rare, performance-critical, or interop-heavy scenarios. If you reach for it often, you're probably fighting the language instead of using it.

The fact that you have to type `:memaddr()` every time is intentional friction — it should feel slightly uncomfortable, because you're stepping outside Goblin's safety model.

**This is similar to Clojure's `atom` or Rust's `RefCell`** — an explicit opt-in to mutation when you really need it. The difference is Goblin makes you pass the address, so there's zero ambiguity about what's happening.

---

## Part 10: Burn (Priority Cleanup Hint)

Most of the time, you let Goblin's garbage collector clean up abandoned stashes automatically. But sometimes you know a stash is about to become garbage and you want to hint the GC: "clean this one up sooner."

That's what `burn` is for.
```goblin
temp | burn :parse_json(input)
/// Use temp for something
/// GC will prioritize cleaning up this stash
```

**What `burn` does:**
- Marks the stash with a priority flag
- GC will sweep it first chance it gets
- Still safe: if anything else is tethered to it, it won't be destroyed

**When to use `burn`:**
- Temporary parse results
- Large blobs or buffers you're done with
- Loop-heavy intermediate values
- Any time you know "I'm about to abandon this, clean it up ASAP"

### Important: `burn` Only Works on Last Tether
```goblin
x | [:data]
burn x     /// ✅ Works - x is the only tether

x | [:data]
y | x
burn x     /// ❌ ERROR: Can't burn - stash still has 2 tethers
```

**Why?** If multiple tethers exist, the stash is still in use. You can only burn what you're truly done with.

### Force Burn with `burn!`

If you need to burn despite other tethers:
```goblin
x | [:data]
y | x
burn! x    /// ✅ Forces burn despite y
           /// y becomes untethered (unassigned)
```

**Danger:** After `burn! x`, the variable `y` becomes **untethered** — it doesn't point to any stash. If you try to use it:
```goblin
:say(y)  /// ERROR: y is untethered - re-tether it before use: y | value
```

The `!` signals: "I know other tethers exist, burn anyway." Use with care.

---

## Part 11: Fang (Consume-On-Call Ownership Transfer)

Sometimes you want to hand off a value and be **completely done with it**. No more access, no more references — you're transferring ownership.

That's what **fang** (`;;`) is for.
```goblin
buf | :read_file("data.bin")
;;sock>>:write_all(buf)   /// buf consumed, can't use again
```

**What fang does:**
- Transfers ownership immediately
- After fang, the consumed value is **gone** from your scope
- You cannot touch it again — compiler will error if you try
- GC sees fanged values as unreachable immediately

### Syntax
```goblin
;;arg              /// Consume single argument
;;[arg1, arg2]     /// Consume multiple arguments
```

### Examples

**Money/transaction enforcement:**
```goblin
amt | 50.money("USD")
;;deposit(account, amt)  /// amt consumed, ensures perfect conservation

:say(amt)  /// ERROR: amt was consumed by fang
```

**Zero-copy pipelines:**
```goblin
;;[img, meta] publish(img, meta, channel)
/// Both img and meta consumed
```

### Important: Fang Only Works on Last Tether
```goblin
x | [:data]
y | x
;;:process(x)  /// ❌ ERROR: Can't consume - y still tethered
```

Just like `burn`, you can only consume if you're the last one holding it.

### Force Fang with `;;!`
```goblin
x | [:data]
y | x
;;!:process(x)  /// Forces consume despite y
                /// y becomes untethered
```

After `;;! x`, the variable `y` is untethered (unassigned). Trying to use it will error.

---

## Part 12: Memory Metrics

Goblin lets you see memory usage in **human terms** — no raw byte counts unless you ask.

### Basic Metrics
```goblin
:say(:mem_total())   /// "200 MB of 10 GB (2%)"
:say(:mem_heap())    /// "75% usage (1.5 GB of 2 GB)"
:say(:mem_stack())   /// "34 MB"
```

Always reported with:
- Nearest sensible unit (KB, MB, GB, TB)
- Used out of available
- Percentage usage

### Memory Snapshot
```goblin
:memory_snapshot()
/// {
///   total_allocated: 1048576,      // 1MB total
///   total_tethered: 524288,        // 512KB actively tethered
///   total_untethered: 524288,      // 512KB garbage
///   stash_count_tethered: 120,
///   stash_count_abandoned: 80,
///   gc_last_run: 1500,             // ms since last GC
///   stashes_by_type: {
///     List: {count: 45, bytes: 102400},
///     Map: {count: 30, bytes: 204800},
///     String: {count: 60, bytes: 61440},
///     Int: {count: 40, bytes: 960}
///   }
/// }
```

### Watching Memory Before/After
```goblin
before | :memory_snapshot()

/// ... run your program ...

after | :memory_snapshot()

:say("Created {after.stash_count_abandoned} abandoned stashes")
:say("Using {after.total_untethered} bytes")
```

You can **literally watch** your program's memory behavior and see abandoned stashes pile up, then disappear after GC.

---

## Part 13: Introspection Tools

Goblin is unique because it doesn't just describe how values work — it lets you **see it happen**.

Values live in stashes at specific addresses. Variable names are tethers tied to those addresses. When a stash has zero tethers, it becomes abandoned. When a variable has no stash, it's untethered.

Goblin exposes this model through introspection tools that let you observe everything in real time.

### `:memaddr(x)`

Returns the memory address of the stash that `x` is tethered to.
```goblin
x | [:a :b :c]
:say(:memaddr(x))  /// "0x5555555a1040"
```

This shows you exactly where the stash lives in memory.

---

### `:same_place?(x, y)`

Returns `true` if two tethers point to the same stash.
```goblin
y | x
:say(:same_place?(x, y))  /// true
```

Perfect for confirming whether two names share the same underlying value.

---

### `:tether_count(x)` — Unified Counting

One builtin, two modes:

**1) Value Mode**

If `x` is a value, return how many tethers point to the same stash.
```goblin
x | [:a :b :c]
:say(:tether_count(x))      /// 1

y | x
:say(:tether_count(x))      /// 2
```

**2) Address Mode**

If `x` is a string containing a live address (such as from `:memaddr`), return how many tethers point to that address.
```goblin
addr | :memaddr(x)
:say(:tether_count(addr))   /// 2
```

Goblin automatically detects whether you're passing a value or an address.

---

### `:list_untethered()` — Complete Picture

Shows **both sides** of what's disconnected:

- **Abandoned stashes** — stashes with zero tethers (will be GC'd)
- **Untethered variables** — variables not pointing to any stash

**Think of it like the work fridge:** Show me all the sandwiches with no name on them, and all the name-tags that aren't stuck to any sandwich.
```goblin
x | 5
y | x
z | [:data]

x |= 6     /// Create new stash with 6, retether x
           /// Stash with 5 now abandoned
           
burn! y    /// y becomes untethered variable  

z |= :nil  /// Create new stash with :nil, retether z
           /// Stash with [:data] now abandoned

:list_untethered()
/// {
///   stashes: [
///     {addr: "0x1000", type: "Int", size_bytes: 8, preview: "5"},
///     {addr: "0x2000", type: "List", size_bytes: 48, preview: "[:data]"}
///   ],
///   vars: ["y"]
/// }
```

**One command shows the complete picture:**
- Abandoned stashes (no names on them — GC will eat them)
- Untethered variables (names not stuck to any stash — can't use them)

---

### `:memsize(x)`

Returns how much memory the stash uses (in bytes).
```goblin
items | [:a :b :c]
:say(:memsize(items))  /// 48
```

---

### `:meminfo(x)`

Full diagnostic dump of a value.
```goblin
items | [:a :b :c]
:say(:meminfo(items))
/// {
///   address: "0x5555555a1040",
///   type: "List",
///   size_bytes: 48,
///   tether_count: 1,
///   burned: false
/// }
```

---

### Why These Tools Matter

**1. The Model Becomes Real**

You don't have to believe how Goblin works — you can observe it:
- See when two names share the same stash
- Watch tethers move when you use `|=` or `|!`
- Watch new stashes get created at new addresses
- See abandoned stashes appear in the untethered list

**2. Debugging Alias Issues**

Wondering why a value didn't update somewhere else?
```goblin
:say(:tether_count(x))
:say(:same_place?(x, y))
```

You'll immediately know whether values are shared or separate.

**3. Understanding Garbage Collection**

You can see when stashes become unreachable:
```goblin
:list_untethered()
```

This makes memory behavior predictable and explorable.

**4. Transparency**

Other languages hide memory, tethers, and GC. Goblin exposes it — not for micromanagement, but for **truth**.

---

## Summary: The Complete Mental Model

**Everything is stashes, addresses, and tethers.**

**Stashes** — Chunks of memory that hold values at specific addresses.

**Tethers** — Names tied to addresses.

**Most stashes are sealed** — contents never change.

**Four tether operators** (all create stashes and tether to them):
- **`|`** — Create stash, tether (first time in scope)
- **`|=`** — Create new stash, retether (you provide complete new value)
- **`[=`** — Create stash, shadow tether (temporary in nested scope)
- **`|!`** — Create new stash with collection changes, retether (sugar for calling update function)

**Two kinds of "untethered":**
- **Abandoned stashes** — stashes with zero tethers (no names on them — GC will eat them)
- **Untethered variables** — variables with no stash (names not stuck to anything — can't use them)

**The Rule:** If you don't have a tether to a stash, you don't own it.

**Memory control (when needed):**
- `burn` / `burn!` — priority cleanup hint
- `;;` / `;;!` (fang) — consume-on-call ownership transfer
- `:overwrite!()` — explicit in-place mutation (rare, dangerous)

**Introspection tools:**
- `:memaddr(x)` — where does this tether point?
- `:same_place?(x, y)` — same stash?
- `:tether_count(x)` — how many tethers?
- `:list_untethered()` — what's disconnected? (stashes + vars)
- `:memory_snapshot()` — overall memory stats

**Tethers point to addresses, not to other tethers.**

That's it. That's the entire model. Everything else in Goblin builds on this foundation.

---

## What You've Learned

You now understand how Goblin actually works at the memory level. You know:

- What stashes, addresses, and tethers are
- Why most stashes are sealed
- That all four tether operators create new stashes (they just differ in syntax and when you use them)
- That `|!` is sugar for calling an update function that creates a new stash, which you then retether to
- When and how to use explicit overwriting with `:overwrite!()`
- How to hint cleanup with `burn`
- How to transfer ownership with fang (`;;`)
- How to see memory usage and untethered state
- How to avoid aliasing bugs
- Why concurrency is easy with sealed stashes
- How to see the actual memory addresses and prove it all yourself
- The fridge metaphor: no name, no claim — finders keepers

**Most importantly:** You know the truth. Goblin never lied to you. This is actually how the computer works, and it's how many successful languages (Clojure, Erlang, Elixir, Haskell) work too. Goblin just shows you the stashes and addresses directly instead of hiding them.

Now go build something.