^^^^
title: Judge
layout: docs
summary: Judge is more than just case switching and pattern matching. 
^^^^

# Goblin Decision Constructs

*(Exclusive & Inclusive Decision Logic)*

## Overview

`judge` and `judge_all` express decision tables directly in code.

* **`judge`**: *exclusive* — first matching arm wins.
* **`judge_all`**: *inclusive* — all matching arms that evaluate truthy run (in source order) and, in expr-form, their results are collected.

This spec reflects the current implementation **plus** clearly marked planned extensions (kept compatible with your blog post semantics, including **weights**).

## Core Syntax

### Judge - Exclusive

```goblin
score = 95

grade =
    judge
        score >= 90: "A"
        score >= 80: "B"
        score >= 70: "C"
        else:         "F"
    end
```

* Evaluates top-to-bottom, stops on first truthy condition.

### Judge All - Inclusive

```goblin
balance = 45
trial_days = 5
has_new_features = true
maintenance_scheduled = false

notifications =
    judge_all
        balance < 50:          "Low balance warning"
        trial_days < 7:        "Trial expiring soon"
        has_new_features:      "Check out new tools"
        maintenance_scheduled: "Maintenance tonight"
        else:                  "All systems normal"
    end

say notifications
```

* All truthy arms run; expression-form returns an array of results in arm order.

## Subject Shorthand: Judge Using

Avoid repeating the same subject on every arm.

```goblin
score = 95

judge using score
    >= 90: say "A"
    >= 80: say "B"
    >= 70: say "C"
    else:  say "F"
end
```

Also works with `judge_all`:

```goblin
x = -3

judge_all using x
    > 0:  say "positive"
    < 0:  say "negative"
    else: say "zero"
end
```

## Enum Matching

Enums in Goblin can be matched by name using `using <EnumName>`.

```goblin
/// Enum definition and matching tests
enum Status
    idle
    loading
    ready
    error
end

enum Priority
    low
    medium
    high
    critical
end

say "=== testing judge with enum ==="
status = Status::idle
judge status using Status
    idle:    say "System is idle"
    loading: say "Processing..."
    ready:   say "Ready to proceed"
    error:   say "Error occurred"
end

priority = Priority::high
judge priority using Priority
    low:      say "Low priority"
    medium:   say "Medium priority"
    high:     say "High priority alert"
    critical: say "CRITICAL - Immediate action required"
end
```

*(Future: tagged-union payload destructuring & guards — planned, see §12.4.)*

## Arm Bodies: Expression, Statement, or Block

```goblin
x = 42
hit = "none"

judge
    x > 100: hit = "gt100"         /// inline statement
    x > 40:  "compile-only-expr"    /// inline expression (no side effect)
    x > 0:
        say "block ok"              /// block
        hit = "gt0"
    else:
        hit = "else"
end
```

* Inline **expression** result is used only in expr-form.
* Inline **statement** executes immediately.
* **Block** runs all contained statements.

Control flow (`return`, `break`, `continue`) propagates as expected; in `judge_all`, a `return` short-circuits remaining arms.

## Header Return

A shared return value for **empty** matching arms.

```goblin
judge return "ERR"
    a < 0:
    b < 0:
    c < 0:
end
```

Equivalent to inlining `return "ERR"` in each empty arm. Works with both `judge` and `judge_all`.

*(Header **do** default for non-return actions is planned; see §11.)*

## Evaluation Semantics

| Construct   | Matching Policy       | Execution                | Expression Result       |
| ----------- | --------------------- | ------------------------ | ----------------------- |
| `judge`     | First truthy arm wins | Stops after first match  | Value of arm (or `nil`) |
| `judge_all` | All truthy arms       | Runs all in source order | Array of arm results    |

* Truthiness uses standard Goblin rules (`false`/`nil` falsey; everything else truthy).
* `else` matches when no prior arm matched.

## Rich Condition Syntax (as in Goblin expressions)

* Logical ops: `and`, `or`, `not` (with `()` precedence) — **reuse normal expression grammar**.
* Chaining sugar `<>` works the same within judge conditions.
* Ranges / filters if supported elsewhere:

  ```goblin
  shipping_cost =
      judge
          weight between 0..1:   $5.00
          weight between 1..5:   $8.00
          weight between 5..20:  $12.00
          else:                  $25.00
      end
  ```
* `where`/field-DLS examples align with existing Goblin semantics.
* Field access operator `>>` used exactly as outside judge:

  ```goblin
  user_status =
      judge
          user >> "is_premium":     "premium"
          user >> "trial_expired":  "expired"
          user >> "score" < 50:     "basic"
          else:                      "standard"
      end
  ```

## Method-Chaining with Judge

Judge meshes with fluent chains for business rules:

```goblin
order =
    judge
        fraud_check(order):           order.hold.send_alert
        order >> "priority" >= 9:     order.expedite.notify_team
        payment_failed(order):        order.retry_payment.log_attempt
        inventory_check(order):       order.fulfill.notify_customer
        else:                         order.schedule_standard
    end
```

Nested decisions remain readable:

```goblin
result =
    judge
        user >> is_premium: data.enrich.prioritize.cache
        user >> is_trial:   data.basic_clean.rate_limit
        user >> score < 50:
            judge
                data.size > 1000: data.throttle
                else:             data.process_normally
            end
        else:               data.standard_process
    end
```

## Future: Weighted Judge All

Weights prioritize inclusive actions (e.g., async engines/processors). Syntax per blog post:

```goblin
actions =
    judge_all
        [10] balance >> amount < $10:     fraud_alert(transaction)
        [5]  user >> new_signup:          welcome_email(user)
        [1]  analytics >> needed:         log_event(transaction)
        else:                             standard_processing
    end
```

* Sort by descending weight; equal weights keep source order.
* Encourages priority *tiers* (e.g., `[10]` security, `[5]` UX setup, `[1]` analytics).
* Runtime integration: immediate/next-tick/deferred scheduling is an engine concern, not syntax.

Another real-world example (stacking status effects):

```goblin
status_changes =
    judge_all
        [10] spell_cast >> type == "fire" and environment >> is_cold: player.warm_up.boost_fire_damage
        [7]  potion_used >> type == "strength":                       player.double_strength.show_muscles
        [3]  area >> has_magic_field:                                   player.regenerate_mana.glow
        [1]  time >> is_night and player >> class == "vampire":       player.night_vision.bonus_stealth
        else: "No special effects"
    end
```

> **Status:** Parsing & runtime scheduling **planned** for post–v1.0; syntax reserved.

## Future: Header Do Stmt Default

Shared non-return action for **empty** matching arms.

```goblin
err_count = 0

judge do err_count = err_count + 1
    bad_input():
    timed_out():
    else: say "ok"   /// else has its own body, so default doesn't apply here
end
```

## Additional Roadmap (Post–v1.0)

### Stateful vs Snapshot 

* **Snapshot (default):** evaluate all conditions once, then run matches.
* **Stateful:** reevaluate each arm after previous arm’s effects.

```goblin
mode = "cold"
judge_all stateful
    mode == "cold":
        say "warming"
        mode = "warm"
    mode == "warm":
        say "now warm"   /// runs only in stateful
end
```

### Structured Results (expr-form)

Return a record instead of a raw array:

```goblin
res =
    judge_all structured
        x % 2 == 0: "even"
        x % 3 == 0: "div3"
        else:       "other"
    end

/// res.matched   → ["even"]
/// res.results   → ["even"]
/// res.else_hit  → false
```

### Hot-Reloadable Arms

Load rule arms from data, compile to AST, cache, and evaluate safely.

```goblin
rules = load_json("rules.json")

act apply_dynamic_rules(obj)
    judge_all from rules using obj
        else: say "no rules"
    end
end
```

### Enum Payloads (Tagged Unions)

Future: destructuring patterns with optional guards.

```goblin
ev = Event::Click(10, 20)
judge ev using Event
    Click(x, y) if x > 0 and y > 0: say ("clicked @ " + x + "," + y)
    Resize(w, h) if w*h > 10000:    say "big resize"
    Key(code) if code == "Enter":  say "enter pressed"
    Idle:                           say "idle"
end
```

## Composition

Treat each judge as a reusable rule set by wrapping in an `act`.

```goblin
act pricing_rules(cart)
    judge_all
        cart >> total >= $200: cart.apply_discount(15%)
        cart >> vip:           cart.apply_discount(10%)
        cart >> items > 5:     cart.free_shipping
        else:                  cart.add_shipping($5)
    end
end

act checkout(cart)
    pricing_rules(cart)
    cart.charge
end
```

## Implementation Status Summary

| Feature                        | Status                 |
| ------------------------------ | ---------------------- |
| `judge` / `judge_all`          | ✅                      |
| `judge using`                  | ✅                      |
| Enum name matching             | ✅                      |
| Mixed expr/stmt/block bodies   | ✅                      |
| Header `return <expr>`         | ✅                      |
| Control-flow propagation       | ✅                      |
| Weighted arms `[n]`            | 🔜 planned (post–v1.0) |
| Header `do <stmt>` default     | 🔜 planned             |
| `judge_all stateful` mode      | 🔜 planned             |
| Structured results (expr-form) | 🔜 planned             |
| Hot-reloadable arms            | 🔜 planned             |
| Enum payload destructuring     | 🔜 planned             |

**Design principle:** *Other languages evaluate; Goblin judges.*
