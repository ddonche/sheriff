// Sheriff Desk — Sheriff SSO login (v1)
//
// Loads before admin.js. Two jobs:
//   1. Wrap fetch() so every /api/ call carries the logged-in user's
//      Supabase access token (Authorization: Bearer ...).
//   2. Gate the panel behind a login overlay until the user has authenticated
//      against Sheriff Cloud (Supabase password grant).
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

  // ---- fetch wrapper: attach Bearer to same-origin /api/ calls ------------
  // Installed immediately so it is in place before admin.js makes any call.
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
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } });
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

  // ---- UI: login overlay --------------------------------------------------
  function buildOverlay(cfg) {
    var ov = document.createElement('div');
    ov.id = 'sso-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0d1525;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"IBM Plex Sans",system-ui,sans-serif;color:#e8e8f0;';
    ov.innerHTML =
      '<img src="/admin/logo.png" alt="Sheriff" style="height:56px;margin-bottom:24px">' +
      '<div style="width:100%;max-width:380px;background:#0d1525;border:1px solid #1e2d47;border-radius:14px;padding:28px;box-sizing:border-box">' +
        '<h2 style="margin:0 0 4px;font-family:Bitter,serif;font-size:20px">Log in to Sheriff Cloud</h2>' +
        '<p style="margin:0 0 20px;color:#6f86a8;font-size:13px">Sign in to edit and sync your content.</p>' +
        '<div id="sso-error" style="display:none;color:#fca5a5;font-size:13px;margin-bottom:12px"></div>' +
        '<input id="sso-email" type="email" placeholder="Email" autocomplete="username" style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:10px;border:1px solid #1e2d47;border-radius:8px;background:#080e1a;color:#e8e8f0;font-size:15px;outline:none">' +
        '<input id="sso-pass" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:16px;border:1px solid #1e2d47;border-radius:8px;background:#080e1a;color:#e8e8f0;font-size:15px;outline:none">' +
        '<button id="sso-submit" style="width:100%;padding:12px;border:none;border-radius:9px;background:#f29106;color:#fff;font-weight:800;font-size:15px;cursor:pointer">Log In</button>' +
      '</div>' +
      '<p style="margin-top:16px;color:#6f86a8;font-size:12px">Powered by Sheriff Cloud</p>';
    document.body.appendChild(ov);

    var errEl = ov.querySelector('#sso-error');
    var emailEl = ov.querySelector('#sso-email');
    var passEl = ov.querySelector('#sso-pass');
    var btn = ov.querySelector('#sso-submit');

    function showErr(m) { errEl.textContent = m; errEl.style.display = 'block'; }

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
        ov.remove();
        mountUserBar(session);
      }).catch(function (e) {
        showErr(e.message || 'Login failed.');
        btn.disabled = false; btn.textContent = 'Log In';
      });
    }

    btn.addEventListener('click', submit);
    passEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    emailEl.focus();
  }

  // ---- UI: small logged-in bar with logout --------------------------------
  function mountUserBar(session) {
    if (document.getElementById('sso-userbar')) return;
    var bar = document.createElement('div');
    bar.id = 'sso-userbar';
    bar.style.cssText = 'position:fixed;top:8px;right:10px;z-index:9999;display:flex;align-items:center;gap:10px;font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:12px;color:#8fa6c8;background:rgba(13,21,37,.85);border:1px solid #1e2d47;border-radius:20px;padding:5px 12px';
    bar.innerHTML =
      '<span>' + (session.email || 'signed in') + '</span>' +
      '<button id="sso-logout" style="border:none;background:none;color:#f29106;font-weight:700;cursor:pointer;font-size:12px">Log out</button>';
    document.body.appendChild(bar);
    bar.querySelector('#sso-logout').addEventListener('click', function () {
      clearSession();
      location.reload();
    });
  }

  // ---- boot ---------------------------------------------------------------
  function boot() {
    loadConfig().then(function (cfg) {
      window.__SHERIFF_SSO_CFG__ = cfg;
      var s = getSession();
      if (s && s.access_token) {
        mountUserBar(s);
      } else {
        buildOverlay(cfg);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
