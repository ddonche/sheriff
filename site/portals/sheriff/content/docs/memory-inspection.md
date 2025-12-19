# Goblin Memory Introspection Functions

## Current Implementation (No GC Yet)

These functions allow you to inspect memory usage, tether relationships, and stash state while Goblin runs.

---

### `:mem_addr(x)`

Returns the memory address of the stash that `x` is tethered to.

**Returns:** String (hex address like `"0x5555555a1040"`)

**Example:**
```goblin
x | 5
:say(:mem_addr(x))  // "0x5555555a1040"
```

---

### `:mem_compare(x, y)`

Checks if two tethers point to the same stash (same address).

**Returns:** Boolean (`true` if same address, `false` otherwise)

**Example:**
```goblin
x | [:a :b :c]
y | x
:say(:mem_compare(x, y))  // true

x |= [:z :b :c]
:say(:mem_compare(x, y))  // false (x now points to new stash)
```

---

### `:tether_count(x)`

Returns how many tethers point to the same stash as `x`.

**Returns:** Integer (number of tethers)

**Modes:**
- Pass a value: counts tethers to that value's stash
- Pass an address string: counts tethers to that address

**Example:**
```goblin
x | [:a :b :c]
:say(:tether_count(x))  // 1

y | x
:say(:tether_count(x))  // 2

addr | :mem_addr(x)
:say(:tether_count(addr))  // 2
```

---

### `:list_untethered()`

Shows what's disconnected in memory: abandoned stashes (no tethers) and untethered variables (no stash).

**Returns:** Map with two keys:
- `stashes` - Array of abandoned stash info
- `vars` - Array of untethered variable names

**Example:**
```goblin
x | 5
y | x
x |= 6  // Old stash with 5 is now abandoned

:list_untethered()
// {
//   "stashes": [
//     {"addr": "0x1000", "type": "Int", "size_bytes": 8, "preview": "5"}
//   ],
//   "vars": []
// }
```

---

### `:mem_size(x)`

Returns the number of bytes used by the stash that `x` points to.

**Returns:** Integer (bytes)

**Example:**
```goblin
items | [:a :b :c]
:say(:mem_size(items))  // 48
```

---

### `:mem_info(x)`

Full diagnostic dump of a stash.

**Returns:** Map with keys:
- `address` - Hex address string
- `type` - Goblin type name (e.g., "List", "Map", "Int")
- `size_bytes` - Memory used
- `tether_count` - Number of tethers

**Example:**
```goblin
items | [:a :b :c]
:say(:mem_info(items))
// {
//   "address": "0x5555555a1040",
//   "type": "List",
//   "size_bytes": 48,
//   "tether_count": 1
// }
```

---

### `:mem_snapshot()`

Complete snapshot of current memory state.

**Returns:** Map with keys:
- `total_allocated` - Total bytes allocated
- `total_tethered` - Bytes in stashes with tethers
- `total_untethered` - Bytes in abandoned stashes
- `stash_count_tethered` - Number of live stashes
- `stash_count_abandoned` - Number of abandoned stashes
- `stashes_by_type` - Breakdown by type

**Example:**
```goblin
:say(:mem_snapshot())
// {
//   "total_allocated": 1048576,
//   "total_tethered": 524288,
//   "total_untethered": 524288,
//   "stash_count_tethered": 120,
//   "stash_count_abandoned": 80,
//   "stashes_by_type": {
//     "List": {"count": 45, "bytes": 102400},
//     "Map": {"count": 30, "bytes": 204800}
//   }
// }
```

---

### `:mem_total()`

Quick check: total bytes currently in use.

**Returns:** Integer (bytes)

**Example:**
```goblin
:say(:mem_total())  // 1048576
```

Faster than `:mem_snapshot()` when you just need the total.

---

### `:mem_peak()`

Highest memory usage reached since the program started.

**Returns:** Integer (bytes)

**Example:**
```goblin
// ... run your build ...
:say(:mem_peak())  // 2097152
```

Useful for profiling: "What's the most memory Sheriff needed?"

---

## Future (When GC Exists)

These will be added when Goblin implements garbage collection:

- `:mem_available()` - Memory left before system pressure
- `:mem_gc_trigger()` - Manually trigger a GC cycle
- `:mem_gc_stats()` - GC metrics (runs, pause time, objects collected)
- `:mem_generation(x)` - Which GC generation a stash is in

---

## Usage Pattern for Sheriff

```goblin
before | :mem_snapshot()

// ... build all pages ...

after | :mem_snapshot()

:say("Peak memory: {:mem_peak()}")
:say("Created {:after["stash_count_abandoned"]} abandoned stashes")
:say("Memory leaked: {:after["total_untethered"]} bytes")
```

This lets you see exactly how memory behaves during a build.