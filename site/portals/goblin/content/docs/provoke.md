^^^^
title: Provoke
author: Sheriff Docs
layout: docs
meta_kind: docs
meta_type: keyword
summary: Provoke is Goblin's validation mechanism for enforcing constraints and requirements in your code.
^^^^

# Provoke: Validation in Goblin

Provoke is Goblin's validation mechanism for enforcing constraints and requirements in your code. It comes in three forms: inline statement, block statement, and function call.

---

## Three Forms of Provoke

### 1. Inline Statement Form

**Syntax:** `provoke => condition`

Use for quick, single-condition validation:

```goblin
act process_file(path)
    provoke => :file_exists(path)
    provoke => :ends_with(path, ".md")
    
    content | :read_text(path)
    return :render(content)
xx
```

**When it runs:**
- Evaluates the condition
- If `true`: continues silently
- If `false`: raises an error with the condition shown

---

### 2. Block Statement Form

**Syntax:**
```goblin
provoke
    condition1
    condition2
    condition3
xx
```

Use for multiple related requirements:

```goblin
act validate_user(username, email, password)
    provoke
        :len(username) >= 3
        :len(username) <= 20
        :starts_with_letter(username)
        :contains(email, "@")
        :len(password) >= 8
        :contains_uppercase(password)
        :contains_number(password)
    xx
    
    return :create_user(username, email, password)
xx
```

**Behavior:**
- Checks each condition in order
- Stops at first failure
- Shows which condition failed in the error message

---

### 3. Function Call Form

**Syntax:** `:provoke(condition)` or `:provoke(condition, message)`

Use when you need custom error messages or dynamic validation:

```goblin
act charge_card(amount, card)
    :provoke(amount > 0, "Amount must be positive")
    :provoke(card !== nil, "Card is required")
    :provoke(card["balance"] >= amount, "Insufficient funds")
    
    :deduct(card, amount)
    return :receipt(amount)
xx
```

**With custom messages:**
- First argument: condition to check
- Second argument (optional): custom error message
- Returns `true` if condition passes
- Raises error with your message if condition fails

---

## Common Use Cases

### Form Validation

```goblin
act validate_signup_form(form)
    email | form["email"]
    password | form["password"]
    age | form["age"]
    
    provoke
        email !== ""
        :contains(email, "@")
        :len(password) >= 8
        :is_num(age)
        age >= 18
    xx
    
    return { email, password, age }
xx
```

### API Input Guards

```goblin
act create_post(title, body, author_id)
    provoke => title !== ""
    provoke => :len(title) <= 200
    provoke => body !== ""
    provoke => :len(body) <= 50000
    
    :provoke(:user_exists(author_id), "Author not found")
    
    return :save_post(title, body, author_id)
xx
```

### File Processing Guards

```goblin
act process_markdown(path)
    provoke
        :file_exists(path)
        :ends_with(path, ".md")
    xx
    
    content | :read_text(path)
    
    provoke => content !== ""
    provoke => :len(content) < 1000000  // Max 1MB
    
    return :render_markdown(content)
xx
```

### Data Pipeline Validation

```goblin
act transform_data(items)
    provoke => :len(items) > 0
    
    cleaned | :map(items, :clean)
    
    provoke
        :len(cleaned) == :len(items)
        :all(cleaned, :is_valid)
    xx
    
    return :process(cleaned)
xx
```

---

## Error Messages

### Inline Form
```goblin
x | 15
provoke => x >= 18

// Error:
// Provoked constraint violated: x >= 18
//   (x was 15)
```

### Block Form
```goblin
provoke
    :len(username) >= 3
    :starts_with_letter(username)
xx

// Error (if 2nd fails):
// Provoked constraint violated: :starts_with_letter(username)
//   (username was "123abc")
```

### Function Form with Custom Message
```goblin
:provoke(age >= 21, "Must be 21 or older to purchase")

// Error:
// Must be 21 or older to purchase
```

---

## Best Practices

### 1. Front-Load Requirements

Put validation at the **top** of functions so the business logic isn't buried:

**Good:**
```goblin
act process_payment(amount, card)
    provoke
        amount > 0
        card !== nil
        card["active"] == true
    xx
    
    // Business logic here - clean and clear
    return :charge(card, amount)
xx
```

**Bad:**
```goblin
act process_payment(amount, card)
    if amount <= 0
        return :error("Invalid amount")
    xx
    if card == nil
        return :error("No card")
    xx
    if card["active"] != true
        return :error("Card inactive")
    xx
    
    // Business logic buried 12 lines down
    return :charge(card, amount)
xx
```

### 2. Use Block Form for Related Checks

Group related validations together:

```goblin
provoke
    // Email checks
    email !== ""
    :contains(email, "@")
    :len(email) <= 254
    
    // Password checks
    :len(password) >= 8
    :contains_uppercase(password)
    :contains_number(password)
xx
```

### 3. Use Custom Messages for User-Facing Errors

```goblin
:provoke(:can_access(user, resource), "You don't have permission to access this resource")
:provoke(:within_rate_limit(user), "Rate limit exceeded. Please try again later.")
```

### 4. Combine with Guard Clauses

```goblin
act process_optional_data(data)
    if data == nil => return nil
    
    provoke => :is_valid_format(data)
    
    return :transform(data)
xx
```

---

## Comparison with Assert

**Provoke** is for **validation** - checking inputs, state, and requirements.

**Assert** (future feature) will be for **debugging** - checking invariants and assumptions during development.

```goblin
// Provoke: Production validation
provoke => amount > 0

// Assert: Development check (not implemented yet)
:assert(items.len == expected_count, "Internal consistency check")
```

Use `provoke` when you want the check to **always run** in production.

---

## Summary

| Form | Syntax | Use When |
|------|--------|----------|
| Inline | `provoke => condition` | Single quick check |
| Block | `provoke\n  conditions...\nxx` | Multiple related checks |
| Function | `:provoke(condition, msg)` | Custom error messages |

**Provoke makes validation declarative, readable, and front-loaded in your functions.**