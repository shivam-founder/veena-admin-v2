// ================= HELPERS =================
const $ = (sel) => document.querySelector(sel);
const content = $("#content");
let currentSection = "dashboard";

function esc(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (res.status === 401) {
    window.location.href = "/";
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file, folder) {
  const base64 = await fileToBase64(file);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name, fileType: file.type,
      fileBase64: base64, folder
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url;
}

// ================= SKELETONS =================
function skeletonDashboard() {
  return `
    <h2>Dashboard</h2>
    <p class="page-sub">Loading...</p>
    <div class="stat-grid">
      <div class="stat-card skeleton skeleton-stat"></div>
      <div class="stat-card skeleton skeleton-stat"></div>
      <div class="stat-card skeleton skeleton-stat"></div>
      <div class="stat-card skeleton skeleton-stat"></div>
    </div>
    <div class="panel"><div class="skeleton skeleton-chart"></div></div>
    <div class="panel"><div class="skeleton skeleton-chart"></div></div>
  `;
}

function skeletonTable(rows = 5) {
  let html = '<div class="panel">';
  for (let i = 0; i < rows; i++) html += '<div class="skeleton skeleton-row"></div>';
  return html + "</div>";
}

function skeletonPage() {
  return `<h2>Loading...</h2><p class="page-sub">Please wait</p>${skeletonTable(6)}`;
}

// ================= LIVE DATA STORE =================
const live = {
  stats: { totalSongs: 0, totalUsers: 0, listensAll: 0, listens7d: 0 },
  series7d: {},
  pages: [],
  charts: {},
  trackTotals: null
};

// ================= DASHBOARD =================
function renderDashboard(data) {
  const s = data.stats;
  live.stats = data.stats;
  live.series7d = data.series7d;
  live.pages = data.pages;

  content.innerHTML = `
    <h2>Dashboard</h2>
    <p class="page-sub">Overview of your music platform <span class="badge green">● LIVE</span></p>

    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total Songs</div><div class="value" id="statSongs">${s.totalSongs}</div></div>
      <div class="stat-card"><div class="label">Total Users</div><div class="value" id="statUsers">${s.totalUsers}</div></div>
      <div class="stat-card"><div class="label">Total Listens</div><div class="value" id="statListens">${s.listensAll}</div></div>
      <div class="stat-card"><div class="label">Listens (7 days)</div><div class="value" id="statListens7d">${s.listens7d}</div></div>
    </div>

    <div class="panel">
      <h3>Listens — Last 7 Days</h3>
      <div class="chart-wrap"><canvas id="chart7d"></canvas></div>
    </div>

    <div class="panel">
      <h3>Page Views</h3>
      <div class="chart-wrap"><canvas id="chartPages"></canvas></div>
    </div>

    <div class="panel">
      <h3>Top Played Songs</h3>
      <table>
        <thead><tr><th>#</th><th>Title</th><th>Artist</th><th>Listens</th><th>Unique</th></tr></thead>
        <tbody>
          ${data.topPlayed.length
            ? data.topPlayed.map((r, i) => `
              <tr><td>${i + 1}</td><td><b>${esc(r.title)}</b></td><td>${esc(r.artist)}</td>
              <td><span class="badge green">${r.listens}</span></td><td>${r.unique_listeners}</td></tr>`).join("")
            : '<tr><td colspan="5" style="color:var(--text-3)">No listens logged yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="panel">
      <h3>Top Liked Songs</h3>
      <table>
        <thead><tr><th>#</th><th>Title</th><th>Likes</th></tr></thead>
        <tbody>
          ${data.topLiked.length
            ? data.topLiked.map((r, i) => `
              <tr><td>${i + 1}</td><td><b>${esc(r.title)}</b></td><td><span class="badge green">${r.likes}</span></td></tr>`).join("")
            : '<tr><td colspan="3" style="color:var(--text-3)">No likes yet</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  Object.values(live.charts).forEach((c) => c.destroy());
  live.charts = {};
  const days = Object.keys(data.series7d);

  live.charts["7d"] = new Chart($("#chart7d"), {
    type: "line",
    data: {
      labels: days.map((d) => d.slice(5)),
      datasets: [{
        label: "Listens", data: Object.values(data.series7d),
        borderColor: "#2E4B2A",
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 240);
          g.addColorStop(0, "rgba(46,75,42,0.25)");
          g.addColorStop(1, "rgba(46,75,42,0.01)");
          return g;
        },
        fill: true, tension: 0.35, pointRadius: 3,
        pointBackgroundColor: "#2E4B2A", pointBorderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#1A1A1A", padding: 10, cornerRadius: 8, displayColors: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#F4F4F6" } },
        x: { grid: { display: false } }
      }
    }
  });

  live.charts["pages"] = new Chart($("#chartPages"), {
    type: "bar",
    data: {
      labels: data.pages.map((p) => p.page_name),
      datasets: [{
        label: "Views", data: data.pages.map((p) => p.views),
        backgroundColor: "#2E4B2A", borderRadius: 6, maxBarThickness: 40
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#1A1A1A", padding: 10, cornerRadius: 8 }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#F4F4F6" } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ================= SURGICAL LIVE UPDATES =================
function liveUpdateOnListen() {
  if (currentSection === "dashboard") {
    live.stats.listensAll++;
    live.stats.listens7d++;

    const elAll = $("#statListens");
    const el7d = $("#statListens7d");
    if (elAll) elAll.textContent = live.stats.listensAll;
    if (el7d) el7d.textContent = live.stats.listens7d;

    const today = new Date().toISOString().slice(0, 10);
    if (live.series7d[today] !== undefined) {
      live.series7d[today]++;
      const chart = live.charts["7d"];
      if (chart) {
        const idx = chart.data.labels.indexOf(today.slice(5));
        if (idx >= 0) {
          chart.data.datasets[0].data[idx] = live.series7d[today];
          chart.update("none");
        }
      }
    }
  }

  if (currentSection === "songstracking") {
    const el = $("#trackTotalListens");
    if (el && live.trackTotals) {
      live.trackTotals.totalListens++;
      el.textContent = live.trackTotals.totalListens;
    }
  }
}

function liveUpdateOnPageView(pageName) {
  let found = false;
  live.pages.forEach((p) => {
    if (p.page_name === pageName) { p.views++; found = true; }
  });
  if (!found) live.pages.push({ page_name: pageName, views: 1, unique_users: 1 });

  if (currentSection === "dashboard") {
    const chart = live.charts["pages"];
    if (chart) {
      const idx = chart.data.labels.indexOf(pageName);
      if (idx >= 0) {
        chart.data.datasets[0].data[idx]++;
        chart.update("none");
      } else {
        chart.data.labels.push(pageName);
        chart.data.datasets[0].data.push(1);
        chart.update("none");
      }
    }
  }

  if (currentSection === "pageviews") {
    const rows = document.querySelectorAll(".bar-row");
    for (const row of rows) {
      const label = row.querySelector(".bar-label")?.textContent;
      if (label === pageName) {
        const valEl = row.querySelector(".bar-value");
        const fillEl = row.querySelector(".bar-fill");
        if (valEl && fillEl) {
          const p = live.pages.find((x) => x.page_name === pageName);
          valEl.textContent = p.views;
          const maxViews = Math.max(...live.pages.map((x) => x.views), 1);
          fillEl.style.width = Math.round((p.views / maxViews) * 100) + "%";
        }
        return;
      }
    }
    const wrap = document.querySelector(".panel div");
    if (wrap) {
      const p = live.pages.find((x) => x.page_name === pageName);
      const maxViews = Math.max(...live.pages.map((x) => x.views), 1);
      const div = document.createElement("div");
      div.className = "bar-row";
      div.innerHTML = `
        <div class="bar-label">${esc(pageName)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((p.views / maxViews) * 100)}%"></div></div>
        <div class="bar-value">${p.views}</div>`;
      wrap.appendChild(div);
    }
  }
}

// ================= DASHBOARD LOAD =================
function loadDashboard() {
  content.innerHTML = skeletonDashboard();
  api("/api/stats").then(renderDashboard).catch((e) => {
    content.innerHTML = `<p class="page-sub" style="color:var(--danger)">Error: ${esc(e.message)}</p>`;
  });
}

// ================= SONGS (full CRUD + album dropdown) =================
let editingSongId = null;

function renderSongs(songs, albums) {
  content.innerHTML = `
    <h2>Songs</h2>
    <p class="page-sub">${songs.length} songs in your library</p>

    <div class="panel">
      <h3 id="formTitle">Add New Song</h3>
      <input type="text" id="songTitle" placeholder="Song title" style="max-width:420px">
      <input type="text" id="songArtist" placeholder="Artist name" style="max-width:420px">
      <select id="songAlbumId" style="max-width:420px;">
        <option value="">— No album —</option>
        ${albums.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}
      </select>
      <label style="font-size:12px; color:var(--text-3); display:block; margin-top:4px;">MP3 File</label>
      <input type="file" id="songMp3" accept="audio/mpeg" style="max-width:420px">
      <label style="font-size:12px; color:var(--text-3); display:block; margin-top:8px;">Cover Image (optional)</label>
      <input type="file" id="songImage" accept="image/jpeg,image/png,image/webp" style="max-width:420px">
      <div style="margin-top:16px; display:flex; gap:10px;">
        <button class="btn" id="saveSongBtn">Add Song</button>
        <button class="btn secondary" id="cancelEditBtn" style="display:none;">Cancel</button>
      </div>
      <div id="songStatus" class="status"></div>
    </div>

    <div class="panel">
      <h3>All Songs</h3>
      <table>
        <thead><tr><th style="width:56px;">Cover</th><th>Title</th><th>Artist</th><th>Album</th><th style="width:180px;">Actions</th></tr></thead>
        <tbody>
          ${songs.length ? songs.map((s) => {
            const albumName = albums.find((a) => a.id === s.album_id)?.name || s.album || "—";
            return `
            <tr>
              <td>${s.image_url
                ? `<img src="${esc(s.image_url)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">`
                : `<div style="width:40px;height:40px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;color:var(--accent);font-weight:700;">${esc(s.title[0]?.toUpperCase() || "?")}</div>`}</td>
              <td><b>${esc(s.title)}</b></td>
              <td>${esc(s.artist)}</td>
              <td>${esc(albumName)}</td>
              <td>
                <button class="btn secondary" style="padding:7px 14px;" onclick='startEdit(${JSON.stringify({ id: s.id, title: s.title, artist: s.artist, album: s.album, album_id: s.album_id })})'>Edit</button>
                <button class="btn danger" style="padding:7px 14px;" onclick="deleteSong(${s.id}, '${esc(s.title)}')">Delete</button>
              </td>
            </tr>`;
          }).join("")
            : '<tr><td colspan="5" style="color:var(--text-3); text-align:center; padding:30px;">No songs yet — add your first one above!</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $("#saveSongBtn").addEventListener("click", saveSong);
  $("#cancelEditBtn").addEventListener("click", resetForm);
}

async function saveSong() {
  const btn = $("#saveSongBtn");
  const status = $("#songStatus");
  const title = $("#songTitle").value.trim();
  const artist = $("#songArtist").value.trim();
  const album = $("#songAlbum").value.trim();
  const albumId = $("#songAlbumId").value || null;
  const mp3 = $("#songMp3").files[0];
  const image = $("#songImage").files[0];

  if (!title || !artist) {
    status.className = "status error";
    status.textContent = "Title aur Artist zaroori hain!";
    return;
  }
  btn.disabled = true;
  status.className = "status success";
  status.textContent = "Working...";

  try {
    let url = null, image_url = null;
    if (mp3) url = await uploadFile(mp3, "songs");
    if (image) image_url = await uploadFile(image, "images");

    if (editingSongId) {
      const updates = { title, artist, album, album_id: albumId };
      if (url) updates.url = url;
      if (image_url) updates.image_url = image_url;
      await api("/api/songs", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSongId, ...updates }) });
      status.textContent = "Song updated!";
      resetForm(); loadSongsSection();
    } else {
      if (!url) throw new Error("MP3 file zaroori hai (naye song ke liye)!");
      await api("/api/songs", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, album, url, image_url, album_id: albumId }) });
      status.textContent = "Song added!";
      resetForm(); loadSongsSection();
    }
  } catch (e) {
    status.className = "status error";
    status.textContent = "Error: " + e.message;
  }
  btn.disabled = false;
}

function resetForm() {
  editingSongId = null;
  $("#formTitle").textContent = "Add New Song";
  ["songTitle","songArtist","songAlbum","songMp3","songImage"].forEach((id) => ($("#" + id).value = ""));
  $("#songAlbumId").value = "";
  $("#saveSongBtn").textContent = "Add Song";
  $("#cancelEditBtn").style.display = "none";
}

function startEdit(song) {
  editingSongId = song.id;
  $("#formTitle").textContent = "Edit Song: " + song.title;
  $("#songTitle").value = song.title;
  $("#songArtist").value = song.artist;
  $("#songAlbum").value = song.album || "";
  $("#songAlbumId").value = song.album_id || "";
  $("#songMp3").value = ""; $("#songImage").value = "";
  $("#saveSongBtn").textContent = "Update Song";
  $("#cancelEditBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteSong(id, title) {
  if (!confirm(`"${title}" ko delete karna hai?`)) return;
  try {
    await api("/api/songs", { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }) });
    loadSongsSection();
  } catch (e) { alert("Delete failed: " + e.message); }
}

async function loadSongsSection() {
  content.innerHTML = skeletonPage();
  const [songsData, albumsData] = await Promise.all([
    api("/api/songs"),
    api("/api/albums")
  ]);
  renderSongs(songsData.songs, albumsData.albums);
}

// ================= ALBUMS (full CRUD) =================
let editingAlbumId = null;

async function loadAlbumsSection() {
  content.innerHTML = skeletonPage();
  const data = await api("/api/albums");
  const albums = data.albums;

  content.innerHTML = `
    <h2>Albums</h2>
    <p class="page-sub">${albums.length} albums</p>
    <div class="panel">
      <h3 id="albumFormTitle">Add New Album</h3>
      <input type="text" id="albumName" placeholder="Album name" style="max-width:420px">
      <label style="font-size:12px; color:var(--text-3); display:block; margin-top:4px;">Cover Image (optional)</label>
      <input type="file" id="albumCover" accept="image/jpeg,image/png,image/webp" style="max-width:420px">
      <div style="margin-top:16px; display:flex; gap:10px;">
        <button class="btn" id="saveAlbumBtn">Add Album</button>
        <button class="btn secondary" id="cancelAlbumEdit" style="display:none;">Cancel</button>
      </div>
      <div id="albumStatus" class="status"></div>
    </div>
    <div class="panel">
      <h3>All Albums</h3>
      <table>
        <thead><tr><th style="width:60px;">Cover</th><th>Name</th><th>Songs</th><th style="width:180px;">Actions</th></tr></thead>
        <tbody>
        ${albums.length ? albums.map((a) => `
          <tr>
            <td>${a.cover_url ? `<img src="${esc(a.cover_url)}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">` : `<div style="width:44px;height:44px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;color:var(--accent);font-weight:700;">${esc(a.name[0]?.toUpperCase() || "?")}</div>`}</td>
            <td><b>${esc(a.name)}</b></td>
            <td><span class="badge gray">${a.song_count} songs</span></td>
            <td>
              <button class="btn secondary" style="padding:7px 14px;" onclick='startAlbumEdit(${JSON.stringify({ id: a.id, name: a.name })})'>Edit</button>
              <button class="btn danger" style="padding:7px 14px;" onclick="deleteAlbum(${a.id}, '${esc(a.name)}')">Delete</button>
            </td>
          </tr>`).join("") : '<tr><td colspan="4" style="color:var(--text-3); text-align:center; padding:30px;">No albums yet!</td></tr>'}
        </tbody></table>
    </div>
  `;
  $("#saveAlbumBtn").addEventListener("click", saveAlbum);
  $("#cancelAlbumEdit").addEventListener("click", resetAlbumForm);
}

async function saveAlbum() {
  const btn = $("#saveAlbumBtn");
  const status = $("#albumStatus");
  const name = $("#albumName").value.trim();
  const cover = $("#albumCover").files[0];

  if (!name) {
    status.className = "status error";
    status.textContent = "Album name zaroori hai!";
    return;
  }
  btn.disabled = true;
  status.className = "status success";
  status.textContent = "Working...";
  try {
    let cover_url = null;
    if (cover) cover_url = await uploadFile(cover, "images");
    if (editingAlbumId) {
      await api("/api/albums", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingAlbumId, name, cover_url }) });
      status.textContent = "Album updated!";
    } else {
      await api("/api/albums", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cover_url }) });
      status.textContent = "Album added!";
    }
    resetAlbumForm(); loadAlbumsSection();
  } catch (e) {
    status.className = "status error";
    status.textContent = "Error: " + e.message;
  }
  btn.disabled = false;
}

function resetAlbumForm() {
  editingAlbumId = null;
  $("#albumFormTitle").textContent = "Add New Album";
  $("#albumName").value = ""; $("#albumCover").value = "";
  $("#saveAlbumBtn").textContent = "Add Album";
  $("#cancelAlbumEdit").style.display = "none";
}

function startAlbumEdit(album) {
  editingAlbumId = album.id;
  $("#albumFormTitle").textContent = "Edit Album: " + album.name;
  $("#albumName").value = album.name;
  $("#albumCover").value = "";
  $("#saveAlbumBtn").textContent = "Update Album";
  $("#cancelAlbumEdit").style.display = "inline-block";
}

async function deleteAlbum(id, name) {
  if (!confirm(`"${name}" album delete karna hai? (Songs delete NAHI honge)`)) return;
  try {
    await api("/api/albums", { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }) });
    loadAlbumsSection();
  } catch (e) { alert("Delete failed: " + e.message); }
}

// ================= NOTIFICATIONS =================
async function loadNotificationsSection() {
  content.innerHTML = `
    <h2>Notifications</h2>
    <p class="page-sub">Send push notifications to all users</p>
    <div class="panel" style="max-width:560px;">
      <h3>Compose Notification</h3>
      <input type="text" id="notifTitle" placeholder="Title (e.g. Naya gaana aa gaya!)">
      <textarea id="notifBody" placeholder="Message (e.g. Tere Liye ab Veena pe suno!)" rows="3"></textarea>
      <button class="btn" id="sendNotifBtn">Send Notification</button>
      <div id="notifStatus" class="status"></div>
    </div>
    <div class="panel">
      <h3>Guidelines</h3>
      <p style="font-size:13px; color:var(--text-2); line-height:1.8;">
        Notification sabhi registered devices par jayegi (Firebase Cloud Messaging).<br>
        Best practice: roz zyada mat bhejo — sirf important updates ke liye.<br>
        Frequency: zyada notifications = users notifications off kar dete hain.
      </p>
    </div>
  `;

  $("#sendNotifBtn").addEventListener("click", async () => {
    const btn = $("#sendNotifBtn");
    const status = $("#notifStatus");
    const title = $("#notifTitle").value.trim();
    const body = $("#notifBody").value.trim();

    if (!title || !body) {
      status.className = "status error";
      status.textContent = "Title aur message dono bharo!";
      return;
    }
    btn.disabled = true;
    status.className = "status success";
    status.textContent = "Sending...";
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      status.className = "status success";
      status.textContent = `Sent to ${data.sent} devices! (${data.failed || 0} failed)`;
    } catch (e) {
      status.className = "status error";
      status.textContent = "Error: " + e.message;
    }
    btn.disabled = false;
  });
}

// ================= SONGS TRACKING =================
async function loadSongsTrackingSection() {
  content.innerHTML = `
    <h2>Songs Tracking</h2>
    <p class="page-sub">Loading...</p>
    <div class="stat-grid">
      <div class="stat-card skeleton skeleton-stat"></div>
      <div class="stat-card skeleton skeleton-stat"></div>
    </div>
    ${skeletonTable()}
  `;
  const data = await api("/api/tracking?range=7");
  live.trackTotals = data.totals;

  content.innerHTML = `
    <h2>Songs Tracking</h2>
    <p class="page-sub">Listening activity — last ${data.days} days</p>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total Listens (${data.days}d)</div><div class="value" id="trackTotalListens">${data.totals.totalListens}</div></div>
      <div class="stat-card"><div class="label">Active Users (${data.days}d)</div><div class="value" id="trackActiveUsers">${data.totals.activeUsers}</div></div>
    </div>
    <div class="panel">
      <h3>Song Performance</h3>
      <table>
        <thead><tr><th>#</th><th>Song</th><th>Artist</th><th>Listens</th><th>Unique Listeners</th></tr></thead>
        <tbody id="trackTableBody">
          ${data.songTracking.length ? data.songTracking.map((r, i) => `
            <tr><td>${i + 1}</td><td><b>${esc(r.title)}</b></td><td>${esc(r.artist)}</td>
            <td><span class="badge green">${r.listens}</span></td><td>${r.unique_listeners}</td></tr>`).join("")
            : '<tr><td colspan="5" style="color:var(--text-3); text-align:center; padding:30px;">Koi listen nahi hua abhi</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// ================= USERS TRACKING =================
async function loadUsersTrackingSection() {
  content.innerHTML = `
    <h2>Users Tracking</h2>
    <p class="page-sub">Loading...</p>
    ${skeletonTable()}
  `;
  const data = await api("/api/tracking?range=7");

  content.innerHTML = `
    <h2>Users Tracking</h2>
    <p class="page-sub">User activity — last ${data.days} days (privacy-safe: sirf counts)</p>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Active Users</div><div class="value">${data.totals.activeUsers}</div></div>
      <div class="stat-card"><div class="label">Total Listens</div><div class="value">${data.totals.totalListens}</div></div>
    </div>
    <div class="panel">
      <h3>Users by Activity</h3>
      <table>
        <thead><tr><th>#</th><th>User</th><th>Listens</th><th>Last Active</th><th>Status</th></tr></thead>
        <tbody>
          ${data.userTracking.length ? data.userTracking.map((r, i) => {
            let userDisplay;
            if (r.user_id === "anonymous") {
              userDisplay = '<span class="badge gray">Guest</span>';
            } else if (r.name) {
              userDisplay = `<b>${esc(r.name)}</b><br><span style="font-size:11px; color:var(--text-3)">${esc(r.email)}</span>`;
            } else if (r.email) {
              userDisplay = `<b>${esc(r.email)}</b>`;
            } else {
              userDisplay = `<code>${esc(r.user_id.slice(0, 12))}...</code>`;
            }
            return `
            <tr><td>${i + 1}</td>
            <td>${userDisplay}</td>
            <td><span class="badge green">${r.listens}</span></td>
            <td>${r.last_active ? new Date(r.last_active).toLocaleString("en-IN") : "—"}</td>
            <td><span class="badge gray">${r.status}</span></td></tr>`;
          }).join("")
            : '<tr><td colspan="5" style="color:var(--text-3); text-align:center; padding:30px;">Koi activity nahi abhi</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// ================= PAGE VIEWS =================
async function loadPageViewsSection() {
  content.innerHTML = `
    <h2>Page Views</h2>
    <p class="page-sub">Loading...</p>
    <div class="panel"><div class="skeleton skeleton-chart"></div></div>
  `;
  const data = await api("/api/pageviews");
  live.pages = data.pages;
  const pages = data.pages;
  const maxViews = Math.max(...pages.map((p) => p.views), 1);

  content.innerHTML = `
    <h2>Page Views</h2>
    <p class="page-sub">Kaunsi screen pe kitni baar gaye users — ads placement ka data</p>
    <div class="panel">
      <h3>Views by Page</h3>
      ${pages.length ? pages.map((p) => `
        <div class="bar-row">
          <div class="bar-label">${esc(p.page_name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((p.views / maxViews) * 100)}%"></div></div>
          <div class="bar-value">${p.views}</div>
        </div>`).join("")
        : '<p style="color:var(--text-3); text-align:center; padding:30px;">Koi page view logged nahi abhi.</p>'}
    </div>
  `;
}

// ================= USERS =================
async function loadUsersSection() {
  content.innerHTML = skeletonPage();
  const data = await api("/api/users");
  const users = data.users;

  content.innerHTML = `
    <h2>Users</h2>
    <p class="page-sub">${users.length} registered users</p>
    <div class="panel">
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Likes</th><th>Playlists</th><th>Joined</th></tr></thead>
        <tbody>
        ${users.length ? users.map((u, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><b>${esc(u.name || "—")}</b></td>
            <td>${esc(u.email || "—")}</td>
            <td><span class="badge green">${u.likes_count}</span></td>
            <td><span class="badge gray">${u.playlists_count}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString("en-IN")}</td>
          </tr>`).join("")
          : '<tr><td colspan="6" style="color:var(--text-3); text-align:center; padding:30px;">No users yet</td></tr>'}
        </tbody></table>
    </div>
  `;
}

// ================= ROUTER =================
function navigate(key) {
  currentSection = key;
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.section === key);
  });

  const sections = {
    dashboard: loadDashboard,
    songs: loadSongsSection,
    albums: loadAlbumsSection,
    notifications: loadNotificationsSection,
    users: loadUsersSection,
    songstracking: loadSongsTrackingSection,
    userstracking: loadUsersTrackingSection,
    pageviews: loadPageViewsSection
  };

  (sections[key] || (() => {}))();
}

document.querySelectorAll("#nav a").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(a.dataset.section);
  });
});

 $("#logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/";
});

// ================= REALTIME (surgical — no full refresh!) =================
try {
  const SUPA = supabase.createClient(
    "https://thxoguhlrqrrnqwtyqkg.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoeG9ndWhscnFycm5xd3R5cWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODk3NTgsImV4cCI6MjEwNDg2NTc1OH0.hjemZBIjFU-5TKVfa8uuOA3rhvHfLnQilIaPMisvm4A"
  );

  SUPA
    .channel("live-updates")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "song_listens" }, () => {
      liveUpdateOnListen();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "page_views" }, (payload) => {
      const page = payload.new?.page_name || "unknown";
      liveUpdateOnPageView(page);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "songs" }, () => {
      if (currentSection === "songs") {
        loadSongsSection();
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "albums" }, () => {
      if (currentSection === "albums") {
        loadAlbumsSection();
      }
    })
    .subscribe();
} catch (e) {
  console.warn("Realtime init failed (non-fatal):", e);
}

// ---- Init ----
navigate("dashboard");
