(function(){
  function goblin(hljs) {
    // ---------- COMMENTS ----------
    const LINE = hljs.COMMENT('///', '$');                 // single-line
    const MULTI = {                                        // //// ... ////
      className: 'comment',
      begin: /\/\/\/\//, end: /\/\/\/\//,
      dotAll: true, greedy: true
    };
    const INLINE = {                                       // <---- ...
      className: 'comment',
      begin: /<----.*$/
    };

    // ---------- LITERALS ----------
    const LITERALS = {
      literal: 'true false nil Unit'
    };

    // ---------- STRINGS ----------
    // Interpolation: {IDENT} only (no nested/ops)
    const INTERP = {
      className: 'subst',
      begin: /\{[A-Za-z_][A-Za-z0-9_]*\}/
    };

    const STRING = {
      className: 'string',
      variants: [
        { begin: /"/, end: /"/, contains: [INTERP] },      // "..."
        { begin: /raw\s+"/, end: /"/, contains: [INTERP] },// raw "..."
        { begin: /"""/, end: /"""/, contains: [INTERP] }   // """multiline"""
      ]
    };

    // ---------- NUMBERS ----------
    const HEX = { className: 'number', begin: /\b0x[0-9A-Fa-f_]+\b/ };
    const BIN = { className: 'number', begin: /\b0b[01_]+\b/ };
    const SCI = { className: 'number',
      begin: /\b\d(?:[\d_]*\d)?(?:\.\d(?:[\d_]*\d)?)?(?:[eE][+-]?\d+)?\b/ };
    const DICE = { className: 'number', begin: /\b\d+d\d+(?:[+-]\d+)?\b/ };

    // ---------- OPERATORS / SYMBOLS ----------
    // We just color sigils; longest-first handled by regex engine as we list multi-char forms.
    const OPERATORS = {
      className: 'operator',
      // from your list:
      begin: /(>>>|>>|::|===|!===|!==|==|<=|>=|\.\.\.|\.{2}|%s|%o|\+\+|--|\*\*=?|\/\/|=>|\+=|-=|\*=|\/=|%=|<>\b|\?>|&&|\?\?|[+\-*/%_^@#=<!>&|><])/
    };
    const RANGE = { className: 'operator', begin: /\.{2,3}/ }; // .. or ...

    // ---------- IDENTIFIERS ----------
    // Case-sensitive; start [A-Za-z_], continue [A-Za-z0-9_]; allow bang forms
    const IDENT = /[A-Za-z_][A-Za-z0-9_]*/;

    const ACTION_DEF = {                                   // act name / action name / with args
      className: 'function',
      begin: /\b(?:act|action)\s+[A-Za-z_][A-Za-z0-9_]*/,
      returnBegin: true,
      contains: [
        { className: 'keyword', begin: /\b(?:act|action)\b/ },
        { className: 'title', begin: /[A-Za-z_][A-Za-z0-9_]*/ }
      ]
    };

    const MODULE_CALL = {                                  // Mod::name
      className: 'title',
      begin: /\b[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*/
    };

    const BANG_CALL = {                                    // write_text!
      className: 'built_in',
      begin: /\b[A-Za-z_][A-Za-z0-9_]*!/
    };

    const PROPERTY = { className: 'operator', begin: />>/ }; // map access

    // Triple-brace tokens {{{MODULE::TOKEN}}}
    const TRIPLE_BRACE = { className: 'subst', begin: /\{\{\{/, end: /\}\}\}/ };

    // ---------- KEYWORDS ----------
    // Hard keywords (cannot be shadowed) — exactly as provided
    const KEYWORDS = {
      keyword:
        'if elif else for in while repeat unless ' +
        'attempt rescue ensure raise say warn error ' +
        'return skip jump until stop assert ' +
        'act action enum use import export via test ' +
        'contract prefer ' +
        'judge judge_all using morph vault banish unbanish expose ' +
        'pick roll roll_detail reap map ' +
        'nc self set burn show_ids as of ' +
        'end blob',
      literal: LITERALS.literal
    };

    return {
      name: 'Goblin',
      aliases: ['gbln','gob'],
      keywords: KEYWORDS,
      contains: [
        // comments first so they win over '//' operator
        MULTI, LINE, INLINE,

        // defs & calls
        ACTION_DEF, MODULE_CALL, BANG_CALL,

        // tokens/symbols
        TRIPLE_BRACE, PROPERTY, OPERATORS, RANGE,

        // strings & numbers
        STRING, HEX, BIN, DICE, SCI
      ]
    };
  }

  if (typeof window !== 'undefined' && window.hljs) {
    window.hljs.registerLanguage('goblin', goblin);
  }
  if (typeof module !== 'undefined') {
    module.exports = goblin;
  } else {
    window.goblin = goblin;
  }
})();
