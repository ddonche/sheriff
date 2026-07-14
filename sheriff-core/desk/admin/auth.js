// Sheriff Desk — Sheriff SSO account (v2)
//
// Identity for Desk. Optional and enabling, never a gate: Desk works fully
// logged-out for local editing. Signing in is the account that connect / push
// / pull and (later) permissions + team editing all build on.
//
//   - Header shows "Sign in" (logged out) or your email + "Log out" (logged in).
//   - The login modal is Desk's native .wizard modal (declared in index.html).
//   - When a session exists, /api/ calls carry the Bearer token.
//
// Session lives in localStorage under 'sheriff.session'. Supabase config
// (URL + anon key) comes from /api/config, which reads the local server's env.

(function () {
  'use strict';

  var SESSION_KEY = 'sheriff.session';
  var cfg = {};

  // ---- session storage ----------------------------------------------------
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }
  function tokenNow() { var s = getSession(); return s && s.access_token ? s.access_token : ''; }

  // ---- fetch wrapper: attach Bearer to /api/ calls when logged in ---------
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    var isApi = url.indexOf('/api/') === 0 || url.indexOf(location.origin + '/api/') === 0;
    var tok = tokenNow();
    if (isApi && tok) {
      var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
      if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + tok);
      init = Object.assign({}, init, { headers: headers });
    }
    return _fetch(input, init);
  };

  // ---- Supabase config ----------------------------------------------------
  function loadConfig() {
    return _fetch('/api/config', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } })
      .catch(function () { return {}; });
  }

  // ---- password grant against Sheriff Cloud -------------------------------
  function signIn(email, password) {
    return _fetch(cfg.supabase_url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': cfg.anon_key },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = {};
        try { data = JSON.parse(t); } catch (e) {}
        if (!r.ok || !data.access_token) {
          throw new Error(data.error_description || data.msg || data.error || ('sign-in failed (HTTP ' + r.status + ')'));
        }
        return {
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
          expires_at: data.expires_at || 0,
          email: (data.user && data.user.email) || email
        };
      });
    });
  }

  // ---- modal (native .wizard markup in index.html) ------------------------
  function modal() { return document.getElementById('sso-modal'); }
  function showErr(m) {
    var e = document.getElementById('sso-err');
    if (!e) return;
    if (m) { e.textContent = m; e.hidden = false; } else { e.hidden = true; }
  }
  function openModal() {
    var m = modal(); if (!m) return;
    showErr('');
    m.hidden = false;
    var email = document.getElementById('sso-email');
    if (email) email.focus();
  }
  function closeModal() {
    var m = modal(); if (m) m.hidden = true;
  }
  function submitModal() {
    var email = document.getElementById('sso-email').value.trim();
    var pass = document.getElementById('sso-pass').value;
    var btn = document.getElementById('sso-submit');
    if (!email || !pass) { showErr('Enter your email and password.'); return; }
    if (!cfg.supabase_url || !cfg.anon_key) {
      showErr('Server is missing SUPABASE_URL / SUPABASE_ANON_KEY.'); return;
    }
    btn.disabled = true; btn.textContent = 'Signing in…';
    signIn(email, pass).then(function (session) {
      setSession(session);
      closeModal();
      render();
    }).catch(function (e) {
      showErr(e.message || 'Sign-in failed.');
    }).then(function () {
      btn.disabled = false; btn.textContent = 'Sign in';
    });
  }

  // ---- header account + cloud-state reflect identity ----------------------
  function render() {
    var session = getSession();
    var acct = document.getElementById('sso-acct');
    if (acct) {
      if (session && session.access_token) {
        acct.innerHTML =
          '<span class="acct-email">' + (session.email || 'signed in') + '</span>' +
          '<button class="btn ghost" type="button" id="sso-logout">Log out</button>';
        acct.querySelector('#sso-logout').addEventListener('click', function () {
          clearSession(); render();
        });
      } else {
        acct.innerHTML = '<button class="btn ghost" type="button" id="sso-signin">Sign in</button>';
        acct.querySelector('#sso-signin').addEventListener('click', openModal);
      }
    }

    // Sidebar Sheriff Cloud block reflects the same identity (it consumes it).
    var cs = document.getElementById('cloud-state');
    if (cs) {
      if (session && session.access_token) {
        cs.innerHTML = '<span class="dot" style="background:var(--teal)"></span> Signed in as ' + (session.email || 'user');
      } else {
        cs.innerHTML = '<span class="dot"></span> Not connected';
      }
    }
  }

  // ---- wire static modal controls once ------------------------------------
  function wireModal() {
    var m = modal(); if (!m) return;
    var close = document.getElementById('sso-close');
    var cancel = document.getElementById('sso-cancel');
    var submit = document.getElementById('sso-submit');
    var pass = document.getElementById('sso-pass');
    if (close) close.addEventListener('click', closeModal);
    if (cancel) cancel.addEventListener('click', closeModal);
    if (submit) submit.addEventListener('click', submitModal);
    if (pass) pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitModal(); });
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
  }

  // ---- boot: never blocks -------------------------------------------------
  function boot() {
    wireModal();
    render();
    loadConfig().then(function (c) { cfg = c || {}; window.__SHERIFF_SSO_CFG__ = cfg; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
