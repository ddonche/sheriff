// Sheriff Desk — Sheriff SSO login (v1)
//
// Loads before admin.js. Two jobs:
//   1. Wrap fetch() so /api/ calls carry the logged-in user's Supabase access
//      token (Authorization: Bearer ...) WHEN a session exists.
//   2. Offer an optional "Log in to Cloud" button. Desk works fully logged-out
//      for local editing; login only matters for syncing to Sheriff Cloud.
//
// The session lives in localStorage under 'sheriff.session'. Supabase config
// (URL + anon key) comes from /api/config, which reads the local server's env.

(function () {
  'use strict';

  var SESSION_KEY = 'sheriff.session';

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
  function signIn(cfg, email, password) {
    return _fetch(cfg.supabase_url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': cfg.anon_key },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = {};
        try { data = JSON.parse(t); } catch (e) {}
        if (!r.ok || !data.access_token) {
          throw new Error(data.error_description || data.msg || data.error || ('login failed (HTTP ' + r.status + ')'));
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

  // ---- UI: dismissible login modal (opened by the button) -----------------
  function openLoginModal(cfg) {
    if (document.getElementById('sso-modal')) return;
    var back = document.createElement('div');
    back.id = 'sso-modal';
    back.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(6,11,22,.72);display:flex;align-items:center;justify-content:center;font-family:"IBM Plex Sans",system-ui,sans-serif;color:#e8e8f0';
    back.innerHTML =
      '<div id="sso-card" style="width:100%;max-width:380px;background:#0d1525;border:1px solid #1e2d47;border-radius:14px;padding:26px;box-sizing:border-box;position:relative">' +
        '<button id="sso-close" title="Close" style="position:absolute;top:10px;right:12px;border:none;background:none;color:#6f86a8;font-size:20px;cursor:pointer;line-height:1">&times;</button>' +
        '<h2 style="margin:0 0 4px;font-family:Bitter,serif;font-size:19px">Log in to Sheriff Cloud</h2>' +
        '<p style="margin:0 0 18px;color:#6f86a8;font-size:13px">Optional — needed only to sync with Cloud.</p>' +
        '<div id="sso-error" style="display:none;color:#fca5a5;font-size:13px;margin-bottom:12px"></div>' +
        '<input id="sso-email" type="email" placeholder="Email" autocomplete="username" style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:10px;border:1px solid #1e2d47;border-radius:8px;background:#080e1a;color:#e8e8f0;font-size:15px;outline:none">' +
        '<input id="sso-pass" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:16px;border:1px solid #1e2d47;border-radius:8px;background:#080e1a;color:#e8e8f0;font-size:15px;outline:none">' +
        '<button id="sso-submit" style="width:100%;padding:12px;border:none;border-radius:9px;background:#f29106;color:#fff;font-weight:800;font-size:15px;cursor:pointer">Log In</button>' +
      '</div>';
    document.body.appendChild(back);

    var card = back.querySelector('#sso-card');
    var errEl = back.querySelector('#sso-error');
    var emailEl = back.querySelector('#sso-email');
    var passEl = back.querySelector('#sso-pass');
    var btn = back.querySelector('#sso-submit');

    function close() { back.remove(); }
    function showErr(m) { errEl.textContent = m; errEl.style.display = 'block'; }

    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    back.querySelector('#sso-close').addEventListener('click', close);
    card.addEventListener('click', function (e) { e.stopPropagation(); });

    function submit() {
      var email = emailEl.value.trim();
      var pass = passEl.value;
      if (!email || !pass) { showErr('Enter your email and password.'); return; }
      if (!cfg.supabase_url || !cfg.anon_key) {
        showErr('Server is missing SUPABASE_URL / SUPABASE_ANON_KEY.'); return;
      }
      btn.disabled = true; btn.textContent = 'Logging in…';
      signIn(cfg, email, pass).then(function (session) {
        setSession(session);
        close();
        mountBar(cfg);
      }).catch(function (e) {
        showErr(e.message || 'Login failed.');
        btn.disabled = false; btn.textContent = 'Log In';
      });
    }

    btn.addEventListener('click', submit);
    passEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    emailEl.focus();
  }

  // ---- UI: top-right bar — "Log in" when out, email + "Log out" when in ----
  function mountBar(cfg) {
    var existing = document.getElementById('sso-userbar');
    if (existing) existing.remove();

    var bar = document.createElement('div');
    bar.id = 'sso-userbar';
    bar.style.cssText = 'position:fixed;top:8px;right:10px;z-index:9999;display:flex;align-items:center;gap:10px;font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:12px;color:#8fa6c8;background:rgba(13,21,37,.85);border:1px solid #1e2d47;border-radius:20px;padding:5px 12px';

    var session = getSession();
    if (session && session.access_token) {
      bar.innerHTML =
        '<span>' + (session.email || 'signed in') + '</span>' +
        '<button id="sso-logout" style="border:none;background:none;color:#f29106;font-weight:700;cursor:pointer;font-size:12px">Log out</button>';
      document.body.appendChild(bar);
      bar.querySelector('#sso-logout').addEventListener('click', function () {
        clearSession();
        mountBar(cfg);
      });
    } else {
      bar.innerHTML =
        '<button id="sso-login" style="border:none;background:none;color:#f29106;font-weight:700;cursor:pointer;font-size:12px">Log in to Cloud</button>';
      document.body.appendChild(bar);
      bar.querySelector('#sso-login').addEventListener('click', function () { openLoginModal(cfg); });
    }
  }

  // ---- boot: never blocks — just mounts the bar ---------------------------
  function boot() {
    loadConfig().then(function (cfg) {
      window.__SHERIFF_SSO_CFG__ = cfg;
      mountBar(cfg);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
