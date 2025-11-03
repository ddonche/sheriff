# Goblin Token System

A concise, copy‑paste‑ready spec for Goblin’s triple‑brace token mechanism. This is the version that matches our current parser/AST/interpreter wiring.

---

## What Tokens Are

Tokens are **module‑namespaced placeholders** that resolve to *any* Goblin value at runtime (string, number, map, array, or even an indirect reference to an action/filter).

**Syntax:**

```
{{{MODULE::IDENT}}}
```

* `MODULE` — UPPER_SNAKE namespace owned by a module/GLAM (e.g., `BRINDLE`, `SHERIFF`, `IVEKI`).
* `IDENT` — token key (UPPER_SNAKE recommended).
* Must open/close with triple braces `{{{ … }}}`.

**Examples**

```gbln
{{{BRINDLE::OBSIDIAN}}}
{{{SHERIFF::NAV_THEME}}}
{{{IVEKI::PORTAL_DEFAULTS}}}
```

---

## How It Works (Pipeline)

1. **Lexer** produces dedicated tokens: `TripleBraceOpen` `Ident` `::` `Ident` `TripleBraceClose` (or two `:` ops if `::` isn’t a fused token).
2. **Parser** recognizes the sequence and emits `PExpr::LiteralToken { module, ident, span }`.
3. **Lowering → AST** yields `Expr::LiteralToken { module: String, ident: String, span: Span }`.
4. **Interpreter** resolves in this order:

   * **(1) Registered value** in `Session` via `register_token`.
   * **(2) Module resolver**: calls `MODULE::resolve_token(name)` if no registration.
   * **(3) Error**: emits **R0101 unknown-token** with span, help, link.

This allows **eager** (registered) and **lazy** (resolver) strategies to coexist.

---

## Register vs Resolve (Choose the Right Tool)

| Option               | API                                    | When                       | Pros                                    | Cons                           |
| -------------------- | -------------------------------------- | -------------------------- | --------------------------------------- | ------------------------------ |
| **Register** (eager) | `register_token(module, ident, value)` | During module init/startup | Simple; deterministic; fast             | Static unless you re‑register  |
| **Resolve** (lazy)   | `MODULE::resolve_token(name)`          | On demand at use‑site      | Dynamic; can compute, look up env/files | User code runs at resolve‑time |

**Lookup order**: *Registered → Resolver → Error*.

You can use **only register**, **only resolve**, or **both** (register known constants, resolve computed/conditional ones).

---

## Module Authoring Convention (Plugin Hook)

Each module that exposes tokens should define an **init** action that registers its static tokens, and (optionally) a resolver for dynamic ones.

```gbln
act BRINDLE::init()
    register_token("BRINDLE","OBSIDIAN","obsidian.css")
    register_token("BRINDLE","THEME", { name: "Obsidian", css: "obsidian.css" })
end

act BRINDLE::resolve_token(name)
    judge
        name == "BUILD_TIME": return now()
        name == "CSS_PATH":   return "themes/obsidian.css"
        else:                  return nil  # no value → interpreter raises R0101
    end
end
```

> **When does Goblin read these?**
> When the actions run. Call `BRINDLE::init()` once during startup (module load, build entrypoint, or bootstrapping script). After that, any `{{{BRINDLE::IDENT}}}` usage will first check the registered store, then (if missing) call `BRINDLE::resolve_token(IDENT)`.

---

## REPL / Script Examples

```gbln
# Register + use (eager)
register_token("BRINDLE","OBSIDIAN","obsidian.css")
{{{BRINDLE::OBSIDIAN}}}  # → "obsidian.css"

# Using a map value
register_token("BRINDLE","THEME", { name: "Obsidian", css: "obsidian.css" })
{{{BRINDLE::THEME}}}      # → { name: "Obsidian", css: "obsidian.css" }

# Dynamic fallback via resolver
act BRINDLE::resolve_token(name)
    judge
        name == "DARKMODE": return true
        else: return nil
    end
end
{{{BRINDLE::DARKMODE}}}   # → true
{{{BRINDLE::MISSING}}}    # → R0101 error (unknown-token)
```

---

## Error Diagnostics (Contracts)

These are the **exact** diagnostics emitted today.

### Parse‑time shape errors

* **P0710 bad-token-shape** (e.g., missing MODULE/IDENT/`::`)

  * *help:* `Write tokens like: {{{BRINDLE::OBSIDIAN}}}`
* **P0711 unclosed-triple-brace** — missing `}}}`

  * *help:* `Close tokens like: {{{MODULE::IDENT}}}`

### Runtime resolution error

* **R0101 unknown-token**

  * *message:* `unknown token ‘MODULE::IDENT’`
  * *help:* `Register the token, provide a module resolver, or implement ‘MODULE::resolve_token(name)’.`
  * *link:* `https://goblinlang.org/docs/errors#R0101`

All errors carry `Span` for pointing into source.

---

## Token Value Types

Tokens can hold any interpreter `Value`:

* `Str("…")`, `Int/Float/Big`, `Bool`, `Map/Object`, `Array`, `Date/Time/DateTime`, etc.
* **Callable indirection**: return the *name* of an action/filter and invoke via `call_action_by_name` in userland.

**Callable example**

```gbln
act FILTERS::resolve_token(name)
    judge
        name == "SLUGIFY": return "FILTERS::slugify"
        else: return nil
    end
end

act FILTERS::slugify(text)
    return lower(replace(text, " ", "-"))
end

let f = {{{FILTERS::SLUGIFY}}}         # → "FILTERS::slugify"
# Later: call_action_by_name(sess, f, [Value::Str("Hello World")], span)
# → "hello-world"
```

---

## Best Practices

* **Namespacing**: each module registers only within *its own* namespace (`BRINDLE::…`).
* **Idempotent init**: make `MODULE::init()` safe to call more than once.
* **Determinism**: prefer register for constants; reserve resolver for IO/computation/env.
* **Documentation**: publish a table of tokens your module provides (name → type → purpose).
* **No cycles**: avoid `resolve_token` calling other tokens recursively in ways that can loop.

---

## Troubleshooting

* **`P0710 expected '::' after MODULE'`** → ensure the source literally contains `{{{NAME::KEY}}}`. Some editors auto‑replace colons; some lexers may split `::` into `":"":"` — parser accepts either `::` or two `:` ops.
* **`P0711 missing '}}}'`** → the close brace sequence must be exactly `"}}}"`.
* **`R0101 unknown-token`** → you didn’t register and the resolver returned `nil`. Fix by registering or implementing the resolver arm.
* **Span points at close braces** → expected; parser anchors token span to the closing token.

---

## Minimal Integration Checklist (for a new module)

1. Create `MODULE::init()` and register static tokens.
2. (Optional) Add `MODULE::resolve_token(name)` for dynamic values.
3. Call `MODULE::init()` during app startup/build entrypoint.
4. Use tokens anywhere in code/templates with `{{{MODULE::IDENT}}}`.
5. Document tokens in your module README.

---

## FAQ

**Q: Do I *have* to register?**
A: No. If you only implement `MODULE::resolve_token`, that’s enough.

**Q: Can tokens return complex objects?**
A: Yes — any `Value`. Consumers should know what type to expect.

**Q: Can a token be an action?**
A: Return the action’s fully‑qualified name as a string; call it via `call_action_by_name` at the use‑site.

**Q: When exactly are tokens resolved?**
A: At expression evaluation time in the interpreter; registered store first, then `MODULE::resolve_token(name)`.

---

## Reference (Signatures)

**Triple‑brace literal** → `Expr::LiteralToken { module: String, ident: String, span: Span }`

**Built‑in actions**

```gbln
# Store a value in Session
act register_token(module, ident, value)

# Resolve immediately (same path interpreter uses for triple braces)
act resolve_token(module, ident) -> value
```

**Resolver contract**

```gbln
# Called by interpreter when no registered value exists.
# Return nil to indicate “not found”.
act MODULE::resolve_token(name) -> value|nil
```

---

**That’s it.** This spec is stable and matches the current codepath (lexer → parser → AST → interpreter). Drop this doc into your repo and hand it to module authors to make their tokens first‑try correct.
