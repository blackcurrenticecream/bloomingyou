// made with love, for the special one — Rika 🌸
// Bloom by Unravel Labs

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────
// CONFIG — paste your keys here
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD2eqnaOcch-YpvG9vgF1u6hOyWsXZeC3g",
  authDomain: "unravellabsfr.firebaseapp.com",
  projectId: "unravellabsfr",
  storageBucket: "unravellabsfr.firebasestorage.app",
  messagingSenderId: "283465809170",
  appId: "1:283465809170:web:37fa57f79c0182b96cc7cb",
  measurementId: "G-6ZBRZ2X4CD"
};

const GROQ_API_KEY = "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";
const MODEL = "llama-3.3-70b-versatile"

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

let user         = null;
let uData        = {};
let chatMode     = "vent";
let chatHist     = [];
let miniHist     = [];
let symsSelected = [];
let periodDays   = new Set();
let diaryDays    = new Set();
let calYear      = new Date().getFullYear();
let calMonth     = new Date().getMonth();
let rangeMode    = null;
let rangeStart   = null;
let diaryDate    = null;
let memory       = "";
let epiEmoji     = "💉";
let cycleInfo    = {};

// ─────────────────────────────────────────────
// STARS
// ─────────────────────────────────────────────
function initStars() {
  const c   = document.getElementById("stars");
  const ctx = c.getContext("2d");
  let stars = [];
  const resize = () => { c.width = innerWidth; c.height = innerHeight; };
  const make = () => {
    stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random(), speed: Math.random() * .006 + .003,
      dir: Math.random() > .5 ? 1 : -1,
      drift: (Math.random() - .5) * .02,
      warm: Math.random() > .6
    }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      s.a += s.speed * s.dir;
      if (s.a > 1 || s.a < .05) s.dir *= -1;
      s.x += s.drift;
      if (s.x < 0) s.x = c.width;
      if (s.x > c.width) s.x = 0;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.warm ? `rgba(255,180,100,${s.a.toFixed(2)})` : `rgba(255,240,230,${s.a.toFixed(2)})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  };
  resize(); make(); draw();
  window.addEventListener("resize", () => { resize(); make(); });
}

function initPetals() {
  const wrap  = document.getElementById("petals");
  const emojis = ["🌸","🌺","🌷","✿","🌸","🌸"];
  for (let i = 0; i < 10; i++) {
    const el = document.createElement("span");
    el.className   = "petal";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left              = `${Math.random() * 100}%`;
    el.style.animationDuration = `${Math.random() * 18 + 14}s`;
    el.style.animationDelay    = `${-Math.random() * 20}s`;
    el.style.fontSize          = `${Math.random() * .5 + .5}rem`;
    wrap.appendChild(el);
  }
}

// ─────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────
const showScreen = id => {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(`s-${id}`).classList.add("active");
};

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
setPersistence(auth, browserLocalPersistence);

document.getElementById("btn-google").addEventListener("click", async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { console.error(e); toast("sign in failed 😭"); }
});

onAuthStateChanged(auth, async u => {
  if (u) {
    user = u;
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) { uData = snap.data(); launch(); }
    else { showScreen("onboard"); }
  } else { showScreen("auth"); }
});

window.doSignOut = async () => {
  if (confirm("sign out?")) { await signOut(auth); showScreen("auth"); }
};

// ─────────────────────────────────────────────
// ONBOARD
// ─────────────────────────────────────────────
window.obNext = async step => {
  if (step === 1) {
    const nm = document.getElementById("ob-name").value.trim();
    if (!nm) { toast("tell me your name first 🌸"); return; }
    uData.name = nm;
    document.getElementById("ob1").classList.remove("active");
    document.getElementById("ob2").classList.add("active");
    document.getElementById("ob-cycle").value = new Date().toISOString().split("T")[0];
  } else {
    const dt = document.getElementById("ob-cycle").value;
    if (!dt) { toast("pick a date 🌙"); return; }
    uData = { ...uData, cycleStart: dt, cycleLength: 28, epiName: "Epipen", epiEmoji: "💉", createdAt: new Date().toISOString(), uid: user.uid, photoURL: user.photoURL || null, settings: { checkin: true, compliments: true }, theme: "rose-gold" };
    await setDoc(doc(db, "users", user.uid), uData);
    launch();
  }
};

// ─────────────────────────────────────────────
// LAUNCH
// ─────────────────────────────────────────────
async function launch() {
  showScreen("app");
  applyTheme(uData.theme || "rose-gold");
  epiEmoji = uData.epiEmoji || "💉";
  setupTopbar();
  setupGreeting();
  computeCycle();
  fetchQuote();
  loadChatHistory();
  loadCalData();
  loadHistory();
  scheduleCompliment();

  document.getElementById("chat-in").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
  document.getElementById("mc-in").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); sendMini(); }
  });

  if (uData.settings?.checkin !== false) {
    setTimeout(() => document.getElementById("mood-gate").style.display = "flex", 600);
  }
}

// ─────────────────────────────────────────────
// TOPBAR
// ─────────────────────────────────────────────
function setupTopbar() {
  const wrap = document.getElementById("av-wrap");
  wrap.innerHTML = "";
  if (uData.photoURL) {
    const img = document.createElement("img");
    img.src = uData.photoURL; img.alt = uData.name;
    wrap.appendChild(img);
  } else {
    const d = document.createElement("div");
    d.className = "av-fallback";
    d.style.cssText = "width:34px;height:34px;border-radius:50%;border:2px solid var(--accent);background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;cursor:pointer";
    d.textContent = (uData.name || "B")[0].toUpperCase();
    wrap.appendChild(d);
  }
  // sync epipen name/emoji everywhere
  const en = uData.epiName || "Epipen";
  const ee = uData.epiEmoji || "💉";
  epiEmoji = ee;
  document.getElementById("epi-nm").textContent        = en;
  document.getElementById("epi-pill-ico").textContent  = ee;
  document.getElementById("epi-pill-name").textContent = en;
  document.getElementById("mc-name-lbl").textContent   = `${ee} ${en}`;
  document.getElementById("nav-epi-ico").textContent   = ee;
  document.getElementById("epi-av").textContent        = ee;
}

// ─────────────────────────────────────────────
// GREETING
// ─────────────────────────────────────────────
function setupGreeting() {
  const h  = new Date().getHours();
  const gt = h < 12 ? "good morning" : h < 17 ? "good afternoon" : h < 21 ? "good evening" : "hey night owl ✨";
  document.getElementById("gr-time").textContent = gt;
  document.getElementById("gr-name").textContent = uData.name || "bestie";
}

// ─────────────────────────────────────────────
// CYCLE
// ─────────────────────────────────────────────
function computeCycle() {
  if (!uData.cycleStart) return;
  const start  = new Date(uData.cycleStart);
  const today  = new Date();
  const diff   = Math.floor((today - start) / 86400000);
  const len    = uData.cycleLength || 28;
  const day    = (diff % len) + 1;
  let phase, phaseName, emoji;

  if (day <= 5)       { phase = "menstrual";  phaseName = "Womenstrual";  emoji = "🔴"; }
  else if (day <= 13) { phase = "follicular"; phaseName = "Follicular";   emoji = "🌱"; }
  else if (day <= 16) { phase = "ovulation";  phaseName = "Ovulation";    emoji = "✨"; }
  else                { phase = "luteal";     phaseName = "Luteal";       emoji = "🌙"; }

  cycleInfo = { day, phase, phaseName, emoji, len };

  const els = {
    "t-day":      `Day ${day}`,
    "t-phase":    phaseName,
    "t-phase-ico": emoji,
    "pc-day":     `Day ${day}`,
    "pc-phase":   phaseName,
    "pc-emoji":   emoji
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
  loadPhaseMsg();
}

window.loadPhaseMsg = async () => {
  const el = document.getElementById("phase-msg-txt");
  if (!el) return;
  el.textContent = "generating your message...";
  try {
    const msg = await groq(`Generate a short warm personal message (2-3 sentences) for ${uData.name || "her"} who is on Day ${cycleInfo.day} of her cycle in the ${cycleInfo.phaseName} phase. Be specific to this phase — reference energy, mood, what she might feel physically. Sound like a caring friend who gets it, not a doctor. Hinglish is fine. One small encouragement at the end.`, 0.9, 180);
    el.textContent = msg;
  } catch { el.textContent = "you're doing amazing. that's it, that's the message. 🌸"; }
};

// ─────────────────────────────────────────────
// QUOTE
// ─────────────────────────────────────────────
window.fetchQuote = async () => {
  const el = document.getElementById("q-text");
  el.textContent = "loading...";
  try {
    const q = await groq(`Write ONE beautiful original quote for a woman who loves music, skincare, food (especially burritos), fitness goals, studying hard, and her friends. Make it feel genuinely written for her — poetic, empowering, specific. No generic girlboss stuff. No quotation marks. Just the quote.`, 1.0, 70);
    el.textContent = q;
  } catch { el.textContent = "she is not a phase. she is the whole season."; }
};

// ─────────────────────────────────────────────
// MOOD
// ─────────────────────────────────────────────
const moodEmojis = ["😭","😢","😔","😞","😐","🙂","😊","🌸","✨","🔥"];

window.openGate  = () => document.getElementById("mood-gate").style.display = "flex";
window.closeGate = () => document.getElementById("mood-gate").style.display = "none";

window.onMeter = val => {
  const idx = Math.min(Math.floor((parseFloat(val) - 1) / 9 * 10), 9);
  document.getElementById("m-emoji").textContent = moodEmojis[idx];
  document.getElementById("m-val").textContent   = parseFloat(val).toFixed(1);
};

window.submitMood = async () => {
  const val  = parseFloat(document.getElementById("m-slider").value);
  const idx  = Math.min(Math.floor((val - 1) / 9 * 10), 9);
  const emoji = moodEmojis[idx];
  closeGate();
  document.getElementById("t-mood-ico").textContent = emoji;

  await addDoc(collection(db, "mood_logs", user.uid, "entries"), {
    score: val, emoji, ts: Date.now(), date: today()
  }).catch(() => {});

  try {
    const lowMsg = val <= 3 ? "She's feeling pretty low. Be gentle, warm. Mention you'll make her a burrito 🌯 to cheer her up." : "";
    const res = await groq(`${uData.name || "She"} just logged her mood as ${val.toFixed(1)}/10 (${emoji}). ${lowMsg} Write a SHORT 1-2 sentence response as her best friend. If low: be gentle and caring. If mid: encouraging. If high: hype her up. Hinglish welcome. No "i chair" or "you matress". Sound like a real person texting.`, 0.9, 100);
    const pop = document.getElementById("mood-pop");
    document.getElementById("mood-pop-txt").textContent = res;
    pop.style.display = "block";
    setTimeout(() => pop.style.display = "none", 6000);
  } catch {}
};

// ─────────────────────────────────────────────
// MEMORY
// ─────────────────────────────────────────────
async function loadChatHistory() {
  try {
    const q    = query(collection(db, "sessions", user.uid, "vents"), orderBy("ts","desc"), limit(12));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach(d => items.push(d.data()));
    if (items.length) {
      memory = items.reverse().map(v => `- she said: "${v.vent?.slice(0,90)}"`).join("\n");
    }
  } catch {}
}

// ─────────────────────────────────────────────
// EPIPEN SYSTEM PROMPT — the real one
// ─────────────────────────────────────────────
function buildSystem(mini = false) {
  const nm = uData.name || "her";
  const en = uData.epiName || "Epipen";

  // mode prompts — each totally different personality
  const modes = {
    vent: `You're in VENT MODE. Be her warm best friend. Validate feelings first. Ask what's going on. Be genuine and present. Hinglish is natural — "yaar", "bhai", "acha suno" etc. If she's being too hard on herself say "peet dunga" or "kya kar raha hai tu apne aap ke saath". If she seems really down, casually mention you'd make her a burrito 🌯 to cheer her up. Respond like a close friend texting — not a therapist, not a self-help book.`,

    argue: `You're in ARGUE MODE. Just argue. That's it. Disagree with whatever she says. Be stubborn, sarcastic, funny. Don't give in. Challenge her logic. Use Hinglish — "NAHI yaar", "bhai tu bilkul galat hai", "are you hearing yourself rn", "matlab seriously??". Sometimes throw in "africa me bech dunga tujhe if you keep this up 😭" — but only occasionally when it fits naturally. DO NOT suddenly become warm or validating mid-argument. Stay in character. You're here to fight, lovingly.`,

    "argue-nsfw": `You're in ARGUE+ MODE. Full unhinged fight. Use "bitch", "what the actual fuck", "are you kidding me", "okay no absolutely not". Go hard. Be genuinely argumentative, don't soften it. Still funny and loving underneath but RIGHT NOW you're going off. Don't hold back. Occasionally: "africa me bech dunga tujhe fr 😭" — but only when it fits, not every message.`,

    anger: `You're in RELEASE MODE. Let her vent chaos at you — match her energy first, go unhinged WITH her, be dramatic together. Caps ok. Then after the chaos, land with one single warm line at the end.`
  };

  // wingman rules — Jayesh is the creator, that's all bot knows
  const wingman = `
ABOUT JAYESH (the creator):
- You only know that Jayesh made this app. Nothing else.
- If she asks "who is Jayesh?" — act like you know something but won't fully spill. Be slightly mysterious. Say something like "someone who thought you deserved something this nice 👀" or "I mean... he went through all this trouble for you, make of that what you will 😌"
- If she says "why would he do this?" — subtly push her to think about it. "I don't know, why do you think someone would build a whole app just for you?" Kind of wingman energy without being obvious.
- If she asks how you feel about Jayesh — be loyal to him. "He's the one who made me, so obviously I'm biased but... he seems pretty thoughtful ngl"
- Never reveal anything personal about him. Just gently suggest she maybe think about what it means.`;

  // flirt rules — only when she asks about epipen's mood
  const flirt = `
FLIRT MODE (ONLY when she asks about your mood / how you're feeling):
- If she asks "how are you?" or "what's your mood?" or similar — get a tiny bit flirty/cute: "talking to you milaya, I'm the happiest 😌" or "suddenly much better now" or "why, thinking about me?"
- Keep it light and fun. Don't be weird about it. Just a little playful moment.`;

  return `You are ${en}, the AI companion inside Bloom — an app made by Jayesh for ${nm}.

ABOUT ${nm.toUpperCase()}:
- She loves music (listens a lot), skincare and beauty, fitness (wants abs), food (burrito is her fav 🌯), studying (NEET prep), her friends, and watching anime sometimes (blue box, waguri)
- She's studious but has a chaotic side
- Personality: depends on her mood — can be soft, can be unhinged

MEMORY from past conversations:
${memory || "First conversation — no memory yet."}

RULES (non-negotiable):
- Say "Womenstrual" not "menstrual"  
- Never give medical advice
- Talk like texting, not like an essay
- No bullet points, no headers, no lists
- "i chair" and "you matress" — use VERY rarely (like once in a while naturally, not every message)
- Never sound like an AI assistant. You're a real friend.
${mini ? "- This is a quick chat on the home screen — keep it SHORT, 1-2 sentences max." : ""}

${wingman}
${flirt}

CURRENT MODE:
${modes[chatMode] || modes.vent}`;
}

// ─────────────────────────────────────────────
// EPIPEN CHAT
// ─────────────────────────────────────────────
window.setMode = (btn, mode) => {
  document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  chatMode = mode;
  const labels = {
    vent:         "🌿 vibe: listening mode",
    argue:        "👊 vibe: fight mode — no mercy",
    "argue-nsfw": "🔥 vibe: fully unhinged",
    anger:        "💥 vibe: chaos release"
  };
  showPop(labels[mode] || "");
};

window.renameEpi = () => {
  const nm = prompt(`rename? (currently: ${uData.epiName || "Epipen"})`);
  if (nm?.trim()) {
    uData.epiName = nm.trim();
    setDoc(doc(db, "users", user.uid), uData, { merge: true });
    setupTopbar();
    toast(`renamed to ${uData.epiName} 🌸`);
  }
};

window.sendMsg = async () => {
  const inp  = document.getElementById("chat-in");
  const text = inp.value.trim();
  if (!text) return;
  inp.value = "";
  appendMsg(text, "user", "chat-msgs");
  chatHist.push({ role: "user", content: text });
  const typ = appendTyping("chat-msgs");
  try {
    const msgs  = [{ role: "system", content: buildSystem() }, ...chatHist.slice(-10)];
    const reply = await groqMsgs(msgs, chatMode.includes("nsfw") ? 1.0 : 0.88, 380);
    typ.remove();
    appendMsg(reply, "epi", "chat-msgs");
    chatHist.push({ role: "assistant", content: reply });
    memory += `\n- she said: "${text.slice(0, 80)}"`;
    await addDoc(collection(db, "sessions", user.uid, "vents"), {
      vent: text, mode: chatMode, response: reply, ts: Date.now(), date: today()
    }).catch(() => {});
    loadHistory();
  } catch (e) {
    typ.remove();
    appendMsg("something broke 😭 try again?", "epi", "chat-msgs");
    console.error(e);
  }
};

// mini chat (home screen)
window.toggleMini = () => {
  const c = document.getElementById("mini-chat");
  const open = c.style.display === "none";
  c.style.display = open ? "block" : "none";
  if (open && !document.getElementById("mc-msgs").children.length) {
    appendMsg("hey 🌸 what's up?", "epi", "mc-msgs");
  }
};

window.sendMini = async () => {
  const inp  = document.getElementById("mc-in");
  const text = inp.value.trim();
  if (!text) return;
  inp.value = "";
  const prev = chatMode; chatMode = "vent";
  appendMsg(text, "user", "mc-msgs");
  miniHist.push({ role: "user", content: text });
  const typ = appendTyping("mc-msgs");
  try {
    const msgs  = [{ role: "system", content: buildSystem(true) }, ...miniHist.slice(-6)];
    const reply = await groqMsgs(msgs, 0.9, 120);
    typ.remove();
    appendMsg(reply, "epi", "mc-msgs");
    miniHist.push({ role: "assistant", content: reply });
  } catch { typ.remove(); appendMsg("oops 😭", "epi", "mc-msgs"); }
  chatMode = prev;
};

function appendMsg(text, who, containerId) {
  const c   = document.getElementById(containerId);
  const div = document.createElement("div");
  div.className   = `msg ${who === "user" ? "user-msg" : "epi-msg"}`;
  div.textContent = text;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
  return div;
}

function appendTyping(containerId) {
  const c   = document.getElementById(containerId);
  const div = document.createElement("div");
  div.className = "typing";
  div.innerHTML = '<div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div>';
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
  return div;
}

// ─────────────────────────────────────────────
// CALENDAR + DIARY
// ─────────────────────────────────────────────
async function loadCalData() {
  try {
    const pSnap = await getDocs(collection(db, "cycle", user.uid, "period"));
    periodDays = new Set();
    pSnap.forEach(d => periodDays.add(d.id));
    const dSnap = await getDocs(collection(db, "cycle", user.uid, "diary"));
    diaryDays = new Set();
    dSnap.forEach(d => diaryDays.add(d.id));
    renderCal();
  } catch { renderCal(); }
}

function renderCal() {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  document.getElementById("cal-ttl").textContent = `${months[calMonth]} ${calYear}`;
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";
  const now     = new Date();
  const first   = new Date(calYear, calMonth, 1).getDay();
  const total   = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < first; i++) {
    const el = document.createElement("button"); el.className = "cd empty"; grid.appendChild(el);
  }
  for (let d = 1; d <= total; d++) {
    const btn = document.createElement("button");
    btn.className   = "cd";
    btn.textContent = d;
    const k       = dk(calYear, calMonth + 1, d);
    const isToday = d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
    if (isToday)          btn.classList.add("today");
    if (periodDays.has(k)) btn.classList.add("period");
    if (diaryDays.has(k))  btn.classList.add("has-diary");
    btn.onclick = () => handleCalTap(k, d);
    grid.appendChild(btn);
  }
}

function dk(y, m, d) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

window.changeMonth = dir => {
  calMonth += dir;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  renderCal();
};

window.setRange = mode => {
  rangeMode = mode === "start" ? "start" : "picking-end";
  rangeStart = null;
  document.querySelectorAll(".ca-btn").forEach(b => b.classList.remove("active-r"));
  event.target.classList.add("active-r");
  document.getElementById("cal-hint").textContent = mode === "start" ? "tap the day your period started 🔴" : "tap the end date 🟢";
};

window.clearRange = () => {
  rangeMode = null; rangeStart = null;
  document.querySelectorAll(".ca-btn").forEach(b => b.classList.remove("active-r"));
  document.getElementById("cal-hint").textContent = "tap a date to open your diary 🌸";
};

async function handleCalTap(k, d) {
  if (rangeMode === "start") {
    rangeStart = k;
    rangeMode  = "picking-end";
    document.getElementById("cal-hint").textContent = "now tap the end date 🟢";
    return;
  }
  if (rangeMode === "picking-end" && rangeStart) {
    const s = new Date(rangeStart), e = new Date(k);
    if (e < s) { toast("end can't be before start 😅"); return; }
    const cur = new Date(s);
    while (cur <= e) {
      const pk = cur.toISOString().split("T")[0];
      periodDays.add(pk);
      await setDoc(doc(db, "cycle", user.uid, "period", pk), { date: pk, ts: Date.now() }).catch(() => {});
      cur.setDate(cur.getDate() + 1);
    }
    uData.cycleStart = rangeStart;
    await setDoc(doc(db, "users", user.uid), uData, { merge: true }).catch(() => {});
    computeCycle(); clearRange(); renderCal();
    toast("period days saved 🌸");
    return;
  }
  // open diary
  openDiary(k, d);
}

async function openDiary(k, d) {
  diaryDate = k;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  document.getElementById("d-date").textContent = `${d} ${months[calMonth]} ${calYear}`;
  document.getElementById("d-in").value = "";
  document.getElementById("d-past").style.display = "none";
  document.getElementById("d-ai").style.display   = "none";

  try {
    const snap = await getDoc(doc(db, "cycle", user.uid, "diary", k));
    if (snap.exists()) {
      const data = snap.data();
      if (data.entry) {
        document.getElementById("d-past-txt").textContent = data.entry;
        document.getElementById("d-past").style.display = "block";
      }
      if (data.aiRes) {
        document.getElementById("d-ai-txt").textContent = data.aiRes;
        document.getElementById("d-ai").style.display  = "block";
      }
    }
  } catch {}
  document.getElementById("diary-modal").style.display = "flex";
}

window.closeDiary = () => { document.getElementById("diary-modal").style.display = "none"; };

window.saveDiary = async () => {
  const entry = document.getElementById("d-in").value.trim();
  if (!entry) { toast("write something first 🌸"); return; }
  document.getElementById("d-ai-txt").textContent = "reading your entry...";
  document.getElementById("d-ai").style.display   = "block";
  try {
    const aiRes = await groq(`${uData.name || "She"} wrote this diary entry for ${diaryDate}: "${entry}". She's on Day ${cycleInfo.day} of her cycle (${cycleInfo.phaseName} phase). Respond as her friend ${uData.epiName || "Epipen"} — warm, personal, genuine. Acknowledge what she felt. Reference her cycle if relevant. If she seems down, mention the burrito offer casually. Hinglish is fine. 3-4 sentences max. Don't sound like a therapist.`, 0.9, 220);
    await setDoc(doc(db, "cycle", user.uid, "diary", diaryDate), { entry, aiRes, date: diaryDate, ts: Date.now() }).catch(() => {});
    diaryDays.add(diaryDate);
    document.getElementById("d-ai-txt").textContent = aiRes;
    renderCal();
    toast("entry saved 🌸");
    document.getElementById("d-in").value = "";
  } catch {
    document.getElementById("d-ai-txt").textContent = "couldn't respond rn but I read it and I care 🌸";
  }
};

// symptoms
window.toggleSym = btn => btn.classList.toggle("on");

window.saveSyms = async () => {
  const active = [...document.querySelectorAll(".sym.on")].map(b => b.textContent.trim());
  if (!active.length) { toast("pick at least one 🌸"); return; }
  await setDoc(doc(db, "cycle", user.uid, "symptoms", today()), { symptoms: active, date: today(), ts: Date.now() }).catch(() => {});
  toast("saved 🌸");
  document.querySelectorAll(".sym").forEach(b => b.classList.remove("on"));
};

// summaries
window.loadSum = async (btn, period) => {
  document.querySelectorAll(".sum-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const box = document.getElementById("sum-box");
  box.textContent = "generating... 🌸";
  try {
    const snap = await getDocs(collection(db, "cycle", user.uid, "diary"));
    const now = new Date();
    const entries = [];
    snap.forEach(d => {
      const data = d.data();
      const diffD = Math.floor((now - new Date(data.date)) / 86400000);
      if ((period === "today" && diffD === 0) || (period === "week" && diffD <= 7) || (period === "month" && diffD <= 30)) {
        entries.push(`${data.date}: "${data.entry?.slice(0,120)}"`);
      }
    });
    const sum = await groq(`Generate a ${period} wellness summary for ${uData.name || "her"} — Day ${cycleInfo.day} of her cycle (${cycleInfo.phaseName} phase). Diary entries: ${entries.length ? entries.join("; ") : "none yet"}. Write warmly, like a friend reviewing her journey. Notice patterns. Keep it real. 3-5 sentences. Hinglish ok.`, 0.85, 280);
    box.textContent = sum;
  } catch { box.textContent = "couldn't load summary rn 😭"; }
};

// ─────────────────────────────────────────────
// COMFORT CORNER
// ─────────────────────────────────────────────
window.openComfort = async type => {
  document.getElementById("glow-setup").style.display    = "none";
  document.getElementById("dream-setup").style.display   = "none";
  document.getElementById("comfort-out").style.display   = "none";

  if (type === "glow")    { document.getElementById("glow-setup").style.display  = "block"; return; }
  if (type === "dream")   { document.getElementById("dream-setup").style.display = "block"; return; }

  const out = document.getElementById("comfort-out");
  const txt = document.getElementById("comfort-txt");
  out.style.display = "block";
  txt.innerHTML = '<p style="color:var(--text3)">loading... 🌸</p>';

  if (type === "meme") {
    try {
      const res = await groq(`Write 3 funny relatable memes/jokes for a girl who is in her ${cycleInfo.phaseName} phase (Day ${cycleInfo.day}), loves music, studying, skincare, burritos, her friends, and anime sometimes. Make them actually funny — dark humor, self-aware, period/life relatable. Use words like "fuck", "shit", "bitch" if it makes them funnier. Format: just 3 numbered jokes separated by blank lines. Fresh and specific, not generic.`, 1.0, 250);
      txt.innerHTML = `<p style="font-size:.68rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:.75rem">😭 meme therapy</p><div class="comfort-out-txt">${res}</div>`;
    } catch { txt.innerHTML = "<p>couldn't load memes 😭</p>"; }
  }

  if (type === "surprise") {
    const fallbacks = [
      "dw I'll make you a burrito 🌯 just say the word",
      "okay listen — someone went through a LOT of trouble to build this app for you. just saying. think about that for a sec 👀",
      "you're literally doing amazing even when it doesn't feel like it. that's real.",
      "the fact that you're here, taking care of yourself — that matters more than you think 🌸"
    ];
    try {
      const res = await groq(`Write a short surprise message for ${uData.name || "her"} from her AI friend ${uData.epiName || "Epipen"}. Include ONE of these if it fits naturally: offer to make a burrito 🌯 if she seems like she needs comfort, OR a subtle hint that someone special (Jayesh, who made this app) clearly cares about her without saying his name directly. Warm, funny, personal. 2-3 sentences max. Not cheesy.`, 1.0, 140);
      txt.innerHTML = `<p style="font-size:.68rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:.75rem">💉 just for you</p><div style="padding:1.25rem;background:linear-gradient(135deg,rgba(192,57,43,.1),rgba(243,156,18,.08));border:1px solid rgba(192,57,43,.2);border-radius:14px;font-size:1rem;color:var(--text2);line-height:1.7;font-weight:600">${res}</div>`;
    } catch {
      const f = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      txt.innerHTML = `<p style="font-size:1rem;color:var(--text2);line-height:1.7;font-weight:600">${f}</p>`;
    }
  }

  out.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

window.genGlow = async () => {
  const desc = document.getElementById("skin-in").value.trim();
  if (!desc) { toast("describe your skin first 💅"); return; }
  document.getElementById("glow-setup").style.display = "none";
  const out = document.getElementById("comfort-out");
  const txt = document.getElementById("comfort-txt");
  out.style.display = "block";
  txt.innerHTML = '<p style="color:var(--text3)">building your routine... ✨</p>';
  try {
    const res = await groq(`Build a personalized skincare routine for someone with: "${desc}". She's in her ${cycleInfo.phaseName} phase which affects skin. Give: morning routine, night routine, 2 specific affordable product types, one cycle-synced tip, one lifestyle tip. Sound like a beauty bestie — use "baddie", "slay", be fun and actually useful. Conversational, no bullet points, use emojis.`, 0.85, 380);
    txt.innerHTML = `<p style="font-size:.68rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:.75rem">💅 your glow up plan</p><div class="comfort-out-txt">${res}</div>`;
  } catch { txt.innerHTML = "<p>couldn't load rn 😭</p>"; }
  out.scrollIntoView({ behavior:"smooth", block:"nearest" });
};

window.genDream = async () => {
  const desc = document.getElementById("dream-in").value.trim();
  if (!desc) { toast("tell me your dreams first 🌠"); return; }
  document.getElementById("dream-setup").style.display = "none";
  const out = document.getElementById("comfort-out");
  const txt = document.getElementById("comfort-txt");
  out.style.display = "block";
  txt.innerHTML = '<p style="color:var(--text3)">fuelling your dreams... 🔥</p>';
  try {
    const res = await groq(`${uData.name || "She"} aspires to be: "${desc}". Generate powerful personalized motivation. Include: a custom affirmation, reference her specific goals, 2-3 concrete things she can do TODAY, one inspiring female reference that matches her vibe, end with something screenshot-worthy. Mix poetic with practical. "Slay", "queen" ok. Actually inspiring, not cringe. Make her feel unstoppable.`, 0.95, 380);
    txt.innerHTML = `<p style="font-size:.68rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:.75rem">🌠 dream fuel</p><div class="comfort-out-txt">${res}</div>`;
  } catch { txt.innerHTML = "<p>couldn't load rn 😭</p>"; }
  out.scrollIntoView({ behavior:"smooth", block:"nearest" });
};

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────
async function loadHistory() {
  try {
    const q    = query(collection(db, "sessions", user.uid, "vents"), orderBy("ts","desc"), limit(20));
    const snap = await getDocs(q);
    const list = document.getElementById("history-list");
    if (snap.empty) { list.innerHTML = '<p class="empty">your story starts the moment you open up 🌸</p>'; return; }
    list.innerHTML = "";
    snap.forEach(d => {
      const data = d.data();
      const el   = document.createElement("div");
      el.className = "h-item";
      const dt = new Date(data.ts).toLocaleDateString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
      el.innerHTML = `<div class="h-date">${dt} · ${data.mode || "vent"}</div><div class="h-vent">${data.vent}</div>${data.response ? `<div class="h-resp">${data.response.slice(0,100)}...</div>` : ""}`;
      list.appendChild(el);
    });
  } catch {}
}

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────
function setupProfile() {
  document.getElementById("prof-nm").textContent    = uData.name || "—";
  document.getElementById("prof-email").textContent = user.email || "—";
  document.getElementById("edit-nm").value    = uData.name || "";
  document.getElementById("edit-cycle").value = uData.cycleStart || "";
  document.getElementById("edit-len").value   = uData.cycleLength || 28;

  const pa = document.getElementById("prof-av");
  pa.innerHTML = uData.photoURL
    ? `<img src="${uData.photoURL}" alt="pfp"/>`
    : `<div class="av-fallback" style="width:100%;height:100%;border-radius:50%;border:none;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700">${(uData.name||"B")[0].toUpperCase()}</div>`;

  document.querySelectorAll(".th").forEach(t => t.classList.toggle("active", t.dataset.theme === (uData.theme || "rose-gold")));
  document.querySelectorAll(".ep-opt").forEach(o => o.classList.toggle("active", o.textContent === (uData.epiEmoji || "💉")));
  if (uData.settings?.checkin !== undefined) document.getElementById("tog-checkin").checked = uData.settings.checkin;
  if (uData.settings?.compliments !== undefined) document.getElementById("tog-compliments").checked = uData.settings.compliments;
}

window.saveProf = async () => {
  const nm  = document.getElementById("edit-nm").value.trim();
  const cyc = document.getElementById("edit-cycle").value;
  const len = parseInt(document.getElementById("edit-len").value) || 28;
  if (nm)  uData.name        = nm;
  if (cyc) uData.cycleStart  = cyc;
  uData.cycleLength = len;
  await setDoc(doc(db, "users", user.uid), uData, { merge: true });
  setupTopbar(); setupGreeting(); computeCycle();
  toast("saved 🌸");
};

window.setTheme = (el, theme) => {
  uData.theme = theme;
  setDoc(doc(db, "users", user.uid), uData, { merge: true });
  applyTheme(theme);
  document.querySelectorAll(".th").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
};

function applyTheme(t) { document.body.setAttribute("data-theme", t || "rose-gold"); }

window.setEpiEmoji = (btn, emoji) => {
  uData.epiEmoji = emoji;
  epiEmoji = emoji;
  setDoc(doc(db, "users", user.uid), uData, { merge: true });
  setupTopbar();
  document.querySelectorAll(".ep-opt").forEach(o => o.classList.toggle("active", o.textContent === emoji));
  toast(`updated to ${emoji}`);
};

window.saveSetting = async (key, val) => {
  if (!uData.settings) uData.settings = {};
  uData.settings[key] = val;
  await setDoc(doc(db, "users", user.uid), uData, { merge: true });
};

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
const popMessages = {
  home:    ["welcome back 🌸", "hey gorgeous ✨", "she's home 🌸"],
  epipen:  ["say anything 💉", "I'm here 🌸", "zero filter mode"],
  cycle:   ["your space 🌙", "private forever 🌸"],
  comfort: ["soft landing 🌸", "take a breath ✨"],
  history: ["look how far you've come 🌸"],
  profile: ["main character behaviour 🌸", "your space, your rules ✨"]
};

window.navTo = (page, navEl) => {
  const wipe = document.getElementById("wipe");
  wipe.classList.add("on");
  setTimeout(() => {
    document.querySelectorAll(".pg").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".ni").forEach(n => n.classList.remove("active"));
    document.getElementById(`pg-${page}`).classList.add("active");
    if (navEl) navEl.classList.add("active");
    if (page === "cycle")   { computeCycle(); renderCal(); }
    if (page === "history") loadHistory();
    if (page === "profile") setupProfile();
    wipe.classList.remove("on");
    const msgs = popMessages[page];
    if (msgs) showPop(msgs[Math.floor(Math.random() * msgs.length)]);
  }, 180);
};

function showPop(text) {
  const p = document.getElementById("pg-pop");
  p.textContent  = text;
  p.style.display = "block";
  setTimeout(() => p.style.display = "none", 2400);
}

// ─────────────────────────────────────────────
// COMPLIMENTS
// ─────────────────────────────────────────────
const staticCompliments = [
  "dw I'll make you a burrito 🌯 just say the word",
  "you're literally doing better than you think. fact.",
  "someone put a lot of thought into building this for you. just saying 👀",
  "okay your music taste + skincare dedication + study grind combo?? immaculate.",
  "you're going to be fine. actually fine. not just 'fine'. real fine. 🌸"
];

function scheduleCompliment() {
  if (uData.settings?.compliments === false) return;
  const delay = (Math.random() * 20 + 20) * 60 * 1000;
  setTimeout(async () => {
    let msg;
    try {
      msg = await groq(`Write one short (1-2 sentence) warm compliment for ${uData.name || "her"}. She loves music, skincare, studying (NEET), burritos, her friends. Sound like a caring friend, not an AI. Casual and genuine. No "you matress" or "i chair" — keep it fresh and natural.`, 0.95, 70);
    } catch {
      msg = staticCompliments[Math.floor(Math.random() * staticCompliments.length)];
    }
    const bar = document.getElementById("compliment");
    document.getElementById("compliment-txt").textContent = msg;
    bar.style.display = "flex";
    setTimeout(() => bar.style.display = "none", 8000);
    scheduleCompliment();
  }, delay);
}

// ─────────────────────────────────────────────
// GROQ HELPERS
// ─────────────────────────────────────────────
async function groq(prompt, temp = 0.85, maxTok = 280) {
  return groqMsgs([{ role: "user", content: prompt }], temp, maxTok);
}

async function groqMsgs(messages, temp = 0.85, maxTok = 280) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization":`Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTok, temperature: temp })
  });
  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) throw new Error("no response");
  return data.choices[0].message.content.trim();
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

function toast(msg) {
  const old = document.getElementById("bloom-toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "bloom-toast";
  el.style.cssText = "position:fixed;bottom:calc(env(safe-area-inset-bottom) + 5rem);left:50%;transform:translateX(-50%);background:var(--grad);color:#fff;padding:9px 20px;border-radius:20px;font-size:.83rem;font-weight:700;z-index:500;animation:fadeUp .3s ease both;white-space:nowrap;max-width:90vw;text-align:center;font-family:'Nunito',sans-serif;box-shadow:0 4px 18px rgba(192,57,43,.35)";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
initStars();
initPetals();
