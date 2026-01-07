^^^^
title: Loops in Goblin
author: Goblin Docs
layout: docs
meta_kind: docs
meta_type: concepts
summary: Goblin only has one keyword for loops, and it isn't loop.
^^^^

You need to do something ten times. Or loop through a list of items. Or keep going until a condition changes.

In Python, you use `for` for some of these and `while` for others. In JavaScript, you have `for`, `while`, `for...in`, `for...of`, and `forEach`, and you have to remember which one to use when. Ruby gives you `for`, `while`, `until`, `loop`, `each`, `times`, `upto`, and more—good luck picking the right one.

Goblin has one keyword: `repeat`.

That's it. No memorizing when to use `for` versus `while`. No looking up whether you need `for...in` or `for...of` this time. You just write `repeat:` and give it something—a number, a condition, a collection—and Goblin figures out what you mean.

Want to run code 10 times? `repeat: 10`. Want to loop while health is above zero? `repeat: health > 0`. Want to process each item in an array? `repeat: items`.

One keyword. Every loop.

---

## How Goblin Decides What Kind of Loop You Want

Goblin looks at what you give it after `repeat:` and decides based on the type:

| You give it...        | You get...                     |
|-----------------------|--------------------------------|
| Nothing (`repeat:`)   | Infinite loop                  |
| A number (`10`)       | Count loop (runs N times)      |
| A bool (`x > 0`)      | Conditional loop (while true)  |
| An array              | Loop over each item            |
| A string              | Loop over each character       |
| A range (`3..6`)      | Loop over the range            |
| A map                 | Loop over key/value pairs      |
| Something else        | Error                          |

No guessing. No coercion. If Goblin doesn't know how to repeat it, it tells you.

Let's see each one.

---

## 1. Infinite Loop — Bare `repeat:`
```goblin
repeat:
    tick()
    stop if: done?
xx
```

No expression after `repeat:` means "run forever." You escape with `stop`, `stop if`, or `return`.

One-liner version:
```goblin
repeat: => tick()
```

---

## 2. Count Loop — Give It a Number
```goblin
repeat: 10
    :say("digging...")
xx
```

Runs exactly 10 times. That's it. No `for i in range(10)` ceremony.

If you need to know which iteration you're on, Goblin gives you `idx`:
```goblin
repeat: 5
    :say("tunnel {idx}")
xx
```

Output:
```
tunnel 0
tunnel 1
tunnel 2
tunnel 3
tunnel 4
```

Starts at 0. If you give it 0 or a negative number, the loop doesn't run at all.

One-liner:
```goblin
repeat: 10 => :say("hello")
```

---

## 3. Conditional Loop — Give It a Bool
```goblin
health | 100

repeat: health > 0
    :say("still alive: {health}")
    health |= health - 10
xx
```

Output:
```
still alive: 100
still alive: 90
still alive: 80
...
still alive: 10
```

The condition is checked **before** each iteration. If it's false from the start, the loop never runs.

This is Goblin's "while loop" — you just write the condition after `repeat:`.

---

## 4. Item Loops — Arrays, Strings, Ranges

Here's where things get interesting.
```goblin
loot | ["sword", "shield", "potion"]

repeat: loot
    :say("found: {it}")
xx
```

Output:
```
found: sword
found: shield
found: potion
```

Inside the loop, `it` is the current item. You also get `idx`:
```goblin
repeat: loot
    :say("{idx}: {it}")
xx
```

Output:
```
0: sword
1: shield
2: potion
```

### Strings Work Too
```goblin
repeat: "goblin"
    :say(it)
xx
```

Output:
```
g
o
b
b
l
i
n
```

### And Ranges

Goblin has two kinds of ranges:
- `a..b` — exclusive end (doesn't include `b`)
- `a...b` — inclusive end (includes `b`)
```goblin
repeat: 3..6
    :say(it)
xx
```

Output:
```
3
4
5
```
```goblin
repeat: 3...6
    :say(it)
xx
```

Output:
```
3
4
5
6
```

### Naming Items Yourself

Don't like `it`? Use `as`:
```goblin
heroes | [
    { "name": "Grom", "hp": 100 },
    { "name": "Zug", "hp": 85 }
]

repeat: heroes as hero
    :say("{hero["name"]} has {hero["hp"]} HP")
xx
```

Output:
```
Grom has 100 HP
Zug has 85 HP
```

When you use `as`, `it` disappears, but `idx` still works.

---

## 5. Map Loops — Key/Value Pairs
```goblin
stats | { "str": 10, "dex": 15, "int": 8 }

repeat: stats
    :say("{key} => {val}")
xx
```

Output:
```
str => 10
dex => 15
int => 8
```

Or make it readable:
```goblin
repeat: stats
    :say("{key} has {val} hit points")
xx
```

Output:
```
str has 10 hit points
dex has 15 hit points
int has 8 hit points
```

Explicit binding:
```goblin
repeat: stats as (k, v)
    :say("{k} = {v}")
xx
```

---

## 6. The Secret: Goblin Manages the Cursor

Here's what makes Goblin different.

In most languages, when you loop over a collection, you're managing an index—even if the language hides it:

**Python:**
```python
for i in range(len(items)):
    item = items[i]
    # You're managing i, even if Python hides it
```

**JavaScript:**
```javascript
for (let i = 0; i < items.length; i++) {
    let item = items[i];
    // You manage i yourself
}
```

In Goblin, there's a **hidden loop cursor** that tracks where you are. You never see it. You never manage it. It just works.

You get:
- `it` — current element
- `idx` — current position

And Goblin steps forward automatically each iteration.

**You never write:**
```goblin
i | 0           # Never needed
i |= i + 1      # Never needed
```

**You never check:**
```goblin
stop if: i >= items.len   # Never needed
```

Goblin handles all of this.

**Unless you want to override it.**

---

## 7. Slices and Starting Points

You can slice collections before looping:
```goblin
items | ["a", "b", "c", "d", "e"]

repeat: items[2..]
    :say(it)
xx
```

Output:
```
c
d
e
```

With ranges:
```goblin
repeat: items[1...3]
    :say(it)
xx
```

Output:
```
b
c
d
```

---

## 8. Loop Control — `skip`, `stop`, `return`

### `skip` — Go to Next Iteration
```goblin
repeat: loot
    skip if: it == "junk"
    :say("keeping: {it}")
xx
```

When you hit `"junk"`, Goblin skips the rest and moves to the next item.

### `stop` — Break Out
```goblin
repeat: items
    stop if: it == "bomb"
    process(it)
xx
```

Loop ends immediately when you hit `"bomb"`.

### `return` — Exit the Function
```goblin
act find_first_big(nums)
    repeat: nums
        if it > 100 => return it
    xx
    return nil
xx
```

Returns the first number over 100, exits the function entirely.

### Sugar: `skip if` and `stop if`

These are just shortcuts:
```goblin
stop if: COND    # -> if COND => stop
skip if: COND    # -> if COND => skip
```

Use whichever is clearer.

---

## 9. Filtering — "Where" Without a Keyword

A lot of languages have special filtering syntax:

**Python:**
```python
for item in items:
    if item["type"] != "post":
        continue
    render_post(item)
```

**JavaScript:**
```javascript
items.filter(item => item.type === "post")
     .forEach(item => renderPost(item));
```

Goblin doesn't need a `where` or `.filter()`:
```goblin
repeat: items
    skip if: it["type"] != "post"
    render_post(it)
xx
```

`skip if` is your filter. Multiple conditions? Stack them:
```goblin
repeat: posts
    skip if: it["draft"]
    skip if: it["archived"]
    skip if: it["deleted"]
    
    publish(it)
xx
```

Each guard skips items that don't match.

---

## 10. Do-While Pattern — Run At Least Once

Some languages have `do...while`:

**C:**
```c
do {
    body();
} while (condition);
```

Goblin doesn't need it:
```goblin
repeat:
    body()
    stop if: not (condition)
xx
```

Infinite loop + `stop if` = do-while behavior. No extra keyword needed.

---

## 11. One-Liners

Everything works as a one-liner:
```goblin
repeat: items => process(it)
repeat: x>0   => tick()
repeat:       => watchdog()
```

---

## 12. Why `jump` Exists — Manual Hell Before Goblin

Before `jump`, programmers had to do this garbage:

**Manual skip-ahead:**
```python
i = 0
while i < len(items):
    item = items[i]
    
    if item == "header":
        i += 5  # Skip ahead
        continue
    
    process(item)
    i += 1
```

Manual index. Manual increment. Manual bounds checking.

**Manual scan-forward:**
```python
i = 0
while i < len(items):
    item = items[i]
    
    if item == "start":
        # Scan until we find "end"
        i += 1
        while i < len(items) and items[i] != "end":
            i += 1
        continue
    
    process(item)
    i += 1
```

Nested loops. Off-by-one errors. Index hell.

This is what other languages force you to do.

---

## 13. `jump` — Cursor Control Made Simple

`jump` lets you override the automatic cursor. It only works in item loops (ones with `it` and `idx`).

### `jump N` — Skip Ahead
```goblin
repeat: items
    if it == "header" =>
        jump 5
    xx
    
    process(it)
xx
```

Skip ahead exactly 5 items. The cursor moves, the loop continues from there.

### `jump until COND` — Scan Forward
```goblin
repeat: items
    if it == "start" =>
        jump until it == "end"
    xx
    
    handle(it)
xx
```

Scans forward until the condition is true, then continues from there.

Compare to the manual version:

**Manual (Python):**
```python
i = 0
while i < len(items):
    item = items[i]
    
    if item == "start":
        i += 1
        while i < len(items) and items[i] != "end":
            i += 1
        continue
    
    process(item)
    i += 1
```

**Goblin:**
```goblin
repeat: items
    if it == "start" => jump until it == "end"
    process(it)
xx
```

No nested loops. No manual index. Just "jump until you find the end."

### `jump N until COND` — Stride-Scan
```goblin
repeat: numbers
    jump 2 until it == 10
    :say("found {it} at idx {idx}")
xx
```

Moves forward 2 steps at a time, checking the condition after each step.

---

## 14. How `jump` Works

When you use `jump`:
1. The rest of the current loop body is skipped
2. The cursor moves forward according to your command
3. The loop continues from the new position

If the cursor goes past the end, the loop ends naturally. No errors.

**Jump only works in item loops.** Count loops and condition loops don't have a cursor, so `jump` doesn't make sense there.

---

## Real Example: Parsing a Document

You're parsing tokens where sections are marked with `START` and `END`:

**Without `jump` (Other Languages):**
```python
i = 0
sections = []

while i < len(tokens):
    token = tokens[i]
    
    if token["type"] == "comment":
        i += 1
        continue
    
    if token["type"] == "section_start":
        section_name = token["name"]
        content = []
        
        i += 1
        while i < len(tokens) and tokens[i]["type"] != "section_end":
            content.append(tokens[i])
            i += 1
        
        sections.append({"name": section_name, "content": content})
    
    i += 1
```

**With `jump` (Goblin):**
```goblin
act parse_document(tokens)
    sections | []
    
    repeat: tokens
        skip if: it["type"] == "comment"
        
        if it["type"] == "section_start" =>
            section_name | it["name"]
            content | []
            
            repeat:
                jump 1
                stop if: idx >= tokens.len
                stop if: it["type"] == "section_end"
                :put_last!(content, it)
            xx
            
            :put_last!(sections, { "name": section_name, "content": content })
        xx
    xx
    
    return sections
xx
```

No manual index management. No bounds checking. The complex case looks almost as clean as the simple case.

---

## Putting It All Together

Let's look at a more realistic example. You're building a game loop:
```goblin
act game_loop()
    player_hp | 100
    
    repeat:
        command | :read_line()
        stop if: command == "quit"
        
        if command == "heal"
            player_hp |= player_hp + 20
            :say("Healed! HP: {player_hp}")
        else if command == "damage"
            player_hp |= player_hp - 15
            :say("Ouch! HP: {player_hp}")
            stop if: player_hp <= 0
        else
            :say("Unknown command: {command}")
        xx
    xx
    
    :say("Game over!")
xx
```

This uses:
- An infinite loop (`repeat:` with no expression)
- `stop if` to exit when the player quits or dies
- Retethering (`|=`) to update player HP
- String interpolation to show current state

All the pieces working together naturally.

---

## Summary

Goblin has **one loop keyword**: `repeat`.

What you give it determines the loop type:
- Nothing → infinite
- Number → count
- Bool → conditional
- Collection → item loop
- Map → key/value loop

Inside item loops:
- `it` / `idx` are automatic
- Hidden cursor managed for you
- `jump` to override cursor when needed

Control flow:
- `skip` / `stop` / `return`
- `skip if` / `stop if` as sugar

Patterns:
- Filter with `skip if`
- Do-while with `repeat:` + `stop if`
- Complex scanning with `jump until`

No `for`. No `while`. No `foreach`. No manual indices.

Just `repeat`.