import { useState, useEffect } from "react";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF9F45", "#00C9FF"];

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function HabitTracker() {
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState({});
  const [newHabit, setNewHabit] = useState("");
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const today = getTodayKey();
  const last7 = getLast7Days();

  // Load from storage
  useEffect(() => {
    async function load() {
      try {
        const h = await window.storage.get("habits");
        const c = await window.storage.get("completions");
        if (h) setHabits(JSON.parse(h.value));
        if (c) setCompletions(JSON.parse(c.value));
      } catch (_) {}
      setLoaded(true);
    }
    load();
  }, []);

  // Save to storage
  useEffect(() => {
    if (!loaded) return;
    window.storage.set("habits", JSON.stringify(habits)).catch(() => {});
    window.storage.set("completions", JSON.stringify(completions)).catch(() => {});
  }, [habits, completions, loaded]);

  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    const color = COLORS[habits.length % COLORS.length];
    setHabits([...habits, { id: Date.now().toString(), name, color, createdAt: today }]);
    setNewHabit("");
    setAdding(false);
  }

  function deleteHabit(id) {
    setHabits(habits.filter(h => h.id !== id));
    const newC = { ...completions };
    Object.keys(newC).forEach(key => {
      if (key.startsWith(id + "_")) delete newC[key];
    });
    setCompletions(newC);
  }

  function toggle(habitId, date) {
    const key = `${habitId}_${date}`;
    setCompletions(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function isDone(habitId, date) {
    return !!completions[`${habitId}_${date}`];
  }

  function streak(habit) {
    let count = 0;
    let d = new Date();
    while (true) {
      const key = d.toISOString().split("T")[0];
      if (key < habit.createdAt) break;
      if (!completions[`${habit.id}_${key}`]) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  function todayCount() {
    return habits.filter(h => isDone(h.id, today)).length;
  }

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0D0D0D", color: "#fff", fontFamily: "'DM Mono', monospace" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D0D0D",
      fontFamily: "'DM Mono', monospace",
      color: "#F0EDE6",
      padding: "0 0 80px 0",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #222",
        padding: "32px 28px 24px",
        position: "sticky", top: 0, zIndex: 10,
        background: "#0D0D0D",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>
              HABIT<br />
              <span style={{ color: "#FFD93D" }}>STACK</span>
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 8, letterSpacing: "0.08em" }}>
              {formatDate(today).toUpperCase()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 800, color: "#FFD93D", lineHeight: 1 }}>
              {habits.length > 0 ? `${todayCount()}/${habits.length}` : "—"}
            </div>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>TODAY</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div style={{ height: 3, background: "#1a1a1a", margin: "0" }}>
          <div style={{
            height: "100%",
            width: `${(todayCount() / habits.length) * 100}%`,
            background: "#FFD93D",
            transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>
      )}

      {/* Habits */}
      <div style={{ padding: "24px 20px 0" }}>
        {habits.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            color: "#333", fontSize: 13, letterSpacing: "0.05em",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>◎</div>
            NO HABITS YET<br />
            <span style={{ color: "#444" }}>ADD ONE BELOW TO BEGIN</span>
          </div>
        )}

        {habits.map((habit, idx) => {
          const s = streak(habit);
          const doneToday = isDone(habit.id, today);
          return (
            <div key={habit.id} style={{
              marginBottom: 14,
              border: `1px solid ${doneToday ? habit.color + "55" : "#1e1e1e"}`,
              borderRadius: 12,
              background: doneToday ? habit.color + "0d" : "#111",
              padding: "16px 18px",
              transition: "all 0.25s",
            }}>
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: habit.color, flexShrink: 0,
                    boxShadow: doneToday ? `0 0 10px ${habit.color}88` : "none",
                    transition: "box-shadow 0.3s",
                  }} />
                  <span style={{
                    fontSize: 14, fontWeight: 500,
                    letterSpacing: "0.02em",
                    textDecoration: doneToday ? "line-through" : "none",
                    color: doneToday ? "#555" : "#F0EDE6",
                    transition: "all 0.3s",
                  }}>{habit.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {s > 0 && (
                    <div style={{
                      fontSize: 10, letterSpacing: "0.1em",
                      color: habit.color, border: `1px solid ${habit.color}44`,
                      borderRadius: 20, padding: "3px 8px",
                      fontWeight: 500,
                    }}>
                      🔥 {s}
                    </div>
                  )}
                  <button onClick={() => deleteHabit(habit.id)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#333", fontSize: 16, padding: "0 2px",
                    lineHeight: 1,
                  }}>×</button>
                </div>
              </div>

              {/* 7-day grid */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {last7.map((date, i) => {
                  const done = isDone(habit.id, date);
                  const isToday = date === today;
                  const beforeCreated = date < habit.createdAt;
                  return (
                    <div key={date} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: isToday ? "#FFD93D" : "#333", marginBottom: 5, letterSpacing: "0.05em" }}>
                        {DAYS[new Date(date + "T00:00:00").getDay()]}
                      </div>
                      <button
                        onClick={() => !beforeCreated && toggle(habit.id, date)}
                        style={{
                          width: "100%", aspectRatio: "1/1",
                          borderRadius: 6,
                          border: isToday ? `1.5px solid ${done ? habit.color : habit.color + "55"}` : `1px solid ${done ? habit.color + "66" : "#1e1e1e"}`,
                          background: done ? habit.color : "transparent",
                          cursor: beforeCreated ? "default" : "pointer",
                          opacity: beforeCreated ? 0.2 : 1,
                          transition: "all 0.2s",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: done ? "#000" : "transparent",
                        }}
                      >
                        {done ? "✓" : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Add habit */}
        {adding ? (
          <div style={{
            border: "1px solid #FFD93D44", borderRadius: 12,
            background: "#111", padding: "16px 18px",
            marginTop: 4,
          }}>
            <input
              autoFocus
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addHabit(); if (e.key === "Escape") setAdding(false); }}
              placeholder="Habit name..."
              style={{
                background: "none", border: "none", outline: "none",
                color: "#F0EDE6", fontFamily: "'DM Mono', monospace",
                fontSize: 14, width: "100%", letterSpacing: "0.02em",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={addHabit} style={{
                flex: 1, background: "#FFD93D", color: "#0D0D0D",
                border: "none", borderRadius: 8, padding: "10px",
                fontFamily: "'DM Mono', monospace", fontWeight: 500,
                fontSize: 12, cursor: "pointer", letterSpacing: "0.08em",
              }}>ADD HABIT</button>
              <button onClick={() => { setAdding(false); setNewHabit(""); }} style={{
                flex: 1, background: "none", color: "#555",
                border: "1px solid #222", borderRadius: 8, padding: "10px",
                fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer",
                letterSpacing: "0.08em",
              }}>CANCEL</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{
            width: "100%", marginTop: 4,
            border: "1px dashed #222", borderRadius: 12,
            background: "none", color: "#444",
            fontFamily: "'DM Mono', monospace", fontSize: 12,
            padding: "18px", cursor: "pointer",
            letterSpacing: "0.1em",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.target.style.borderColor = "#FFD93D44"; e.target.style.color = "#FFD93D"; }}
          onMouseLeave={e => { e.target.style.borderColor = "#222"; e.target.style.color = "#444"; }}
          >
            + NEW HABIT
          </button>
        )}
      </div>
    </div>
  );
}
