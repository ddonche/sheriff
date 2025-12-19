^^^^
title: Goblin Password Generator Recipe
author: Dan Donche
layout: docs
meta_kind: how-to
meta_type: recipe
summary: This recipe shows how to generate secure, randomized passwords using Goblin's powerful features.
^^^^

This recipe shows how to generate secure, randomized passwords using Goblin's powerful features. Each password combines random numbers, letters, and special characters, with a minimum length requirement of 16 characters. You can change this to whatever you want (12, 14, etc.). The beauty of this recipe is we will be leveraging several powerful Goblin features like `pick`, `pack`, and `mixed`.

## Ingredients

- Random numbers (3-8 digits)
- Random letters (5-12 characters)
- Random special characters (2-5 symbols)
- A dash of randomization for case mixing and shuffling

## Step 1: Prepare Your Symbol Collection

First, create a collection of special characters to use in your passwords:
```goblin
symbols = raw "!@#$%^&*()-_=+[];:<>?"
```

We use the raw keyword here so we don't get any weird escaping errors later.

## Step 2: Set Up Your Password Factory

Create an action that will generate 10 password options:
```goblin
act generate_password
    symbols = raw "!@#$%^&*()-_=+[];:<>?"
    repeat 10
        /// Recipe continues inside this loop...
    xx
xx
```

## Step 3: Determine Random Quantities

For each password, decide how many of each character type to use:
```goblin
n, l, s = [ pick 1 from 3..8, pick 1 from 5..12, pick 1 from 2..5 ]
```
For this we are using exclusive ranges with `..` but you can use inclusive `...` instead if you like.

This gives you:

- `n`: A random number between 3-7 (how many numeric digits to use)
- `l`: A random number between 5-11 (how many letters to use)
- `s`: A random number between 2-4 (how many symbols to use)

Notice here that we also use the tuple assignment with an array on the right side so we can keep it all on one line. Otherwise you'd have to do:

```goblin
n = pick 1 from 3..8
l = pick 1 from 5..12
s = pick 1 from 2..5
```

## Step 4: Generate Character Arrays

Create arrays of each character type:
```goblin
nums_arr    = pick {n} from 0...9 with dups
letters_arr = pick {l} from "a"..."z" with dups
sym_arr     = pick {s} from symbols with dups
```

Instead of hardcoding the pick count, we can use interpolation with the variables we got above using `{n}`, `{l}`, and `{s}`. Just put your variable name inside the braces. 

Here you also see that we can also pick a range of letters `from "a"..."z"` (note the inclusive `...`) instead of just numbers. Lastly, we allow duplicates in the result. If you don't want duplicates, you can use `without dups` or `wo dups` instead.

## Step 5: Pack Arrays Into Strings

Transform your arrays into usable string components:
```goblin
numbers = pack(nums_arr).str
letters = pack(letters_arr).mixed
syms    = raw pack(sym_arr)
```

Because `pick` generates an array in these circumstances, we then use `pack` to "compress" them into one number string for each. In other words, we can turn [1, 2, 3] into "123", and so on. Note that you can do the inverse of this by using `unpack` to turn a string or number into an array! So `unpack(123)` becomes [1, 2, 3]. 

Note:

- `.str` converts the packed numbers to a string
- `.mixed` randomly applies uppercase to some letters
- `raw` helps escape any special characters

## Step 6: Combine Components

Merge your components into a single string:
```goblin
password = (numbers + letters + syms)
```

Now we take all three strings and combine them into one string. Something like "123456aBcDeFgH!@#". 

Also note that we used `+` here for the concatenation, which means we don't want a space involved. If you want a space, you can always concatenate with `++` and it will automatically add a space! So `"Dave" ++ "Mustaine"` produces "Dave Mustaine" while `"Dave" + "Mustaine"` produces "DaveMustaine". 

## Step 7: Check Password Length & Finalize

Ensure the password meets minimum security requirements and shuffle for extra security:
```goblin
if password.len >= 16
    say raw shuffle(password)
xx
```

Lastly, if the generated result is greater than or equal to our minimum password requirement, we print it after randomly shuffling the characters. We do this with the keyword `say`. Also note that `shuffle` can be done on a string or a collection. 

## Step 8: Call Your Recipe

Finally, run your password generator:
```goblin
generate_password()
```

## Sample Output
Here you can see some of the passwords you can generate using this exact script:

```goblin
3FbA460egzm^&C<B]
bX4Ssn7H6!39ekP9$JL
V95d7n!_&x93j)23
4On9QA3#h=y&t4G$o
ac2q8Q(V4k)ePKL$
]XbbgIs55s6nNpk9[
r#9x2icROor75>QA6l^72
```

Why not ten passwords? Why only seven? Remember, we set the minimum password length to 16, so any that don't meet that requirement don't get printed. In this case, there were 3 passwords that weren't 16 characters long.

## Tips for those in the Horde

- Adjust the number ranges to create passwords of different strengths
- Change the minimum length (16) if you need shorter or longer passwords
- Add more special character options to the symbols string for extra variety
- Change the `with dups` flag  to `without dups` if you don't want repeated characters
- You can also use inline comments with `///` or `<----`, which you can see in the full script below (scroll to the right).

## Full Script

```goblin
act generate_password
    symbols = raw "!@#$%^&*()-_=+[];:<>?"                                           <---- here is the list of symbols we will use
    repeat 10   
        n, l, s = [ pick 1 from 3..8, pick 1 from 5..12, pick 1 from 2..5 ]         <---- get random number of each to use below                   

        nums_arr    = pick {n} from 0...9 with dups                                 <---- use rand num above to gen that many random numbers, allowing duplicates
        letters_arr = pick {l} from "a"..."z" with dups                             <---- use rand num above to gen that many random letters, allowing duplicates
        sym_arr     = pick {s} from symbols with dups                               <---- use rand num above to gen that many random symbols, allowing duplicates

        numbers  = pack(nums_arr).str                                               <---- pack generated array into one number (123456) and cast to string                            

        letters = pack(letters_arr).mixed                                           <---- pack letters array into one string and do upper and lowercase randomly (mixed)              
        syms    = raw pack(sym_arr)                                                 <---- pack symbols array into one string, use raw to escape weird symbols

        password = (numbers + letters + syms)                                       <---- concatenate numbers, letters, and symbols into one string
        if password.len >= 16                                                       <---- set min length of password
            say raw shuffle(password)                                               <---- use raw, then shuffle and display
        xx                    
    xx
xx
generate_password()                                                                 <---- call the action to gen the passwords
```

## Try It Yourself
Adjust the script to suit your needs and then try it out yourself!

- Save the full script as `password.gbln`. 
- From the correct directory (where you saved it), run `goblin run password.gbln` from your shell.
- Or test it in the server by saving it into the `api` directory, then run `goblin start`. Then in your browser, visit `http://localhost:5173/api/password` and see it in your browser!