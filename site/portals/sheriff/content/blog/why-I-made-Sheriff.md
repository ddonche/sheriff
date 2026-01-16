^^^^
title: Why I Made Sheriff
author: Dan Donche
author_avatar: /public/avatars/dan.png
thumb: /public/images/blog/test.png
date: 2025-11-16
layout: blog
meta_kind: blog
meta_type: development
summary: The entire reason I created Sheriff, along with why I created it like this.
^^^^

I think a lot of open-source software suffers from the same problem: documentation sucks. It's one of the primary reasons a lot of new languages, frameworks, libraries, etc. don't get adopted. *No one can figure out how to use it.* That's the userland problem. It is exists because of another inconvenient truth: no one wants to *write the documentation*. 

It's not the fun part.

---

## The Road that Lead to Sheriff

Bottom line: I made a programming language called [[https://goblinlang.org|Goblin]], which I did not want to languish on account of having no documentation. I wanted a lot of people to a) like the damn thing, and b) find it really easy to learn and find information. I also wanted my error messages to be s-tier, but that's another story. 

For now, just know that I needed a way to start making documentation. So I do some research. "What's the best way to create docs or a knowledge base?" I'd used Wordpress, Joomla, Drupal et al before and you basically have to configure the entire site plus plugins, edit your whole theme, etc. ChatGPT recommended Docusaurus. 

So I tried Docusaurus. Immediately I can't figure out where to edit the look of it. The nav menu was easy enough. Where to put the markdown files. The blog. But I'll be damned if other stuff like the logo and the homepage weren't all of the place. I hated it. 

That's when I migrated to MKDocs Material. It was a much better experience. Way easier to figure out. Its docs were easier to find my way around (but still way too developer-centric). I wanted something *very easy* to work with. Like, something your grandma could use. 

And here I was making my own programming language. So I said, "Why don't I make the static site generator I want to see, but I'll make it out of Goblin." That way I can host the Goblin docs on a Goblin-made site. 

---

## A New Sheriff in Town

First, I needed a cool name. I had actually gotten the idea to rename Goblin "Cowboy". I thought that would be cool. But I'd already committed. So I went with that motif and vibe, came up with Sheriff. Made a logo with an old icon I'd already had laying around. 

---

## The Architecture

I actually just started building, but then I ran into some problems with the first iteration and had to start all over from scratch. I wanted a way for people to update Sheriff core without messing up their site. So I pushed each thing into modules. I also knew I wanted it to be able to handle multiple sites at once. And I wanted each "site" to be able to control what modules it used. I also needed the following constraints:

- no modules could know about each other; no importing modules into other modules
- Sheriff core would not know about any module whatsoever; no importing modules in Sheriff core
- each theme could dictate its own css and layout structures
- users could build one site or all sites in one go

This required me to come up with a way to import modules from a separate file: the manifest. Goblin can import a file that contains other imports. 

This also required me to come up with a way for each site (portal) to have its own event pipeline. This led me to implement the `:summon` keyword in Goblin. This allows you to write your pipeline in a separate file (per portal) and import that pipeline while passing information from one event to the next. 

Lastly, because parsing YAML was a giant pain, I created an easier type of syntax called Y'ALL. (Matches the Sheriff/wild west theme.) 

And there you have it. Sheriff is a very simple static site generator made in Goblin that your grandma can use. 