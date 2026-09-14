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
      fileName: file.name,
      fileType: file.type,
      fileBase64: base64,
      folder: folder
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url;
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
              <tr><td>${i + 1}</td><td>${esc(r.title)}</td><td>${esc(r.artist)}</td>
              <td><b>${r.listens}</b></td><td>${r.unique_listeners}</td></tr>`).join("")
            : '<tr><td colspan="5" style="color:#888">No listens logged yet</td></tr>'}
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
              <tr><td>${i + 1}</td><td>${esc(r.title)}</td><td><b>${r.likes}</b></td></tr>`).join("")
            : '<tr><td colspan="3" style="color:#888">No likes yet</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  Object.values(charts).forEach((c) => c.destroy());
  charts = {};

  const days = Object.keys(data.series7d);
  const counts = Object.values(data.series7d);

  charts["7d"] = new Chart($("#chart7d"), {
    type: "line",
    data: {
      labels: days.map((d) => d.slice(5)),
      datasets: [{
        label: "Listens", data: counts,
        borderColor: "#2E4B2A", backgroundColor: "rgba(46,75,42,0.08)",
        fill: true, tension: 0.35, pointRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  charts["pages"] = new Chart($("#chartPages"), {
    type: "bar",
    data: {
      labels: data.pages.map((p) => p.page_name),
      datasets: [{ label: "Views", data: data.pages.map((p) => p.views), backgroundColor: "#2E4B2A", borderRadius: 5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// ================= SONGS (full CRUD) =================
let editingSongId = null;

function renderSongs(songs) {
  content.innerHTML = `
    <h2>Songs</h2>
    <p class="page-sub">${songs.length} songs in your library</p>

    <div class="panel">
      <h3 id="formTitle">Add New Song</h3>
      <input type="text" id="songTitle" placeholder="Song title" style="max-width:400px">
      <input type="text" id="songArtist" placeholder="Artist name" style="max-width:400px">
      <input type="text" id="songAlbum" placeholder="Album name (optional)" style="max-width:400px">
      <label style="font-size:12px; color:#888; display:block;">MP3 File</label>
      <input type="file" id="songMp3" accept="audio/mpeg" style="max-width:400px">
      <label style="font-size:12px; color:#888; display:block; margin-top:8px;">Cover Image (optional)</label>
      <input type="file" id="songImage" accept="image/jpeg,image/png,image/webp" style="max-width:400px">
      <div style="margin-top:14px; display:flex; gap:10px;">
        <button class="btn" id="saveSongBtn">Add Song</button>
        <button class="btn secondary" id="cancelEditBtn" style="display:none;">Cancel Edit</button>
      </div>
      <div id="songStatus" class="status"></div>
    </div>

    <div class="panel">
      <h3>All Songs</h3>
      <table>
        <thead><tr><th>Cover</th><th>Title</th><th>Artist</th><th>Album</th><th>Actions</th></tr></thead>
        <tbody>
          ${songs.length
            ? songs.map((s) => `
              <tr>
                <td>${s.image_url
                  ? `<img src="${esc(s.image_url)}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;">`
                  : `<div style="width:36px;height:36px;border-radius:6px;background:#F0F0F0;"></div>`}</td>
                <td><b>${esc(s.title)}</b></td>
                <td>${esc(s.artist)}</td>
                <td>${esc(s.album || "-")}</td>
                <td>
                  <button class="btn secondary" style="padding:6px 12px;" onclick='startEdit(${JSON.stringify({ id: s.id, title: s.title, artist: s.artist, album: s.album })})'>Edit</button>
                  <button class="btn danger" style="padding:6px 12px;" onclick="deleteSong(${s.id}, '${esc(s.title)}')">Delete</button>
                </td>
              </tr>`).join("")
            : '<tr><td colspan="5" style="color:#888">No songs yet!</td></tr>'}
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
    let url = null;
    let image_url = null;
    if (mp3) url = await uploadFile(mp3, "songs");
    if (image) image_url = await uploadFile(image, "images");

    if (editingSongId) {
      const updates = { title, artist, album };
      if (url) updates.url = url;
      if (image_url) updates.image_url = image_url;
      await api("/api/songs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSongId, ...updates })
      });
      status.textContent = "Song updated!";
      resetForm();
      loadSongsSection();
    } else {
      if (!url) throw new Error("MP3 file zaroori hai (naye song ke liye)!");
      await api("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, album, url, image_url })
      });
      status.textContent = "Song added!";
      resetForm();
      loadSongsSection();
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
  $("#songTitle").value = "";
  $("#songArtist").value = "";
  $("#songAlbum").value = "";
  $("#songMp3").value = "";
  $("#songImage").value = "";
  $("#saveSongBtn").textContent = "Add Song";
  $("#cancelEditBtn").style.display = "none";
}

function startEdit(song) {
  editingSongId = song.id;
  $("#formTitle").textContent = "Edit Song: " + song.title;
  $("#songTitle").value = song.title;
  $("#songArtist").value = song.artist;
  $("#songAlbum").value = song.album || "";
  $("#songMp3").value = "";
  $("#songImage").value = "";
  $("#saveSongBtn").textContent = "Update Song";
  $("#cancelEditBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteSong(id, title) {
  if (!confirm(`"${title}" ko delete karna hai?`)) return;
  try {
    await api("/api/songs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    loadSongsSection();
  } catch (e) {
    alert("Delete failed: " + e.message);
  }
}

async function loadSongsSection() {
  content.innerHTML = '<h2>Songs</h2><p class="page-sub">Loading...</p>';
  const data = await api("/api/songs");
  renderSongs(data.songs);
}

// ================= 🆕 ALBUMS (full CRUD) =================
let editingAlbumId = null;

async function loadAlbumsSection() {
  content.innerHTML = '<h2>Albums</h2><p class="page-sub">Loading...</p>';
  const data = await api("/api/albums");
  const albums = data.albums;

  content.innerHTML = `
    <h2>Albums</h2>
    <p class="page-sub">${albums.length} albums</p>

    <div class="panel">
      <h3 id="albumFormTitle">Add New Album</h3>
      <input type="text" id="albumName" placeholder="Album name" style="max-width:400px">
      <label style="font-size:12px; color:#888; display:block;">Cover Image (optional)</label>
      <input type="file" id="albumCover" accept="image/jpeg,image/png,image/webp" style="max-width:400px">
      <div style="margin-top:14px; display:flex; gap:10px;">
        <button class="btn" id="saveAlbumBtn">Add Album</button>
        <button class="btn secondary" id="cancelAlbumEdit" style="display:none;">Cancel</button>
      </div>
      <div id="albumStatus" class="status"></div>
    </div>

    <div class="panel">
      <h3>All Albums</h3>
      <table>
        <thead><tr><th>Cover</th><th>Name</th><th>Songs</th><th>Actions</th></tr></thead>
        <tbody>
          ${albums.length
            ? albums.map((a) => `
              <tr>
                <td>${a.cover_url
                  ? `<img src="${esc(a.cover_url)}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">`
                  : `<div style="width:40px;height:40px;border-radius:6px;background:#F0F0F0;"></div>`}</td>
                <td><b>${esc(a.name)}</b></td>
                <td>${a.song_count}</td>
                <td>
                  <button class="btn secondary" style="padding:6px 12px;" onclick='startAlbumEdit(${JSON.stringify({ id: a.id, name: a.name })})'>Edit</button>
                  <button class="btn danger" style="padding:6px 12px;" onclick="deleteAlbum(${a.id}, '${esc(a.name)}')">Delete</button>
                </td>
              </tr>`).join("")
            : '<tr><td colspan="4" style="color:#888">No albums yet!</td></tr>'}
        </tbody>
      </table>
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
      await api("/api/albums", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingAlbumId, name, cover_url })
      });
      status.textContent = "Album updated!";
    } else {
      await api("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cover_url })
      });
      status.textContent = "Album added!";
    }
    resetAlbumForm();
    loadAlbumsSection();
  } catch (e) {
    status.className = "status error";
    status.textContent = "Error: " + e.message;
  }
  btn.disabled = false;
}

function resetAlbumForm() {
  editingAlbumId = null;
  $("#albumFormTitle").textContent = "Add New Album";
  $("#albumName").value = "";
  $("#albumCover").value = "";
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
    await api("/api/albums", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    loadAlbumsSection();
  } catch (e) {
    alert("Delete failed: " + e.message);
  }
}

// ================= 🆕 NOTIFICATIONS =================
async function loadNotificationsSection() {
  content.innerHTML = `
    <h2>Notifications</h2>
    <p class="page-sub">Send push notifications to all users</p>

    <div class="panel">
      <h3>Compose Notification</h3>
      <input type="text" id="notifTitle" placeholder="Title (e.g. Naya gaana aa gaya!)" style="max-width:500px">
      <textarea id="notifBody" placeholder="Message (e.g. Tere Liye ab Veena pe suno!)" rows="3" style="max-width:500px;"></textarea>
      <button class="btn" id="sendNotifBtn" style="max-width:200px;">Send Notification</button>
      <div id="notifStatus" class="status"></div>
    </div>

    <div class="panel">
      <h3>How it works</h3>
      <p style="font-size:13px; color:#666; line-height:1.7;">
        Notification sabhi registered devices par jayegi (Firebase Cloud Messaging).
        User ne notifications disable kiye hain ya app uninstall ki hai to deliver nahi hogi.
        Frequency tip: roz zyada mat bhejo — sirf important updates ke liye use karo.
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
      status.textContent = `Sent to ${data.sent} devices! (${data.failed || 0} failed)`;
    } catch (e) {
      status.className = "status error";
      status.textContent = "Error: " + e.message;
    }
    btn.disabled = false;
  });
}

// ================= STUBS =================
const SECTION_NAMES = {
  users: "Users",
  songstracking: "Songs Tracking",
  userstracking: "Users Tracking",
  pageviews: "Page Views"
};

function renderStub(key) {
  content.innerHTML = `
    <h2>${SECTION_NAMES[key]}</h2>
    <p class="page-sub">Section coming in next phase</p>
    <div class="panel" style="padding:40px; text-align:center; color:#888;">
      This section is under construction.
    </div>
  `;
}

// ================= ROUTER =================
function navigate(key) {
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.section === key);
  });

  if (key === "dashboard") {
    content.innerHTML = '<p class="page-sub">Loading dashboard...</p>';
    api("/api/stats").then(renderDashboard).catch((e) => {
      content.innerHTML = `<p class="page-sub" style="color:#C0392B">Error: ${esc(e.message)}</p>`;
    });
  } else if (key === "songs") {
    loadSongsSection();
  } else if (key === "albums") {
    loadAlbumsSection();
  } else if (key === "notifications") {
    loadNotificationsSection();
  } else {
    renderStub(key);
  }
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
