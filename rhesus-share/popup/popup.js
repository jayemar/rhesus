'use strict';

const SESSION_DURATION = 12 * 60 * 60 * 1000;

class ApiError extends Error {
  constructor(msg, sessionExpired = false) {
    super(msg);
    this.sessionExpired = sessionExpired;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function apiPost(baseUrl, data) {
  const endpoint = baseUrl.replace(/\/+$/, '') + '/tt-rss/api/';
  let resp;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (e) {
    throw new ApiError('Network error: ' + e.message);
  }
  if (!resp.ok) throw new ApiError('HTTP ' + resp.status);
  const json = await resp.json();
  if (json.status !== 0) {
    const msg = (json.content && json.content.error) || 'Unknown API error';
    throw new ApiError(msg, msg === 'NOT_LOGGED_IN');
  }
  return json.content;
}

async function login(ttrss_url, username, password) {
  const content = await apiPost(ttrss_url, { op: 'login', user: username, password });
  const session_id = content.session_id;
  await browser.storage.local.set({
    ttrss_session: { session_id, expires_at: Date.now() + SESSION_DURATION },
  });
  return session_id;
}

async function getSession(settings) {
  const stored = await browser.storage.local.get('ttrss_session');
  const cached = stored.ttrss_session;
  if (cached && cached.session_id && cached.expires_at > Date.now()) {
    return cached.session_id;
  }
  return login(settings.ttrss_url, settings.username, settings.password);
}

async function performShare(settings, sid, { title, url, note }) {
  const content = note ? '<p>' + escapeHtml(note) + '</p>' : '';

  await apiPost(settings.ttrss_url, {
    op: 'shareToPublished',
    sid,
    title,
    url,
    content,
    sanitize: false,
  });

  const headlines = await apiPost(settings.ttrss_url, {
    op: 'getHeadlines',
    sid,
    feed_id: -2,
    limit: 5,
  });

  const list = Array.isArray(headlines) ? headlines : [];
  const article = list.find(h => h.link === url) || list[0];

  if (!article) {
    throw new ApiError('Saved, but could not find article to star');
  }

  await apiPost(settings.ttrss_url, {
    op: 'updateArticle',
    sid,
    article_ids: String(article.id),
    field: 0,
    mode: 1,
  });
}

async function doShare(settings, data) {
  let sid = await getSession(settings);
  try {
    await performShare(settings, sid, data);
  } catch (err) {
    if (err.sessionExpired) {
      await browser.storage.local.remove('ttrss_session');
      sid = await login(settings.ttrss_url, settings.username, settings.password);
      await performShare(settings, sid, data);
    } else {
      throw err;
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlEl = document.getElementById('url');
  const titleEl = document.getElementById('title');
  const noteEl = document.getElementById('note');
  const saveBtn = document.getElementById('save');
  const statusEl = document.getElementById('status');
  const settingsBtn = document.getElementById('settings-link');

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab) {
    urlEl.value = tab.url || '';
    titleEl.value = tab.title || '';
  }

  const stored = await browser.storage.local.get(['ttrss_url', 'username', 'password']);
  const configured = stored.ttrss_url && stored.username && stored.password;

  if (!configured) {
    statusEl.textContent = 'Not configured.';
    statusEl.className = 'status error';
    saveBtn.disabled = true;
    settingsBtn.style.display = 'block';
  }

  settingsBtn.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
  });

  saveBtn.addEventListener('click', async () => {
    const data = {
      url: urlEl.value.trim(),
      title: titleEl.value.trim() || urlEl.value.trim(),
      note: noteEl.value.trim(),
    };

    if (!data.url) {
      statusEl.textContent = 'No URL.';
      statusEl.className = 'status error';
      return;
    }

    saveBtn.disabled = true;
    statusEl.textContent = 'Saving...';
    statusEl.className = 'status';

    const settings = {
      ttrss_url: stored.ttrss_url,
      username: stored.username,
      password: stored.password,
    };

    try {
      await doShare(settings, data);
      statusEl.textContent = 'Saved and starred.';
      statusEl.className = 'status success';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'status error';
      saveBtn.disabled = false;
    }
  });
});
