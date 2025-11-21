^^^^
title: Chapter 1
slug: chapter-one
aliases: []
hidden: false
^^^^

# Chapter 1: Your First Hero

> Generate a hero with a name, class, and stats using dice roll notation, then print them to the screen.

## Learning Objectives

* Use maps to model structured data (hero, stats, items)
* Roll simulated dice with `roll 3d6+6` notation
* Produce class-based starter gear with item properties
* Print a clean "hero card" to the console
* Understand Goblin's module system and imports

## Prerequisites

* Goblin interpreter installed
* Project directory structure created:
  ```
  echo-of-legends/
  ├── goblin.yaml
  ├── main.gbln
  ├── data/
  │   └── names.gbln
  └── game/
      └── hero.gbln
  ```

* `goblin.yaml` includes:
  ```yaml
  module_paths:
    game: ./game
    data: ./data
  ```

---

## The Big Picture

Before we build a world, we need a hero to inhabit it. In this chapter, we'll create a procedural hero generator that produces a unique character every time you run the game.

**What you'll create:**
- A hero with a randomly generated name
- A class (Warrior, Mage, Rogue, or Peasant)
- Rolled stats (health, strength, magic, agility)
- Class-specific starting equipment

This is the foundation. Every system we build later—combat, inventory, the world itself—centers on this hero.

---

## Step 1 — Create Name and Class Data

**File:** `data/names.gbln`

```goblin
/// data/names module

act get_name
  first_names = ["Gareth", "Mira", "Lysa", "Corin", "Rook", "Arin", "Nyx"]
  last_names  = ["the Bold", "Shadowstep", "Ironleaf", "Stormborn", "Ashvale", "Thorne"]
  
  first = pick 1 from first_names
  last  = pick 1 from last_names
  first ++ last
end

act get_class
  classes = ["Warrior", "Mage", "Rogue", "Peasant"]
  pick 1 from classes
end
```

**Key concepts:**
- **`pick 1 from array`:** Randomly selects one element
- **`++` operator:** String concatenation with automatic spacing
- **`act` keyword:** Defines a reusable action (like a function)
- **Final expression as return:** `first ++ last` is automatically returned

> **Note:** We'll expand these lists later. For now, keep them simple and readable.

---

## Step 2 — Create the Hero Generator

**File:** `game/hero.gbln`

```goblin
import {names} from data

act starter_gear(class) 
  judge
    class == "Warrior": [
      { id: "sword", name: "sword", type: "weapon", slot: "weapon", properties: { damage: "1d6", description: "A basic sword." } },
      { id: "shield", name: "shield", type: "armor", slot: "offhand", properties: { description: "A wooden shield." } },
      { id: "armor", name: "armor", type: "armor", slot: "body", properties: { description: "Leather armor." } }
    ]
    class == "Mage": [
      { id: "staff", name: "staff", type: "weapon", slot: "weapon", properties: { damage: "1d4", description: "A wooden staff." } },
      { id: "robe", name: "robe", type: "armor", slot: "body", properties: { description: "Simple robes." } },
      { id: "spellbook", name: "spellbook", type: "item", properties: { description: "A basic spellbook." } }
    ]
    class == "Rogue": [
      { id: "dagger", name: "dagger", type: "weapon", slot: "weapon", properties: { damage: "1d4", description: "A sharp dagger." } },
      { id: "cloak", name: "cloak", type: "armor", slot: "body", properties: { description: "A dark cloak." } },
      { id: "lockpick", name: "lockpick", type: "item", properties: { description: "Thieves' tools." } }
    ]
    else: [
      { id: "stick", name: "stick", type: "weapon", slot: "weapon", properties: { damage: "1d2", description: "A sturdy stick." } }
    ]
  end
end

/// Roll a block of classic RPG stats
act roll_stats
  health = roll 3d6+6
  strength = roll 3d6
  magic = roll 3d6
  agility = roll 3d6
  return health, strength, magic, agility
end

/// Full hero generator
act create_hero
  hero_name = names::get_name()
  hero_class = names::get_class()
  hero_stats = roll_stats()
  hero_inventory = starter_gear(hero_class)
  
  new_hero = {
    name: hero_name,
    class: hero_class,
    stats: hero_stats,
    inventory: hero_inventory,
    max_inventory: 10,
    equipped: { weapon: nil }
  }
  
  return new_hero
end

/// Create the hero at startup
hero = create_hero()

/// Display function
act show_hero
  say "=== Your Hero ==="
  say hero >> name ++ "the" ++ hero >> class
  say "Health:" ++ hero >> stats >> health
  say "Strength:" ++ hero >> stats >> strength
  say "Magic:" ++ hero >> stats >> magic
  say "Agility:" ++ hero >> stats >> agility
end
```

**Key concepts:**
- **`judge` expression:** Pattern matching for conditional logic
- **`roll 3d6+6`:** Rolls three 6-sided dice and adds 6
- **Maps as structured data:** `{ name: "Gareth", class: "Warrior", ... }`
- **Multiple return values:** `return health, strength, magic, agility`
- **Item structure:** Each item has `id`, `name`, `type`, `slot`, and `properties`
- **`>>` operator:** Access nested map properties (`hero >> stats >> health`)

> **Why item objects instead of strings?** We're building for the future. Chapter 2 will add inventory management and equipment, which needs damage values, descriptions, and item types. Starting with rich data now saves refactoring later.

---

## Step 3 — Hook into Main

**File:** `main.gbln`

```goblin
import game/hero as h

say "==================================="
say "   ECHO OF LEGENDS"
say "==================================="
say ""

h::show_hero()
```

**Key concepts:**
- **`import ... as`:** Imports a module with an alias
- **`h::`:** Calls actions from the imported module
- **Why the alias?** We use `as h` so the module namespace `h` doesn't conflict with the `hero` variable inside the module

---

## Step 4 — Run Your Game

Run the game:

```bash
goblin run main.gbln
```

**Expected output:**

```
===================================
   ECHO OF LEGENDS
===================================

=== Your Hero ===
Mira Shadowstep the Rogue
Health: 14
Strength: 12
Magic: 8
Agility: 16
```

**Try running it multiple times!** Each run generates a completely different hero. This randomness is the foundation of the roguelike experience.

---

## Step 5 — Understanding the Dice

The `roll` expression is central to roguelikes. Here's how it works:

```goblin
roll 3d6      /// Roll 3 six-sided dice, sum them (3-18)
roll 3d6+6    /// Roll 3d6 and add 6 (9-24)
roll 1d20     /// Single twenty-sided die (1-20)
roll 2d4+2    /// Roll 2 four-sided dice, add 2 (4-10)
```

**Why `3d6+6` for health?**
- Minimum: 9 (three 1s + 6)
- Maximum: 24 (three 6s + 6)
- Average: ~16.5 (balanced starting health)

**Why `3d6` for other stats?**
- Creates a bell curve (10-11 most common, 3 and 18 rare)
- Feels more balanced than pure random (1d18)
- Classic D&D-inspired stat generation

---

## Step 6 — Challenge Yourself

**Beginner Challenge:**
Add a new class (Paladin, Ranger, or Bard) with its own starter gear.

**Intermediate Challenge:**
Modify `roll_stats` to use different dice for different stats:
```goblin
health = roll 4d6+6    /// Paladins are tankier
strength = roll 2d6+6  /// Strong but focused
magic = roll 2d6       /// Less magical
```

**Advanced Challenge:**
Add a `reroll_if_weak` function that regenerates the hero if total stats are below a threshold:
```goblin
total_stats = health + strength + magic + agility
if total_stats < 40
  /// Reroll the hero
end
```

---

## Language Features Introduced

### The `judge` Expression
```goblin
judge
  condition1: value1
  condition2: value2
  else: default_value
end
```

Pattern matching for clean conditionals. Each branch returns a value.

### Dice Rolling
```goblin
roll 3d6+6  /// Roll dice notation
```

Built-in support for tabletop RPG dice notation.

### Maps and Property Access
```goblin
hero = { name: "Gareth", stats: { health: 16 } }
hero >> name         /// "Gareth"
hero >> stats >> health  /// 16
```

The `>>` operator drills into nested maps.

### String Concatenation
```goblin
"Hello" ++ "World"  /// "Hello World" (auto-spaces)
"Hello" + "World"   /// "HelloWorld" (no spaces)
```

Use `++` for natural text, `+` for precise control.

---

## What We Built

By the end of this chapter, you have:
- ✅ A procedural hero generator
- ✅ Random name and class selection
- ✅ Dice-based stat rolling
- ✅ Class-specific starting equipment with properties
- ✅ A clean display system
- ✅ Module organization (data and game logic separated)

**The Hero Exists:** This is your protagonist. Every choice we make from here—combat systems, inventory, the world itself—serves this character.

---

## Looking Ahead: Why No Save Yet?

You might be thinking: "Wait, I just rolled an amazing hero! Can I save them?"

**Not yet!** Here's why:

Right now, your hero is just stats and starter gear. But in **Chapter 4: Save/Load and Past Lives**, your hero will have:
- A **location** in the world
- A **changing inventory** (found items, dropped weapons)
- **Items on the ground** where you left them
- A **persistent world** that remembers your actions

When we add save/load in Chapter 4, we'll do it *properly*—saving your hero, the world state, and all items as a complete system.

For now? **Embrace the randomness.** Run the generator a few times. See what combinations you get. Get a feel for the procedural generation.

**Pro tip:** If you really love a hero, just don't close the terminal yet. They'll stick around until you do. 😉

---

## Design Notes

**Why start with full item objects?**
- Avoids refactoring when we add inventory (Chapter 2)
- Demonstrates Goblin's map syntax early
- Makes equipment meaningful from day one

**Why multiple return values?**
- Clean separation of concerns
- Demonstrates Goblin's tuple support
- More flexible than returning a single map

**Why the simple `judge` syntax?**
- Easy to understand for beginners
- Shows the basic pattern-matching concept
- We'll introduce `judge using` in Chapter 2 for cleaner code

---

## What's Next

In **Chapter 2: A World of One Room**, we'll:
- Create procedurally generated settlements
- Add modular weapon generation (rusty sword, iron axe, etc.)
- Implement a full inventory system
- Build a command parser for player interaction
- Let your hero actually *do* something

Your hero is ready. Now let's give them a world to explore.

**Next Chapter Preview:**
```
> look

=== The Forge & Hammer ===
A hot, smoky workshop filled with the ring of hammer on metal.

You see:
  - steel axe
  - iron sword

> take steel axe
You picked up: steel axe
```

See you in Chapter 2! ⚔️