// ================= HELPERS =================
const $ = (sel) => document.querySelector(sel);
const content = $("#content");

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

// ================= 🆕 SKELETON TEMPLATES =================
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
  return `
    <h2>Loading...</h2>
    <p class="page-sub">Please wait</p>
    ${skeletonTable(6)}
  `;
}

// ================= DASHBOARD =================
let charts = {};

function renderDashboard(data) {
  const s = data.stats;

  content.innerHTML = `
    <h2>Dashboard</h2>
    <p class="page-sub">Overview of your music platform</p>

    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total Songs</div><div class="value">${s.totalSongs}</div></div>
      <div class="stat-card"><div class="label">Total Users</div><div class="value">${s.totalUsers}</div></div>
      <div class="stat-card"><div class="label">Total Listens</div><div class="value">${s.listensAll}</div></div>
      <div class="stat-card"><div class="label">Listens (7 days)</div><div class="value">${s.listens7d}</div></div>
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

  Object.values(charts).forEach((c) => c.destroy());
  charts = {};
  const days = Object.keys(data.series7d);

  charts["7d"] = new Chart($("#chart7d"), {
    type: "line",
    data: {
      labels: days.map((d) => d.slice(5)),
      datasets: [{
        label: "Listens", data: Object.values(data.series7d),
        borderColor: "#2E4B2A",
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 240);
          gradient.addColorStop(0, "rgba(46,75,42,0.25)");
          gradient.addColorStop(1, "rgba(46,75,42,0.01)");
          return gradient;
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

  charts["pages"] = new Chart($("#chartPages"), {
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

// ================= SONGS =================
let editingSongId = null;

function renderSongs(songs) {
  content.innerHTML = `
    <h2>Songs</h2>
    <p class="page-sub">${songs.length} songs in your library</p>

    <div class="panel">
      <h3 id="formTitle">Add New Song</h3>
      <input type="text" id="songTitle" placeholder="Song title" style="max-width:420px">
      <input type="text" id="songArtist" placeholder="Artist name" style="max-width:420px">
      <input type="text" id="songAlbum" placeholder="Album name (optional)" style="max-width:420px">
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
          ${songs.length ? songs.map((s) => `
            <tr>
              <td>${s.image_url
                ? `<img src="${esc(s.image_url)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">`
                : `<div style="width:40px;height:40px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;color:var(--accent);font-weight:700;">${esc(s.title[0]?.toUpperCase() || "?")}</div>`}</td>
              <td><b>${esc(s.title)}</b></td>
              <td>${esc(s.artist)}</td>
              <td>${esc(s.album) || '<span style="color:var(--text-3)">—</span>'}</td>
              <td>
                <button class="btn secondary" style="padding:7px 14px;" onclick='startEdit(${JSON.stringify({ id: s.id, title: s.title, artist: s.artist, album: s.album })})'>Edit</button>
                <button class="btn danger" style="padding:7px 14px;" onclick="deleteSong(${s.id}, '${esc(s.title)}')">Delete</button>
              </td>
            </tr>`).join("")
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
      const updates = { title, artist, album };
      if (url) updates.url = url;
      if (image_url) updates.image_url = image_url;
      await api("/api/songs", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSongId, ...updates }) });
      status.textContent = "Song updated!";
      resetForm(); loadSongsSection();
    } else {
      if (!url) throw new Error("MP3 file zaroori hai (naye song ke liye)!");
      await api("/api/songs", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, album, url, image_url }) });
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
  $("#saveSongBtn").textContent = "Add Song";
  $("#cancelEditBtn").style.display = "none";
}

function startEdit(song) {
  editingSongId = song.id;
  $("#formTitle").textContent = "Edit Song: " + song.title;
  $("#songTitle").value = song.title;
  $("#songArtist").value = song.artist;
  $("#songAlbum").value = song.album || "";
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
  content.innerHTML = skeletonPage();   // 🆕 skeleton!
  const data = await api("/api/songs");
  renderSongs(data.songs);
}

// ================= ALBUMS =================
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

  content.innerHTML = `
    <h2>Songs Tracking</h2>
    <p class="page-sub">Listening activity — last ${data.days} days</p>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total Listens (${data.days}d)</div><div class="value">${data.totals.totalListens}</div></div>
      <div class="stat-card"><div class="label">Active Users (${data.days}d)</div><div class="value">${data.totals.activeUsers}</div></div>
    </div>
    <div class="panel">
      <h3>Song Performance</h3>
      <table>
        <thead><tr><th>#</th><th>Song</th><th>Artist</th><th>Listens</th><th>Unique Listeners</th></tr></thead>
        <tbody>
          ${data.songTracking.length ? data.songTracking.map((r, i) => `
            <tr><td>${i + 1}</td><td><b>${esc(r.title)}</b></td><td>${esc(r.artist)}</td>
            <td><span class="badge green">${r.listens}</span></td><td>${r.unique_listeners}</td></tr>`).join("")
            : '<tr><td colspan="5" style="color:var(--text-3); text-align:center; padding:30px;">Koi listen nahi hua abhi — app me tracking hooks lagne ke baad data bharega</td></tr>'}
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
          ${data.userTracking.length ? data.userTracking.map((r, i) => `
            <tr><td>${i + 1}</td>
            <td>${r.user_id === "anonymous" ? '<span class="badge gray">Guest</span>' : `<code>${esc(r.user_id.slice(0, 12))}...</code>`}</td>
            <td><span class="badge green">${r.listens}</span></td>
            <td>${r.last_active ? new Date(r.last_active).toLocaleString("en-IN") : "—"}</td>
            <td><span class="badge gray">${r.status}</span></td></tr>`).join("")
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
        : '<p style="color:var(--text-3); text-align:center; padding:30px;">Koi page view logged nahi abhi — app side tracking aane ke baad data bharega.</p>'}
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
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.section === key);
  });

  function navigate(key) {
  window.currentSection = key;   // 🆕 realtime listener isko padhta hai
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.section === key);
  });

  const sections = {
    dashboard: () => {
      content.innerHTML = skeletonDashboard();
      api("/api/stats").then(renderDashboard).catch((e) => {
        content.innerHTML = `<p class="page-sub" style="color:var(--danger)">Error: ${esc(e.message)}</p>`;
      });
    },
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

navigate("dashboard");
