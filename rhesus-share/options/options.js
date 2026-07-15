'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const urlEl = document.getElementById('ttrss-url');
  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const passwordLabel = document.getElementById('password-label');
  const authRadios = document.querySelectorAll('input[name="auth-mode"]');
  const appPasswordHint = document.getElementById('app-password-hint');
  const saveBtn = document.getElementById('save');
  const statusEl = document.getElementById('status');

  const stored = await browser.storage.local.get(['ttrss_url', 'username', 'password', 'auth_mode']);
  if (stored.ttrss_url) urlEl.value = stored.ttrss_url;
  if (stored.username) usernameEl.value = stored.username;
  if (stored.password) passwordEl.value = stored.password;

  const savedMode = stored.auth_mode || 'password';
  authRadios.forEach(r => { r.checked = r.value === savedMode; });
  updateAuthUI(savedMode);

  authRadios.forEach(r => {
    r.addEventListener('change', () => { if (r.checked) updateAuthUI(r.value); });
  });

  function updateAuthUI(mode) {
    const isApp = mode === 'apppassword';
    passwordLabel.textContent = isApp ? 'App Password' : 'Password';
    appPasswordHint.style.display = isApp ? 'block' : 'none';
  }

  function getSelectedMode() {
    for (const r of authRadios) {
      if (r.checked) return r.value;
    }
    return 'password';
  }

  saveBtn.addEventListener('click', async () => {
    const ttrss_url = urlEl.value.trim().replace(/\/+$/, '');
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    const auth_mode = getSelectedMode();

    if (!ttrss_url) {
      statusEl.textContent = 'TT-RSS URL is required.';
      statusEl.className = 'status error';
      return;
    }
    if (!username || !password) {
      statusEl.textContent = 'Username and password are required.';
      statusEl.className = 'status error';
      return;
    }

    saveBtn.disabled = true;
    statusEl.textContent = 'Testing connection...';
    statusEl.className = 'status';

    try {
      const endpoint = ttrss_url + '/tt-rss/api/';
      let resp;
      try {
        resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'login', user: username, password }),
        });
      } catch (e) {
        throw new Error('Network error: ' + e.message);
      }

      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      if (json.status !== 0) {
        throw new Error((json.content && json.content.error) || 'Login failed');
      }

      await browser.storage.local.set({ ttrss_url, username, password, auth_mode });
      await browser.storage.local.remove('ttrss_session');

      statusEl.textContent = 'Saved. Login successful.';
      statusEl.className = 'status success';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'status error';
    } finally {
      saveBtn.disabled = false;
    }
  });
});
