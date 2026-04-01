/**
 * =====================================================
 *  HabitForge — app.js
 *  Full Habit Tracker App Logic
 *  Uses: LocalStorage for persistence
 *  Features: Add/Edit/Delete habits, daily check-offs,
 *            streaks, progress, calendar, stats,
 *            dark/light mode, confetti, reminders
 * =====================================================
 */

// =====================================================
// 1. CONSTANTS & DATA
// =====================================================

/** Motivational quotes shown in the banner */
const QUOTES = [
  "Small daily improvements lead to stunning results.",
  "We are what we repeatedly do. Excellence is a habit.",
  "The secret of your future is hidden in your daily routine.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Your habits will determine your future.",
  "Discipline is choosing between what you want now and what you want most.",
  "Don't count the days — make the days count.",
  "Motivation gets you going. Habit keeps you growing.",
  "A year from now you'll wish you had started today.",
  "Fall in love with the process and the results will come.",
  "Build a life you don't need a vacation from.",
  "Consistency is more important than intensity.",
];

/** Emoji icons users can pick for their habits */
const ICONS = [
  "🏋️","🧘","📚","💧","🥗","🏃","🎨","🎵","🧠","💊",
  "😴","✍️","🌿","🚴","🧹","💼","📝","🎯","🌅","🧘‍♀️",
  "🏊","🍎","☕","🎮","📱","🛒","🤸","🧗","💻","🌙",
];

/** Accent color palette for habit cards */
const COLORS = [
  "#7c6af7","#3dd68c","#ff6b7a","#ffd166","#06d6a0",
  "#ef476f","#118ab2","#fd8c04","#a663cc","#4cc9f0",
  "#f72585","#4ade80",
];

// =====================================================
// 2. STATE MANAGEMENT
// =====================================================

/**
 * All habits + completions are loaded from LocalStorage on start.
 * Structure:
 *   habits: [{id, name, icon, color, createdAt, reminder, notes}]
 *   completions: { "YYYY-MM-DD": ["habitId1", "habitId2", ...] }
 */
let habits = [];
let completions = {};   // key = dateString, value = Set of habit IDs
let currentView = "dashboard";
let calendarDate = new Date();
let calendarFilterId = "all";  // currently selected habit in calendar

// =====================================================
// 3. LOCAL STORAGE HELPERS
// =====================================================

/** Save habits array to LocalStorage */
function saveHabits() {
  localStorage.setItem("hf_habits", JSON.stringify(habits));
}

/** Save completions map to LocalStorage */
function saveCompletions() {
  // Convert Sets to Arrays for JSON serialization
  const plain = {};
  for (const [k, v] of Object.entries(completions)) {
    plain[k] = [...v];
  }
  localStorage.setItem("hf_completions", JSON.stringify(plain));
}

/** Load all data from LocalStorage on page load */
function loadData() {
  const h = localStorage.getItem("hf_habits");
  const c = localStorage.getItem("hf_completions");
  habits = h ? JSON.parse(h) : [];
  if (c) {
    const plain = JSON.parse(c);
    for (const [k, v] of Object.entries(plain)) {
      completions[k] = new Set(v);
    }
  }
  const theme = localStorage.getItem("hf_theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
}

// =====================================================
// 4. DATE HELPERS
// =====================================================

/** Returns today as "YYYY-MM-DD" */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Formats a date as "YYYY-MM-DD" */
function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

/** Returns a nice display string, e.g. "Monday, March 23" */
function formatDateDisplay(d) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// =====================================================
// 5. STREAK CALCULATOR
// =====================================================

/**
 * Calculate how many consecutive days (ending today or yesterday) a habit was completed.
 * @param {string} habitId
 * @returns {number} streak count
 */
function getStreak(habitId) {
  let streak = 0;
  const today = new Date();
  // Start from today, walk backwards
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = dateStr(d);
    if (completions[ds] && completions[ds].has(habitId)) {
      streak++;
    } else {
      break; // streak broken
    }
  }
  return streak;
}

/**
 * Calculate total completions for a habit (all time)
 */
function getTotalCompletions(habitId) {
  let count = 0;
  for (const set of Object.values(completions)) {
    if (set.has(habitId)) count++;
  }
  return count;
}

/**
 * Best (longest) streak for a habit
 */
function getBestStreak(habitId) {
  const dates = Object.keys(completions)
    .filter(d => completions[d].has(habitId))
    .sort();
  if (!dates.length) return 0;

  let best = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else { cur = 1; }
  }
  return best;
}

/**
 * Completion rate over last 30 days
 */
function getCompletionRate(habitId) {
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return 0;
  const start = new Date(habit.createdAt);
  const today = new Date();
  const daysAlive = Math.min(30, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);
  if (!daysAlive) return 0;

  let done = 0;
  for (let i = 0; i < daysAlive; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (completions[dateStr(d)]?.has(habitId)) done++;
  }
  return Math.round((done / daysAlive) * 100);
}

// =====================================================
// 6. RENDER FUNCTIONS
// =====================================================

/** Master render — updates all visible parts of the UI */
function renderAll() {
  renderDashboard();
  renderHabitsList();
  renderCalendar();
  renderStats();
  updateSidebarStats();
}

/** Render dashboard tab */
function renderDashboard() {
  document.getElementById("dateDisplay").textContent = formatDateDisplay(new Date());

  const today = todayStr();
  const todaySet = completions[today] || new Set();
  const total = habits.length;
  const done = habits.filter(h => todaySet.has(h.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bestStreak = habits.reduce((m, h) => Math.max(m, getStreak(h.id)), 0);

  // Stat cards
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statDone").textContent = done;
  document.getElementById("statStreak").textContent = bestStreak;
  document.getElementById("statPct").textContent = pct + "%";

  // Daily progress bar
  document.getElementById("dailyProgressBar").style.width = pct + "%";
  document.getElementById("dailyProgressLabel").textContent = `${done} / ${total} habits`;

  // Pending badge
  document.getElementById("pendingBadge").textContent = `${total - done} pending`;

  // Today's habit cards grid
  const grid = document.getElementById("todayHabitsGrid");
  const empty = document.getElementById("emptyDashboard");

  if (!habits.length) {
    grid.innerHTML = "";
    grid.appendChild(empty);
    return;
  }

  grid.innerHTML = habits.map(h => {
    const isCompleted = todaySet.has(h.id);
    const streak = getStreak(h.id);
    return `
      <div class="habit-card ${isCompleted ? "completed" : ""}"
           style="--habit-color: ${h.color}"
           data-id="${h.id}">
        <div class="habit-card-top">
          <div class="habit-icon-wrap">${h.icon}</div>
          <button class="check-btn" onclick="toggleHabit('${h.id}', event)" title="${isCompleted ? "Unmark" : "Mark complete"}">
            ${isCompleted ? "✓" : ""}
          </button>
        </div>
        <div class="habit-name">${escHtml(h.name)}</div>
        <div class="habit-streak">
          <span class="streak-fire">🔥</span>
          ${streak} day streak
        </div>
        ${h.notes ? `<div style="font-size:0.78rem;color:var(--text3);margin-top:6px">${escHtml(h.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

/** Render the "My Habits" list view */
function renderHabitsList() {
  const list = document.getElementById("allHabitsList");
  if (!habits.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">◎</div><p>No habits yet. Start building!</p></div>`;
    return;
  }

  list.innerHTML = habits.map(h => {
    const streak  = getStreak(h.id);
    const total   = getTotalCompletions(h.id);
    const rate    = getCompletionRate(h.id);
    const best    = getBestStreak(h.id);
    const reminder = h.reminder ? `⏰ ${h.reminder}` : "";

    return `
      <div class="habit-row" style="--habit-color: ${h.color}">
        <div class="habit-row-icon">${h.icon}</div>
        <div class="habit-row-info">
          <div class="habit-row-name">${escHtml(h.name)}</div>
          <div class="habit-row-meta">
            <span>🔥 ${streak}d streak</span>
            <span>⭐ ${best}d best</span>
            <span>✅ ${total} total</span>
            ${reminder ? `<span>${reminder}</span>` : ""}
          </div>
        </div>
        <div class="habit-row-progress">
          <div class="habit-row-progress-bar">
            <div class="habit-row-progress-fill" style="width:${rate}%;background:${h.color}"></div>
          </div>
          <div class="habit-row-pct">${rate}% (30d)</div>
        </div>
        <div class="habit-row-actions">
          <button class="btn-icon-sm" onclick="openEditModal('${h.id}')" title="Edit">✏️</button>
          <button class="btn-icon-sm danger" onclick="deleteHabit('${h.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

/** Render Calendar view */
function renderCalendar() {
  const label = document.getElementById("calMonthLabel");
  const daysEl = document.getElementById("calendarDays");
  const filterEl = document.getElementById("calendarHabitFilter");

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  label.textContent = calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Filter chips
  filterEl.innerHTML = `
    <button class="filter-chip ${calendarFilterId === "all" ? "active" : ""}"
            onclick="setCalendarFilter('all')">All Habits</button>
    ${habits.map(h => `
      <button class="filter-chip ${calendarFilterId === h.id ? "active" : ""}"
              onclick="setCalendarFilter('${h.id}')">
        ${h.icon} ${escHtml(h.name)}
      </button>
    `).join("")}
  `;

  // Build days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const today = todayStr();

  let html = "";

  // Leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const ds = dateStr(dt);
    const daySet = completions[ds] || new Set();

    let relevant; // habits relevant to the filter
    if (calendarFilterId === "all") {
      relevant = habits;
    } else {
      relevant = habits.filter(h => h.id === calendarFilterId);
    }

    const completedCount = relevant.filter(h => daySet.has(h.id)).length;
    const totalCount = relevant.length;
    const isFull = totalCount > 0 && completedCount === totalCount;
    const isPartial = completedCount > 0 && !isFull;
    const isToday = ds === today;

    let cls = "cal-day";
    if (isFull) cls += " fully-complete";
    else if (isPartial) cls += " partial has-completions";
    if (isToday) cls += " today";

    const dot = completedCount > 0 ? `<span class="day-dot"></span>` : "";

    html += `<div class="${cls}" title="${completedCount}/${totalCount} habits on ${ds}">${d}${dot}</div>`;
  }

  // Trailing days
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month">${d}</div>`;
  }

  daysEl.innerHTML = html;
}

/** Render Statistics view */
function renderStats() {
  const grid = document.getElementById("statsDetailGrid");
  const chart = document.getElementById("weeklyChart");

  if (!habits.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">◭</div><p>Add habits to see statistics</p></div>`;
    chart.innerHTML = "";
    return;
  }

  // Per-habit stat cards
  grid.innerHTML = habits.map(h => {
    const streak  = getStreak(h.id);
    const best    = getBestStreak(h.id);
    const total   = getTotalCompletions(h.id);
    const rate    = getCompletionRate(h.id);
    const created = new Date(h.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return `
      <div class="stats-habit-card" style="--habit-color:${h.color}">
        <div class="stats-habit-top">
          <div class="stats-habit-icon">${h.icon}</div>
          <div>
            <div class="stats-habit-name">${escHtml(h.name)}</div>
            <div class="stats-habit-created">Since ${created}</div>
          </div>
        </div>
        <div class="stats-nums">
          <div class="stats-num">
            <div class="stats-num-val" style="color:var(--yellow)">🔥 ${streak}</div>
            <div class="stats-num-lbl">Current</div>
          </div>
          <div class="stats-num">
            <div class="stats-num-val" style="color:var(--green)">⭐ ${best}</div>
            <div class="stats-num-lbl">Best</div>
          </div>
          <div class="stats-num">
            <div class="stats-num-val">✅ ${total}</div>
            <div class="stats-num-lbl">Total</div>
          </div>
        </div>
        <div class="stats-progress-wrap">
          <div class="stats-progress-header">
            <span>30-day completion</span>
            <span>${rate}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${rate}%;background:${h.color}"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Weekly chart — last 7 days
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }

  chart.innerHTML = days.map((d, idx) => {
    const ds = dateStr(d);
    const daySet = completions[ds] || new Set();
    const done = habits.filter(h => daySet.has(h.id)).length;
    const pct = habits.length ? Math.round((done / habits.length) * 100) : 0;
    const isToday = ds === dateStr(today);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

    return `
      <div class="weekly-bar-wrap">
        <div class="weekly-pct">${pct}%</div>
        <div class="weekly-bar-track">
          <div class="weekly-bar-fill ${isToday ? "today-bar" : ""}" style="height:${pct}%"></div>
        </div>
        <div class="weekly-day">${dayName}</div>
      </div>
    `;
  }).join("");
}

/** Update sidebar — nothing dynamic needed there currently */
function updateSidebarStats() {
  // reserved for future use (e.g. sidebar badges)
}

// =====================================================
// 7. HABIT ACTIONS
// =====================================================

/**
 * Toggle a habit's completion for today
 */
function toggleHabit(habitId, event) {
  event.stopPropagation();
  const today = todayStr();
  if (!completions[today]) completions[today] = new Set();

  if (completions[today].has(habitId)) {
    completions[today].delete(habitId);
    showToast("Habit unmarked", "");
  } else {
    completions[today].add(habitId);
    showToast("Habit completed! 🎉", "success");

    // Fire confetti if ALL habits are done for today
    const allDone = habits.every(h => completions[today].has(h.id));
    if (allDone && habits.length > 0) {
      setTimeout(() => launchConfetti(), 200);
    }
  }

  saveCompletions();
  renderAll();
  scheduleReminders(); // re-check reminders after changes
}

/**
 * Delete a habit after confirmation
 */
function deleteHabit(id) {
  if (!confirm("Delete this habit? This cannot be undone.")) return;
  habits = habits.filter(h => h.id !== id);
  // Remove from completions too (optional — keeps history if you prefer)
  saveHabits();
  showToast("Habit deleted", "");
  renderAll();
}

/**
 * Open modal in "edit" mode pre-populated with existing habit data
 */
function openEditModal(id) {
  const h = habits.find(h => h.id === id);
  if (!h) return;

  document.getElementById("modalTitle").textContent = "Edit Habit";
  document.getElementById("habitName").value = h.name;
  document.getElementById("habitReminder").value = h.reminder || "";
  document.getElementById("habitNotes").value = h.notes || "";
  document.getElementById("editingId").value = id;

  // Select icon
  document.querySelectorAll(".icon-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.icon === h.icon);
  });

  // Select color
  document.querySelectorAll(".color-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.color === h.color);
  });

  openModal();
}

// =====================================================
// 8. MODAL LOGIC
// =====================================================

function openModal() {
  document.getElementById("modalOverlay").classList.add("open");
  document.getElementById("habitName").focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  resetModal();
}

function resetModal() {
  document.getElementById("modalTitle").textContent = "Add New Habit";
  document.getElementById("habitName").value = "";
  document.getElementById("habitReminder").value = "";
  document.getElementById("habitNotes").value = "";
  document.getElementById("editingId").value = "";
  // Default select first icon & color
  document.querySelectorAll(".icon-btn").forEach((btn, i) => btn.classList.toggle("selected", i === 0));
  document.querySelectorAll(".color-btn").forEach((btn, i) => btn.classList.toggle("selected", i === 0));
}

/**
 * Build icon & color picker grids inside the modal
 */
function buildModalPickers() {
  const iconGrid = document.getElementById("iconGrid");
  iconGrid.innerHTML = ICONS.map((icon, i) => `
    <button class="icon-btn ${i === 0 ? "selected" : ""}"
            data-icon="${icon}"
            onclick="selectIcon(this)">${icon}</button>
  `).join("");

  const colorGrid = document.getElementById("colorGrid");
  colorGrid.innerHTML = COLORS.map((color, i) => `
    <button class="color-btn ${i === 0 ? "selected" : ""}"
            data-color="${color}"
            style="background:${color}"
            onclick="selectColor(this)"></button>
  `).join("");
}

function selectIcon(btn) {
  document.querySelectorAll(".icon-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function selectColor(btn) {
  document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

/**
 * Save or update a habit from the modal form
 */
function saveHabit() {
  const name = document.getElementById("habitName").value.trim();
  if (!name) { showToast("Please enter a habit name!", "error"); return; }

  const icon  = document.querySelector(".icon-btn.selected")?.dataset.icon  || "🎯";
  const color = document.querySelector(".color-btn.selected")?.dataset.color || COLORS[0];
  const reminder = document.getElementById("habitReminder").value;
  const notes    = document.getElementById("habitNotes").value.trim();
  const editingId = document.getElementById("editingId").value;

  if (editingId) {
    // Update existing
    const idx = habits.findIndex(h => h.id === editingId);
    if (idx !== -1) {
      habits[idx] = { ...habits[idx], name, icon, color, reminder, notes };
    }
    showToast("Habit updated ✓", "success");
  } else {
    // Create new
    habits.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, icon, color, reminder, notes,
      createdAt: new Date().toISOString(),
    });
    showToast("New habit added! 🚀", "success");
  }

  saveHabits();
  closeModal();
  renderAll();
  scheduleReminders();
}

// =====================================================
// 9. CALENDAR HELPERS
// =====================================================

function setCalendarFilter(id) {
  calendarFilterId = id;
  renderCalendar();
}

// =====================================================
// 10. QUOTE LOGIC
// =====================================================

function showRandomQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const el = document.getElementById("quoteText");
  el.style.opacity = 0;
  setTimeout(() => {
    el.textContent = q;
    el.style.transition = "opacity 0.4s";
    el.style.opacity = 1;
  }, 150);
}

// =====================================================
// 11. CONFETTI ANIMATION
// =====================================================

function launchConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 6 + 3,
    d: Math.random() * 120,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.07 + 0.05,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.tiltAngle += p.tiltSpeed;
      p.y += (Math.cos(p.d) + 1.5 + p.r / 2);
      p.x += Math.sin(frame / 40);
      p.tilt = Math.sin(p.tiltAngle) * 15;

      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });
    frame++;
    if (frame < 160) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// =====================================================
// 12. TOAST NOTIFICATION
// =====================================================

let toastTimer;
function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show" + (type ? " " + type : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// =====================================================
// 13. THEME TOGGLE
// =====================================================

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("hf_theme", next);
}

// =====================================================
// 14. REMINDERS (Browser Notifications)
// =====================================================

/**
 * Schedule browser notifications for habit reminders.
 * Requires Notification.requestPermission to be granted.
 */
async function scheduleReminders() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;

  const now = new Date();
  habits.forEach(h => {
    if (!h.reminder) return;
    const [rh, rm] = h.reminder.split(":").map(Number);
    const target = new Date();
    target.setHours(rh, rm, 0, 0);
    const diff = target - now;
    if (diff > 0 && diff < 86400000) { // within next 24 hours
      setTimeout(() => {
        new Notification(`⏰ HabitForge Reminder`, {
          body: `Time to complete: ${h.name} ${h.icon}`,
          icon: "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/checklist/default/24px.svg",
        });
      }, diff);
    }
  });
}

// =====================================================
// 15. VIEW SWITCHING
// =====================================================

function switchView(name) {
  currentView = name;

  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === name);
  });

  // Close mobile sidebar when navigating
  document.getElementById("sidebar").classList.remove("open");
  document.querySelector(".sidebar-overlay")?.classList.remove("show");

  renderAll();
}

// =====================================================
// 16. MOBILE SIDEBAR TOGGLE
// =====================================================

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
}

// =====================================================
// 17. UTILITY
// =====================================================

/** Escape HTML to prevent XSS */
function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// =====================================================
// 18. EVENT LISTENERS
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  // Load saved data
  loadData();

  // Build modal pickers
  buildModalPickers();

  // Show quote
  showRandomQuote();

  // Date display
  renderAll();

  // Sidebar navigation
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Add habit button
  document.getElementById("openAddModal").addEventListener("click", () => {
    document.getElementById("editingId").value = "";
    document.getElementById("modalTitle").textContent = "Add New Habit";
    resetModal();
    openModal();
  });

  // Modal close buttons
  document.getElementById("modalClose").addEventListener("click",  closeModal);
  document.getElementById("cancelModal").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modalOverlay")) closeModal();
  });

  // Save habit
  document.getElementById("saveHabit").addEventListener("click", saveHabit);
  document.getElementById("habitName").addEventListener("keydown", e => {
    if (e.key === "Enter") saveHabit();
  });

  // Theme toggles
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("themeToggleMobile").addEventListener("click", toggleTheme);

  // Quote refresh
  document.getElementById("refreshQuote").addEventListener("click", showRandomQuote);

  // Calendar nav
  document.getElementById("prevMonth").addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });

  // Mobile hamburger
  document.getElementById("hamburger").addEventListener("click", toggleSidebar);

  // Create & add sidebar overlay
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  overlay.addEventListener("click", toggleSidebar);
  document.body.appendChild(overlay);

  // Request notification permission for reminders
  scheduleReminders();
});
