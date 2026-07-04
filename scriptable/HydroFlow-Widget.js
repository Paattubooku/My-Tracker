// ============================================================================
//  HydroFlow — iPhone Widget for the Scriptable App  (v5 — Reliable Data + Fixed Sizes)
// ============================================================================

// ============================ CONFIGURATION =================================
const SUPABASE_URL = "";                    // e.g. https://abcd1234.supabase.co
const SUPABASE_ANON_KEY = "";               // safe for a personal widget (with RLS "allow all")
const SUPABASE_SERVICE_ROLE_KEY = "";       // optional — leave blank if using the anon key above

const TAP_URL = "";                         // optional deep-link when the widget is tapped
const FETCH_TIMEOUT_MS = 8000;              // per-request timeout before falling back to cache

// Only used when you tap ▶ inside the Scriptable app (manual preview).
const PREVIEW_FAMILY = "medium";
// ============================================================================

const API_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const CONFIGURED = Boolean(SUPABASE_URL && API_KEY);

function progressColor(percentage) {
  if (percentage >= 100) return "#10b981";
  if (percentage >= 75)  return "#06b6d4";
  if (percentage >= 50)  return "#3b82f6";
  if (percentage >= 25)  return "#8b5cf6";
  return "#f97316";
}
function statusLabel(percentage) {
  if (percentage >= 100) return "Goal Reached!";
  if (percentage >= 75)  return "Almost there!";
  if (percentage >= 50)  return "Halfway done";
  if (percentage >= 25)  return "Keep going";
  return "Let's start hydrating!";
}

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}
function formatNowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = Timer.schedule(ms, false, () => reject(new Error("timeout:" + label)));
  });
  return Promise.race([promise, timeout]).then(
    (value) => { if (timer) timer.invalidate(); return value; },
    (err) => { if (timer) timer.invalidate(); throw err; }
  );
}

async function supabaseGet(path) {
  const req = new Request(`${SUPABASE_URL}/rest/v1/${path}`);
  req.method = "GET";
  req.timeoutInterval = FETCH_TIMEOUT_MS / 1000;
  req.headers = {
    "apikey": API_KEY,
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  const text = await req.loadString();
  const status = req.response && req.response.statusCode;

  if (typeof status === "number" && (status < 200 || status >= 300)) {
    throw new Error(`HTTP ${status} on ${path}: ${text.slice(0, 140)}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Bad JSON from ${path}: ${text.slice(0, 140)}`);
  }
}

const fm = FileManager.local();
const CACHE_PATH = fm.joinPath(fm.cacheDirectory(), "hydroflow_widget_cache.json");

function loadCache() {
  try {
    if (!fm.fileExists(CACHE_PATH)) return null;
    const txt = fm.readString(CACHE_PATH);
    return txt ? JSON.parse(txt) : null;
  } catch (e) {
    return null;
  }
}
function saveCache(data) {
  try {
    fm.writeString(CACHE_PATH, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

async function fetchData() {
  const dateStr = todayDateString();

  const settingsPromise = withTimeout(supabaseGet("settings?select=key,value"), FETCH_TIMEOUT_MS, "settings")
    .then((rows) => ({ ok: true, rows }))
    .catch((err) => ({ ok: false, error: err && err.message ? err.message : String(err) }));

  const logsPromise = withTimeout(supabaseGet(`water_logs?select=amount_ml&date=eq.${dateStr}`), FETCH_TIMEOUT_MS, "water_logs")
    .then((rows) => ({ ok: true, rows }))
    .catch((err) => ({ ok: false, error: err && err.message ? err.message : String(err) }));

  const [settingsResult, logsResult] = await Promise.all([settingsPromise, logsPromise]);

  if (!settingsResult.ok) console.log(`[HydroFlow] settings request failed: ${settingsResult.error}`);
  if (!logsResult.ok) console.log(`[HydroFlow] water_logs request failed: ${logsResult.error}`);

  if (!settingsResult.ok && !logsResult.ok) {
    return { failure: true, reason: settingsResult.error || logsResult.error || "Unknown network error" };
  }

  const settings = {};
  if (settingsResult.ok && Array.isArray(settingsResult.rows)) {
    for (const r of settingsResult.rows) settings[r.key] = r.value;
  }

  const total = (logsResult.ok && Array.isArray(logsResult.rows))
    ? logsResult.rows.reduce((sum, r) => sum + (Number(r.amount_ml) || 0), 0)
    : null;
  const goal = settingsResult.ok ? (parseInt(settings.daily_goal_ml, 10) || 3000) : null;

  const cached = loadCache();
  const finalTotal = total !== null ? total : (cached ? cached.total : 0);
  const finalGoal = goal !== null ? goal : (cached ? cached.goal : 3000);
  const percentage = finalGoal > 0 ? (finalTotal / finalGoal) * 100 : 0;

  return {
    total: finalTotal,
    goal: finalGoal,
    percentage,
    colorHex: progressColor(percentage),
    status: statusLabel(percentage),
    live: settingsResult.ok && logsResult.ok,
    updatedAt: formatNowHHMM(),
  };
}

function polarPoint(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return new Point(cx + radius * Math.cos(rad), cy + radius * Math.sin(rad));
}

function drawPill(ctx, centerX, centerY, text, colorHex, referenceSize, alpha) {
  const fontSize = Math.max(referenceSize * 0.065, 12);
  const paddingX = fontSize * 0.85;
  const estimatedTextWidth = text.length * fontSize * 0.62;
  const pillWidth = Math.max(fontSize * 4.2, estimatedTextWidth + paddingX * 2);
  const pillHeight = fontSize * 2.05;

  const pillRect = new Rect(centerX - pillWidth / 2, centerY - pillHeight / 2, pillWidth, pillHeight);
  const pillPath = new Path();
  pillPath.addRoundedRect(pillRect, pillHeight / 2, pillHeight / 2);
  ctx.addPath(pillPath);
  ctx.setFillColor(new Color(colorHex, 0.14));
  ctx.fillPath();

  const textLineHeight = fontSize * 1.3;
  const textRect = new Rect(pillRect.x, centerY - textLineHeight / 2, pillRect.width, textLineHeight);
  ctx.setTextColor(new Color(colorHex, alpha));
  ctx.setFont(Font.semiboldSystemFont(fontSize));
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(text, textRect);
}

function renderRing(diameter, total, goal, percentage, colorHex, status, mode, dim) {
  const size = diameter;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;
  const stroke = Math.max(8, size * 0.075);
  const arcAlpha = dim ? 0.45 : 1;

  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  ctx.setStrokeColor(new Color("#e2e8f0"));
  ctx.setLineWidth(stroke);
  ctx.strokeEllipse(new Rect(cx - radius, cy - radius, radius * 2, radius * 2));

  const pct = Math.max(0, Math.min(percentage, 100));
  if (pct > 0) {
    const sweepDeg = (pct / 100) * 360;
    const segments = Math.max(2, Math.round(sweepDeg / 2));
    const points = [];
    for (let i = 0; i <= segments; i++) {
      points.push(polarPoint(cx, cy, radius, (sweepDeg * i) / segments));
    }
    const arcPath = new Path();
    arcPath.addLines(points);
    ctx.addPath(arcPath);
    ctx.setStrokeColor(new Color(colorHex, arcAlpha));
    ctx.setLineWidth(stroke);
    ctx.strokePath();

    const capRadius = stroke / 2;
    ctx.setFillColor(new Color(colorHex, arcAlpha));
    for (const p of [points[0], points[points.length - 1]]) {
      ctx.fillEllipse(new Rect(p.x - capRadius, p.y - capRadius, capRadius * 2, capRadius * 2));
    }
  }

  if (mode === "percent") {
    ctx.setTextColor(new Color(colorHex, arcAlpha));
    ctx.setFont(Font.boldSystemFont(size * 0.22));
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(`${Math.round(percentage)}%`, new Rect(0, cy - size * 0.14, size, size * 0.28));
    return ctx.getImage();
  }

  ctx.setTextColor(new Color("#0f172a"));
  ctx.setFont(Font.boldSystemFont(size * 0.17));
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(String(total), new Rect(0, cy - size * 0.19, size, size * 0.18));

  ctx.setTextColor(new Color("#64748b"));
  ctx.setFont(Font.mediumSystemFont(size * 0.052));
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(`/ ${goal.toLocaleString()} ml`, new Rect(0, cy - size * 0.01, size, size * 0.09));

  const pillText = `${Math.round(percentage)}%`;
  drawPill(ctx, cx, cy + size * 0.2, pillText, colorHex, size, arcAlpha);

  return ctx.getImage();
}

function buildSmallWidget(data) {
  const widget = new ListWidget();
  widget.backgroundColor = Color.white();
  widget.setPadding(6, 6, 6, 6);

  const stack = widget.addStack();
  stack.layoutVertically();
  stack.centerAlignContent();
  stack.addSpacer();

  const diameter = 148;
  const ring = renderRing(diameter, data.total, data.goal, data.percentage, data.colorHex, data.status, "full", !data.live);
  const img = stack.addImage(ring);
  img.centerAlignImage();
  img.imageSize = new Size(diameter, diameter);

  stack.addSpacer();

  return widget;
}

function buildMediumWidget(data) {
  const widget = new ListWidget();
  widget.backgroundColor = Color.white();
  widget.setPadding(16, 18, 16, 18);

  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const diameter = 118;
  const ring = renderRing(diameter, data.total, data.goal, data.percentage, data.colorHex, data.status, "percent");
  const imgEl = row.addImage(ring);
  imgEl.imageSize = new Size(diameter, diameter);

  row.addSpacer(18);

  const info = row.addStack();
  info.layoutVertically();
  info.addSpacer();

  const title = info.addText("💧 HYDRATION");
  title.font = Font.semiboldSystemFont(11);
  title.textColor = new Color("#94a3b8");

  info.addSpacer(6);

  const totalLine = info.addText(`${data.total.toLocaleString()} ml`);
  totalLine.font = Font.boldSystemFont(28);
  totalLine.textColor = new Color("#0f172a");

  info.addSpacer(2);

  const goalLine = info.addText(`of ${data.goal.toLocaleString()} ml goal`);
  goalLine.font = Font.regularSystemFont(12);
  goalLine.textColor = new Color("#94a3b8");

  info.addSpacer(8);

  const statusLine = info.addText(data.status);
  statusLine.font = Font.semiboldSystemFont(13);
  statusLine.textColor = new Color(data.colorHex);

  info.addSpacer();

  if (!data.live) {
    info.addSpacer(4);
    const tag = info.addText("⚠️ Offline");
    tag.font = Font.mediumSystemFont(10);
    tag.textColor = new Color("#cbd5e1");
  }

  row.addSpacer();

  return widget;
}

function buildLargeWidget(data) {
  const widget = new ListWidget();
  widget.backgroundColor = Color.white();
  widget.setPadding(22, 22, 20, 22);

  const main = widget.addStack();
  main.layoutVertically();

  const header = main.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();
  header.addSpacer();
  const headerIcon = header.addText("💧");
  headerIcon.font = Font.systemFont(16);
  header.addSpacer(6);
  const headerTitle = header.addText("Hydration Today");
  headerTitle.font = Font.semiboldSystemFont(15);
  headerTitle.textColor = new Color("#334155");
  header.addSpacer();

  main.addSpacer(14);

  const ringRow = main.addStack();
  ringRow.layoutHorizontally();
  ringRow.addSpacer();
  const diameter = 232;
  const ring = renderRing(diameter, data.total, data.goal, data.percentage, data.colorHex, data.status, "full", !data.live);
  const imgEl = ringRow.addImage(ring);
  imgEl.imageSize = new Size(diameter, diameter);
  ringRow.addSpacer();

  main.addSpacer(16);

  const remaining = Math.max(data.goal - data.total, 0);
  const statsRow = main.addStack();
  statsRow.layoutHorizontally();

  function statBlock(label, value, colorHex) {
    const block = statsRow.addStack();
    block.layoutVertically();
    block.centerAlignContent();
    const valueText = block.addText(value);
    valueText.font = Font.boldSystemFont(19);
    valueText.textColor = new Color(colorHex || "#0f172a");
    valueText.centerAlignText();
    block.addSpacer(2);
    const labelText = block.addText(label);
    labelText.font = Font.mediumSystemFont(10);
    labelText.textColor = new Color("#94a3b8");
    labelText.centerAlignText();
  }

  statBlock("REMAINING", `${remaining.toLocaleString()} ml`, "#3b82f6");
  statsRow.addSpacer();
  statBlock("PROGRESS", `${Math.round(data.percentage)}%`, data.colorHex);
  statsRow.addSpacer();
  statBlock("STATUS", data.live ? "Live" : "Cached", data.live ? "#10b981" : "#f59e0b");

  main.addSpacer();

  if (!data.live) {
    main.addSpacer(8);
    const reasonRow = main.addStack();
    reasonRow.layoutHorizontally();
    reasonRow.addSpacer();
    const reasonText = reasonRow.addText(
      data.offlineReason ? `⚠️ ${data.offlineReason}` : "⚠️ Offline — showing last known data"
    );
    reasonText.font = Font.mediumSystemFont(10);
    reasonText.textColor = new Color("#cbd5e1");
    reasonText.lineLimit = 1;
    reasonRow.addSpacer();
  }

  return widget;
}

function buildSetupWidget(family) {
  const widget = new ListWidget();
  widget.backgroundColor = Color.white();
  widget.setPadding(16, 16, 16, 16);

  const stack = widget.addStack();
  stack.layoutVertically();
  stack.addSpacer();

  const title = stack.addText("💧 HydroFlow");
  title.font = Font.boldSystemFont(family === "small" ? 16 : 20);
  title.textColor = new Color("#0f172a");
  title.centerAlignText();

  stack.addSpacer(6);

  const subtitle = stack.addText("Add your Supabase URL & key\ninside the script's CONFIGURATION block.");
  subtitle.font = Font.regularSystemFont(family === "small" ? 11 : 13);
  subtitle.textColor = new Color("#94a3b8");
  subtitle.centerAlignText();

  stack.addSpacer();
  return widget;
}

function getFamily() {
  return config.widgetFamily || PREVIEW_FAMILY;
}

function buildWidget(family, data) {
  if (family === "small") return buildSmallWidget(data);
  if (family === "large") return buildLargeWidget(data);
  return buildMediumWidget(data);
}

async function main() {
  const family = getFamily();
  let widget;

  if (!CONFIGURED) {
    widget = buildSetupWidget(family);
  } else {
    let data = null;
    let failureReason = null;

    try {
      const result = await withTimeout(fetchData(), FETCH_TIMEOUT_MS + 1500, "overall");
      if (result && result.failure) {
        failureReason = result.reason;
      } else {
        data = result;
      }
    } catch (e) {
      failureReason = e && e.message ? e.message : String(e);
    }

    if (data) {
      saveCache(data);
    } else {
      console.log(`[HydroFlow] Using cache/defaults. Reason: ${failureReason}`);
      const cached = loadCache();
      data = cached
        ? { ...cached, live: false, offlineReason: failureReason }
        : {
            total: 0,
            goal: 3000,
            percentage: 0,
            colorHex: progressColor(0),
            status: statusLabel(0),
            live: false,
            updatedAt: formatNowHHMM(),
            offlineReason: failureReason || "No data yet — open the app once",
          };
    }

    widget = buildWidget(family, data);
  }

  if (TAP_URL) widget.url = TAP_URL;
  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

  Script.setWidget(widget);

  if (config.runsInWidget === false) {
    if (family === "small") await widget.presentSmall();
    else if (family === "large") await widget.presentLarge();
    else await widget.presentMedium();
  }

  Script.complete();
}

main();
