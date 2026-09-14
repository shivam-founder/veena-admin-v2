// ================= HELPERS =================
const $ = (sel) => document.querySelector(sel);
const content = $("#content");

function esc(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function api(path) {
  const res = await fetch(path);
  if (res.status === 401) {
    window.location.href = "/";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}

// ================= DASHBOARD =================
let charts = {};   // chart instances destroy karne ke liye

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
        <thead><tr><th>#</th><th>Title</th><th>Artist</th><th>Listens</th><th>Unique Listeners</th></tr></thead>
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

  // ---- Charts ----
  Object.values(charts).forEach((c) => c.destroy());
  charts = {};

  const days = Object.keys(data.series7d);
  const counts = Object.values(data.series7d);

  charts["7d"] = new Chart($("#chart7d"), {
    type: "line",
    data: {
      labels: days.map((d) => d.slice(5)),
      datasets: [{
        label: "Listens",
        data: counts,
        borderColor: "#2E4B2A",
        backgroundColor: "rgba(46,75,42,0.08)",
        fill: true,
        tension: 0.35,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  charts["pages"] = new Chart($("#chartPages"), {
    type: "bar",
    data: {
      labels: data.pages.map((p) => p.page_name),
      datasets: [{
        label: "Views",
        data: data.pages.map((p) => p.views),
        backgroundColor: "#2E4B2A",
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// ================= SECTION STUBS (Phase 3+ me full banenge) =================
const SECTION_NAMES = {
  songs: "Songs",
  albums: "Albums",
  notifications: "Notifications",
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
      This section is under construction. Dashboard is live.
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
  } else {
    renderStub(key);
  }
}

// ---- Nav events ----
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

// ---- Init ----
navigate("dashboard");
