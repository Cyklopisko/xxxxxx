import {
  sections,
  guides,
  requests,
  spent,
  filterRequests,
  escapeHtml as esc,
  csvRows,
} from "./panel-data.js";

const main = document.querySelector("#panel-main");
const app = document.querySelector(".gw-app");
const fmt = (n) => Number(n).toLocaleString("en-US");
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
const label = (el) => el.getAttribute("aria-label") || text(el);
const buttons = (root = document) => [...root.querySelectorAll("button")];
const onButton = (name, fn, root = main) =>
  buttons(root)
    .filter((b) => label(b) === name)
    .forEach((b) => b.addEventListener("click", fn));
let current = "overview",
  loadId = 0,
  currentGuide = "cli",
  os = "",
  activeDialog,
  toastTimer,
  selectedModels = null,
  selectedSetupKey = "",
  selectedModel = "";
let keys = [
  {
    id: 1,
    name: "Primary API key",
    primary: true,
    active: true,
    limit: null,
    models: null,
  },
  {
    id: 2,
    name: "My API key",
    primary: false,
    active: true,
    limit: null,
    models: null,
  },
];
let keyId = 2,
  tickets = [],
  ticketId = 0,
  logPage = 1,
  filters = {},
  sortKey = "",
  sortAsc = true;
const views = new Map();
async function getView(name) {
  if (!/^[a-z-]+$/.test(name)) throw new Error("Invalid view");
  if (!views.has(name)) {
    const r = await fetch(`/views/${name}.html`);
    if (!r.ok) throw new Error(`Unable to load ${name}`);
    views.set(name, await r.text());
  }
  return views.get(name);
}
function toast(message) {
  const el = document.querySelector("#panel-toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4000);
}
async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast("Copied to clipboard.");
  } catch {
    toast("Clipboard unavailable. Select and copy the text manually.");
  }
}
function closeDialog() {
  activeDialog?.close();
}
async function dialog(template) {
  closeDialog();
  const holder = document.createElement("div");
  holder.innerHTML = await getView(template);
  const el = holder.querySelector("dialog");
  if (!el) throw new Error("Invalid dialog template");
  el.removeAttribute("open");
  app.append(el);
  activeDialog = el;
  el.addEventListener("close", () => {
    el.remove();
    if (activeDialog === el) activeDialog = null;
  });
  el.querySelectorAll('button[aria-label^="Close"]').forEach((b) =>
    b.addEventListener("click", () => el.close()),
  );
  el.addEventListener("click", (e) => {
    if (e.target === el) {
      const r = el.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        el.close();
    }
  });
  el.showModal();
  return el;
}
function customDialog(title, content) {
  closeDialog();
  const el = document.createElement("dialog");
  el.className = "demo-dialog";
  el.innerHTML = `<header><h2>${esc(title)}</h2><button type="button" aria-label="Close dialog">×</button></header>${content}`;
  app.append(el);
  activeDialog = el;
  el.querySelector('[aria-label="Close dialog"]').onclick = () => el.close();
  el.onclose = () => {
    el.remove();
    if (activeDialog === el) activeDialog = null;
  };
  el.showModal();
  return el;
}
function selectControl(button, options, change) {
  if (!button) return;
  const select = document.createElement("select");
  select.className = "demo-select";
  select.setAttribute(
    "aria-label",
    button.getAttribute("aria-label") || text(button),
  );
  options.forEach((option) => select.add(new Option(option, option)));
  button.replaceWith(select);
  select.addEventListener("change", () => change(select.value));
  return select;
}
function urlFor(section, view = section) {
  const url = new URL("/panel", location.origin);
  if (section !== "overview") url.searchParams.set("tab", section);
  if (section === "cli" && view !== "cli") url.searchParams.set("guide", view);
  return url;
}
async function navigate(section, view = section, push = true) {
  if (!sections[section] && section !== "request-detail")
    section = view = "overview";
  const id = ++loadId;
  closeDialog();
  try {
    const html = await getView(view);
    if (id !== loadId) return;
    current = section;
    main.innerHTML = html;
    main.tabIndex = -1;
    if (push)
      history.pushState(
        {},
        "",
        urlFor(section === "request-detail" ? "logs" : section, view),
      );
    for (const b of document.querySelectorAll(".vx-sidebar nav button")) {
      const active =
        text(b) === sections[section === "request-detail" ? "logs" : section];
      b.classList.toggle("is-active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
    closeNav();
    wireCommon();
    if (section === "overview") initOverview();
    if (section === "keys") initKeys();
    if (section === "logs") initLogs();
    if (section === "cli") initSetup(view);
    if (section === "wallet") initWallet();
    if (section === "profile") initProfile();
    if (section === "referrals") initReferrals();
    if (section === "support") initSupport(view);
    document.title = `${sections[section] || "Request"} - dawvq`;
    window.scrollTo(0, 0);
  } catch (error) {
    main.replaceChildren();
    const p = document.createElement("p");
    p.textContent = error.message;
    main.append(p);
    toast("Unable to load this view. Please reload.");
  }
}
function closeNav() {
  document.querySelector(".vx-sidebar").classList.remove("is-open");
  document.querySelector(".vx-nav-backdrop")?.remove();
  document
    .querySelector(".vx-mobile-head button")
    .setAttribute("aria-expanded", "false");
}
for (const b of document.querySelectorAll(".vx-sidebar nav button"))
  b.onclick = () => {
    const entry = Object.entries(sections).find(([, name]) => name === text(b));
    if (entry) navigate(entry[0]);
  };
document.querySelector(".vx-brand").onclick = () => navigate('overview');
document.querySelector(".vx-sidebar-bottom button").onclick = () =>
  navigate("profile");
document.querySelector('[aria-label="Sign out"]').onclick = () =>
  (location.href = "/login");
document.querySelector(".vx-mobile-head button").onclick = () => {
  const sidebar = document.querySelector(".vx-sidebar");
  if (sidebar.classList.contains("is-open")) return closeNav();
  sidebar.classList.add("is-open");
  document
    .querySelector(".vx-mobile-head button")
    .setAttribute("aria-expanded", "true");
  const backdrop = document.createElement("div");
  backdrop.className = "vx-nav-backdrop";
  backdrop.onclick = closeNav;
  app.append(backdrop);
};
onButton("Search workspace", openSearch, document);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openSearch();
  }
  if (e.key === "Escape") closeNav();
});
window.addEventListener("popstate", () => route());
function route() {
  const u = new URL(location.href);
  const section =
    location.pathname === "/support"
      ? "support"
      : u.searchParams.get("tab") || "overview";
  const candidate = u.searchParams.get("guide") || "cli";
  const guide =
    /^cli(?:-(?:claude|codex|api|env|reference))?(?:-(?:unix|cmd))?$/.test(
      candidate,
    )
      ? candidate
      : "cli";
  navigate(section, section === "cli" ? guide : section, false);
}
function wireCommon() {
  [
    "Client setup",
    "Connect your client, completed",
    "Send your first request, completed",
  ].forEach((s) => onButton(s, () => navigate("cli")));
  [
    "Manage keys",
    "Manage API keys",
    "Open API keys",
    "Create your first API key, completed",
  ].forEach((s) => onButton(s, () => navigate("keys")));
  ["View requests", "View all", "All requests"].forEach((s) =>
    onButton(s, () => {
      filters = {};
      navigate("logs");
    }),
  );
  onButton("Need help?", () => navigate("support"));
  onButton("Shared across your API keys", () => navigate("wallet"));
}
async function openSearch() {
  const el = await dialog("search-dialog");
  const input = el.querySelector("input");
  const options = [...el.querySelectorAll("[role=option]")];
  let focused = 0;
  options.forEach((option, i) => {
    option.onclick = () => {
      const name = text(option.querySelector("strong"));
      const key = Object.keys(sections).find((k) => sections[k] === name);
      closeDialog();
      navigate(key);
    };
  });
  input.addEventListener("input", () => {
    options.forEach(
      (o) =>
        (o.hidden = !text(o).toLowerCase().includes(input.value.toLowerCase())),
    );
    focused = 0;
  });
  input.addEventListener("keydown", (e) => {
    const visible = options.filter((o) => !o.hidden);
    if (!visible.length) return;
    if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Enter") visible[focused]?.click();
      else {
        focused =
          (focused + (e.key === "ArrowDown" ? 1 : -1) + visible.length) %
          visible.length;
        options.forEach((o) =>
          o.setAttribute("aria-selected", String(o === visible[focused])),
        );
        visible[focused].scrollIntoView({ block: "nearest" });
      }
    }
  });
}
function initOverview() {
  renderRequests(requests.slice(0, 6), false);
  const chart = main.querySelector(".vx-bars");
  const periods = main.querySelector('[aria-label="Activity period"]');
  function draw(period) {
    const n = period === "7d" ? 7 : period === "30d" ? 30 : 24;
    chart.innerHTML = Array.from({ length: n }, (_, i) => {
      const units = ((i * 17 + 9) % 73) * 1000000;
      return `<button class="vx-bar-slot" aria-label="${i + 1}: ${fmt(units)} demo tokens spent" title="${fmt(units)} tokens"><span class="vx-bar-stack" style="height:${units / 800000}%"><i class="vx-bar-spent" style="flex:1"></i></span></button>`;
    }).join("");
    const axis = main.querySelector(".vx-x-axis");
    axis.innerHTML = (
      period === "24h"
        ? ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "now"]
        : period === "7d"
          ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          : ["Day 1", "Day 5", "Day 10", "Day 15", "Day 20", "Day 25", "Day 30"]
    )
      .map((value) => `<span>${value}</span>`)
      .join("");
    chart
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => toast(b.getAttribute("aria-label"))));
    periods
      ?.querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(text(b) === period)),
      );
    const subtitle = main
      .querySelector(".vx-activity h2")
      ?.parentElement.querySelector("p");
    if (subtitle)
      subtitle.textContent =
        period === "24h"
          ? "Last 24 Hours · Hourly"
          : `Last ${period === "7d" ? 7 : 30} Days · Daily`;
  }
  buttons(periods).forEach((b) => (b.onclick = () => draw(text(b))));
  draw("24h");
  onButton("Details", () => openPricing());
  main.querySelectorAll(".vx-charge-groups button").forEach((b) => {
    if (text(b) !== "Details")
      b.onclick = () => openPricing(text(b).replace(/\s*\d+$/, ""));
  });
}
async function openPricing(family = "All models") {
  const el = await dialog("pricing-dialog");
  const input = el.querySelector("input");
  const articles = [...el.querySelectorAll("article")];
  let selected = family;
  const familyOf = (name) =>
    /^gpt/.test(name)
      ? "GPT"
      : /^claude/.test(name)
        ? "Claude"
        : /^gemini/.test(name)
          ? "Google"
          : /^grok/.test(name)
            ? "xAI"
            : /^dawvq/.test(name)
              ? "Other"
              : "Chinese";
  function apply() {
    articles.forEach(
      (a) =>
        (a.hidden =
          !(
            selected === "All models" ||
            familyOf(text(a.querySelector("h3"))) === selected
          ) || !text(a).toLowerCase().includes(input.value.toLowerCase())),
    );
    el.querySelectorAll('[aria-label="Model family"] button').forEach((b) =>
      b.setAttribute("aria-pressed", String(text(b) === selected)),
    );
    const count = el.querySelector(".vx-model-results-count [aria-live]");
    if (count)
      count.textContent = `${articles.filter((a) => !a.hidden).length} / ${articles.length}`;
  }
  input.oninput = apply;
  el.querySelectorAll('[aria-label="Model family"] button').forEach(
    (b) =>
      (b.onclick = () => {
        selected = text(b);
        apply();
      }),
  );
  apply();
}
function renderRequests(rows, selectable) {
  const tbody = main.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = rows
    .map(
      (r) =>
        `<tr>${selectable ? `<td class="vx-check-cell"><input type="checkbox" aria-label="Select ${r.id}"></td>` : ""}<td><button class="demo-request-link" data-request="${r.id}"><i class="demo-status-dot ${r.status === "Failed" ? "failed" : ""}"></i>${r.id}</button></td><td><button data-model="${r.model}">${r.model}</button></td><td><strong>${fmt(r.input + r.output)}</strong><div>input ${fmt(r.input)}</div><div>output ${fmt(r.output)}</div></td><td><span>ceil((${fmt(r.input)} + ${fmt(r.output)}) × ${r.multiplier})</span><div><strong>= ${fmt(spent(r))} tokens</strong></div></td><td>${r.latency.toFixed(2)}s</td></tr>`,
    )
    .join("");
  if (!rows.length)
    tbody.innerHTML = `<tr><td class="demo-empty" colspan="6">No requests match your filters.</td></tr>`;
  tbody
    .querySelectorAll("[data-request]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openRequest(requests.find((r) => r.id === b.dataset.request))),
    );
  tbody.querySelectorAll("[data-model]").forEach(
    (b) =>
      (b.onclick = () => {
        filters = { model: b.dataset.model };
        navigate("logs");
      }),
  );
}
function initLogs() {
  logPage = 1;
  let all = [];
  let hiddenColumns = new Set();
  function update() {
    all = filterRequests(requests, filters);
    if (sortKey)
      all.sort((a, b) => {
        const x =
          sortKey === "tokens"
            ? a.input + a.output
            : sortKey === "spent"
              ? spent(a)
              : a[sortKey];
        const y =
          sortKey === "tokens"
            ? b.input + b.output
            : sortKey === "spent"
              ? spent(b)
              : b[sortKey];
        return (
          (typeof x === "string" ? x.localeCompare(y) : x - y) *
          (sortAsc ? 1 : -1)
        );
      });
    const pages = Math.max(1, Math.ceil(all.length / 25));
    logPage = Math.min(logPage, pages);
    renderRequests(all.slice((logPage - 1) * 25, logPage * 25), true);
    const pager = main.querySelector(".vx-pagination");
    pager.querySelector(":scope > span").textContent =
      `${all.length ? (logPage - 1) * 25 + 1 : 0}–${Math.min(logPage * 25, all.length)} of ${all.length}`;
    pager.querySelector("div > span").textContent = `${logPage} / ${pages}`;
    const [prev, next] = buttons(pager);
    prev.disabled = logPage <= 1;
    next.disabled = logPage >= pages;
    prev.onclick = () => {
      logPage--;
      update();
    };
    next.onclick = () => {
      logPage++;
      update();
    };
    const count = main.querySelector("h1 small");
    if (count) count.textContent = `${all.length} matching`;
    main.querySelector(".vx-results-summary > strong").textContent =
      `${all.length} requests match`;
    main
      .querySelectorAll("tr")
      .forEach((row) =>
        [...row.children].forEach(
          (cell, i) => (cell.hidden = hiddenColumns.has(i)),
        ),
      );
  }
  const searchInput = main.querySelector('[aria-label="Search requests"]');
  searchInput.value = filters.query || "";
  searchInput.addEventListener("input", (e) => {
    filters.query = e.target.value;
    logPage = 1;
    update();
  });
  const model = selectControl(
    main.querySelector('[aria-label^="Filter by model"]'),
    ["All models", ...new Set(requests.map((r) => r.model))],
    (value) => {
      filters.model = value;
      logPage = 1;
      update();
    },
  );
  if (model) model.value = filters.model || "All models";
  const statusSelect = selectControl(
    main.querySelector('[aria-label^="Filter by status"]'),
    ["All statuses", "Completed", "Failed"],
    (value) => {
      filters.status = value;
      logPage = 1;
      update();
    },
  );
  statusSelect.value = filters.status || "All statuses";
  main
    .querySelector(".vx-filter-toggle")
    .setAttribute("aria-pressed", String(Boolean(filters.slow)));
  buttons(main)
    .find((b) => text(b).replace(/\s/g, "") === "Latency>2s")
    ?.addEventListener("click", (e) => {
      filters.slow = !filters.slow;
      e.currentTarget.setAttribute("aria-pressed", filters.slow);
      logPage = 1;
      update();
    });
  main.querySelector('[aria-label="Select visible requests"]').onchange = (e) =>
    main
      .querySelectorAll("tbody input[type=checkbox]")
      .forEach((c) => (c.checked = e.target.checked));
  main.querySelectorAll("thead button").forEach(
    (b) =>
      (b.onclick = () => {
        sortKey = text(b).toLowerCase();
        sortAsc = !sortAsc;
        update();
      }),
  );
  onButton("Refresh requests", () => {
    update();
    toast("Demo requests refreshed.");
  });
  onButton("Export page", () => {
    const rows = all.slice((logPage - 1) * 25, logPage * 25);
    const blob = new Blob([csvRows(rows)], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "demo-requests.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  onButton("Columns", () => {
    const el = customDialog(
      "Visible columns",
      ["Request", "Model", "Tokens", "Spent", "Latency"]
        .map(
          (name, i) =>
            `<label><input type="checkbox" data-column="${i + 1}" ${hiddenColumns.has(i + 1) ? "" : "checked"}> ${name}</label>`,
        )
        .join(""),
    );
    el.querySelectorAll("input").forEach(
      (c) =>
        (c.onchange = () => {
          const n = Number(c.dataset.column);
          c.checked ? hiddenColumns.delete(n) : hiddenColumns.add(n);
          update();
        }),
    );
  });
  update();
}
async function openRequest(r) {
  await navigate("request-detail", "request-detail");
  main
    .querySelectorAll(".vx-breadcrumb button")
    .forEach((b) => (b.onclick = () => navigate("logs")));
  const h1 = main.querySelector("h1");
  h1.innerHTML = `${r.model} <span class="vx-badge ${r.status.toLowerCase()}">${r.status}</span>`;
  const detail = main.querySelector(".vx-detail-metrics");
  if (detail) {
    const vals = [
      `${r.latency}s`,
      r.status === "Completed" ? "200" : "429",
      fmt(r.input + r.output),
      fmt(spent(r)),
      r.model,
    ];
    detail
      .querySelectorAll("strong")
      .forEach((e, i) => (e.textContent = vals[i] || e.textContent));
  }
  main.querySelectorAll("strong,.vx-breadcrumb span").forEach((e) => {
    if (e.textContent.includes("demo000")) e.textContent = r.id;
  });
  const total = spent(r);
  main.querySelector(".vx-request-cost small").textContent =
    `ceil((${fmt(r.input)} + ${fmt(r.output)}) × ${r.multiplier})`;
  main.querySelector(".vx-request-cost strong").textContent =
    `= ${fmt(total)} tokens`;
  main
    .querySelectorAll(".vx-duration-labels span")
    .forEach(
      (e, i) => (e.textContent = `${Math.round((r.latency * 1000 * i) / 2)}ms`),
    );
  main
    .querySelectorAll(".vx-usage-heading div span")
    .forEach((e, i) => (e.textContent = fmt(Math.round((total * i) / 2))));
  main.querySelectorAll(".vx-usage-row").forEach((row, i) => {
    const value = [r.input, 0, 0, r.output, 0, total][i];
    row.querySelector("strong").textContent = value ? fmt(value) : "—";
    row.querySelector("i").style.width = `${(value / total) * 100}%`;
  });
  main.querySelectorAll(".vx-info-line").forEach((row) => {
    const key = text(row.querySelector("span"));
    const values = {
      "Request ID": r.id,
      Created: "Demo request",
      "API key": "Primary API key",
      Multiplier: `×${r.multiplier}`,
    };
    if (key in values) row.querySelector("strong").textContent = values[key];
  });
  main.querySelector(".vx-info-status > span:last-child").textContent =
    r.status;
  onButton("Refresh request", () => toast("Demo request refreshed."));
  onButton("Raw", () => {
    const el = customDialog("Raw request metadata", "<pre></pre>");
    el.querySelector("pre").textContent = JSON.stringify(
      { ...r, spent: spent(r), endpoint: "/v1/chat/completions" },
      null,
      2,
    );
  });
  onButton("Usage", () => toast("Showing recorded demo usage."));
}
function initKeys() {
  let search = "",
    status = "All keys";
  const rows = main.querySelector(".vx-key-rows");
  const template = rows.querySelectorAll(".vx-key-row")[1].cloneNode(true);
  function render() {
    rows.replaceChildren();
    keys
      .filter(
        (k) =>
          k.name.toLowerCase().includes(search.toLowerCase()) &&
          (status === "All keys" || (status === "Active") === k.active),
      )
      .forEach((k) => {
        const row = template.cloneNode(true);
        row.querySelector("h3").textContent = k.name;
        const secret = row.querySelector("code");
        if (secret) secret.textContent = "sk_demo_••••preview";
        const actions = buttons(row);
        actions.forEach((b) => {
          const action = label(b).split(" ")[0];
          b.setAttribute("aria-label", `${action} ${k.name}`);
          if (action === "Show")
            b.onclick = () => {
              const el = customDialog(
                "Demo API key",
                "<p>This key is a non-functional placeholder.</p><pre>sk_demo_preview_only</pre><button data-copy>Copy demo key</button>",
              );
              el.querySelector("[data-copy]").onclick = () =>
                copy("sk_demo_preview_only");
            };
          if (action === "Edit") b.onclick = () => editKey(k, render);
          if (action === "Pause") {
            b.hidden = k.primary;
            b.setAttribute(
              "aria-label",
              `${k.active ? "Pause" : "Resume"} ${k.name}`,
            );
            b.onclick = () => {
              k.active = !k.active;
              render();
            };
          }
          if (action === "Revoke") {
            b.hidden = k.primary;
            b.onclick = () => {
              const el = customDialog(
                "Revoke demo key?",
                `<p>${esc(k.name)} will be removed from this preview only.</p><button data-revoke>Revoke key</button>`,
              );
              el.querySelector("[data-revoke]").onclick = () => {
                keys = keys.filter((x) => x.id !== k.id);
                el.close();
                render();
              };
            };
          }
        });
        const foot = row.querySelector(".vx-key-row-foot");
        foot.textContent = `${k.active ? "Active" : "Paused"} · ${k.models ? k.models.length + " models" : "All offered models"} · ${k.limit ? fmt(k.limit) + " token limit" : "No additional key limit"}`;
        rows.append(row);
      });
    if (!rows.children.length) {
      const p = document.createElement("p");
      p.className = "demo-empty";
      p.textContent = "No API keys match.";
      rows.append(p);
    }
    main.querySelector(".vx-keys-slots").textContent =
      `${keys.length} / 6 keys`;
    main.querySelector(".vx-key-active-count").textContent =
      `${keys.filter((k) => k.active).length} active`;
    main.querySelector('.vx-key-list > footer').firstChild.textContent = `${rows.querySelectorAll('.vx-key-row').length} of ${keys.length} keys`;
    main
      .querySelector(".vx-key-section-heading small")
      ?.replaceChildren(`${6 - keys.length} slots available`);
  }
  main.querySelector('[aria-label="Search API keys"]').oninput = (e) => {
    search = e.target.value;
    render();
  };
  selectControl(
    main.querySelector('[aria-label^="Filter by status"]'),
    ["All keys", "Active", "Paused"],
    (v) => {
      status = v;
      render();
    },
  );
  const limit = main.querySelector("#new-api-key-limit");
  limit.value = 100;
  const unlimited = main.querySelector(".vx-token-limit-head button");
  unlimited.onclick = () => {
    limit.disabled = !limit.disabled;
    unlimited.setAttribute("aria-pressed", String(limit.disabled));
    main
      .querySelector(".vx-token-limit")
      .classList.toggle("is-unlimited", limit.disabled);
    updateLimit();
  };
  const updateLimit = () => {
    main.querySelector(".vx-token-limit-head > span").textContent =
      limit.disabled
        ? "No limit"
        : `${fmt(Number(limit.value) * 1000000)} tokens`;
    limit.style.setProperty(
      "--limit-fill",
      `${(Number(limit.value) / Number(limit.max)) * 100}%`,
    );
  };
  limit.oninput = updateLimit;
  main.querySelector(".vx-key-model-trigger").onclick = () => openModels();
  const form = main.querySelector(".vx-key-create-form");
  form.onsubmit = (e) => {
    e.preventDefault();
    const input = main.querySelector("#new-api-key-name");
    const name = input.value.trim();
    if (!name) return toast("Enter a key name.");
    if (keys.length >= 6) return toast("You can create up to 6 demo keys.");
    keys.push({
      id: ++keyId,
      name: name.slice(0, 80),
      active: true,
      primary: false,
      limit: limit.disabled ? null : Number(limit.value) * 1000000,
      models: selectedModels,
    });
    input.value = "";
    render();
    toast("Demo key created. It cannot authenticate API requests.");
  };
  onButton("Copy API base URL", () => copy("https://api.dawvq.com/v1"));
  onButton("Copy example request", () =>
    copy(
      'curl https://api.dawvq.com/v1/models -H "Authorization: Bearer YOUR_DAWVQ_API_KEY"',
    ),
  );
  render();
}
function editKey(key, done) {
  const el = customDialog(
    "Edit API key",
    `<form><label>Key name<input name="name" required maxlength="80" value="${esc(key.name)}"></label><label>Token limit (leave empty for unlimited)<input name="limit" type="number" min="0" max="10000000000" value="${key.limit || ""}"></label><footer><button type="submit">Save changes</button></footer></form>`,
  );
  el.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const name = String(data.get("name")).trim();
    if (!name) return;
    key.name = name;
    key.limit = data.get("limit") === "" ? null : Number(data.get("limit"));
    el.close();
    done();
    toast("Demo key updated.");
  };
}
async function openModels() {
  const el = await dialog("models-dialog");
  const checks = [...el.querySelectorAll("input[type=checkbox]")];
  const name = (c) => text(c.closest("label").querySelector("small"));
  if (selectedModels)
    checks.forEach((c) => (c.checked = selectedModels.includes(name(c))));
  const input = el.querySelector("input:not([type=checkbox])");
  input.oninput = () =>
    checks.forEach(
      (c) =>
        (c.closest("label").hidden = !text(c.closest("label"))
          .toLowerCase()
          .includes(input.value.toLowerCase())),
    );
  const update = () => {
    const count = checks.filter((c) => c.checked).length;
    el.querySelector(".vx-key-picker-tools > div > span").textContent =
      `${count} / ${checks.length}`;
    el.querySelectorAll(".vx-key-picker-list section").forEach((section) => {
      const inputs = [...section.querySelectorAll("input")];
      section.querySelector("h3 > span:last-child").textContent =
        `${inputs.filter((c) => c.checked).length} / ${inputs.length}`;
    });
    const footer = el.querySelector("footer > span");
    if (footer)
      footer.textContent =
        count === checks.length
          ? "All offered models"
          : `${count} models selected`;
  };
  checks.forEach((c) => (c.onchange = update));
  onButton(
    "Select all",
    () => {
      checks.forEach((c) => (c.checked = true));
      update();
    },
    el,
  );
  onButton(
    "Clear all",
    () => {
      checks.forEach((c) => (c.checked = false));
      update();
    },
    el,
  );
  onButton(
    "Save models",
    () => {
      const selected = checks.filter((c) => c.checked).map(name);
      if (!selected.length) return toast("Select at least one model.");
      selectedModels = selected.length === checks.length ? null : selected;
      const trigger = main.querySelector(".vx-key-model-trigger > span");
      if (trigger)
        trigger.textContent = selectedModels
          ? `${selected.length} models`
          : "All offered models";
      el.close();
    },
    el,
  );
  update();
}
function initSetup(view) {
  os = view.endsWith("-unix") ? "unix" : view.endsWith("-cmd") ? "cmd" : "";
  currentGuide = view.replace(/-(unix|cmd)$/, "");
  selectedModel = "";
  const guideButtons = [
    ...main.querySelectorAll('[aria-label="Setup guides"] button'),
  ];
  guideButtons.forEach(
    (b, i) =>
      (b.onclick = () =>
        navigate(
          "cli",
          guides[i] +
            (i === 0
              ? ""
              : os
                ? `-${os === "cmd" && i !== 4 ? "" : os}`.replace(/-$/, "")
                : ""),
        )),
  );
  for (const [name, value] of [
    ["PowerShell", ""],
    ["macOS / Linux", "unix"],
    ["CMD", "cmd"],
  ])
    onButton(name, () =>
      navigate("cli", currentGuide + (value ? `-${value}` : "")),
    );
  const keyButton = main.querySelector('[aria-label="Setup API key"]');
  const keySelect = selectControl(
    keyButton,
    ["Select an API key", ...keys.filter((k) => k.active).map((k) => k.name)],
    (value) => {
      selectedSetupKey = value === "Select an API key" ? "" : value;
      applyKey();
    },
  );
  if (keySelect) keySelect.value = selectedSetupKey || "Select an API key";
  function applyKey() {
    main.querySelectorAll("pre code").forEach((code) => {
      code.textContent = code.textContent
        .replaceAll(
          "YOUR_DAWVQ_API_KEY",
          selectedSetupKey ? "sk_demo_preview_only" : "YOUR_DAWVQ_API_KEY",
        )
        .replaceAll(
          "sk_demo_preview_only",
          selectedSetupKey ? "sk_demo_preview_only" : "YOUR_DAWVQ_API_KEY",
        );
    });
    const show = main.querySelector('[aria-label="Show API key"]');
    if (show) {
      show.disabled = !selectedSetupKey;
      show.onclick = () => toast("Demo key: sk_demo_preview_only");
    }
    const copyButton = buttons(main).find((b) => label(b) === "Copy key");
    if (copyButton) {
      copyButton.disabled = !selectedSetupKey;
      copyButton.onclick = () => copy("sk_demo_preview_only");
    }
  }
  main
    .querySelectorAll('button[aria-label^="Copy "]')
    .forEach(
      (b) =>
        (b.onclick = () =>
          copy(
            b.closest(".st-code")?.querySelector("code")?.textContent ||
              "sk_demo_preview_only",
          )),
    );
  onButton("https://api.dawvq.com/v1", () => copy("https://api.dawvq.com/v1"));
  applyKey();
  const models = buttons(main).filter((b) => /^(gpt-|claude-)/.test(text(b)));
  for (const b of models) {
    const select = selectControl(
      b,
      [text(b), "gpt-6-astra", "claude-opus-5", "dawvqBEAST"].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      (value) => {
        const old = selectedModel || text(b);
        main
          .querySelectorAll("code")
          .forEach(
            (c) => (c.textContent = c.textContent.replaceAll(old, value)),
          );
        selectedModel = value;
      },
    );
  }
}
function initWallet() {
  main.querySelector(
    '[aria-label="Wallet balance"] > div:last-child strong',
  ).textContent = keys.filter((k) => k.active).length;
  const balance = main.querySelector('[aria-label="Show balance in tokens"]');
  let tokens = false;
  balance.onclick = () => {
    tokens = !tokens;
    balance.querySelector("strong").textContent = tokens
      ? "240,000,000"
      : "$12.00";
    balance.setAttribute(
      "aria-label",
      tokens ? "Show balance in USD" : "Show balance in tokens",
    );
    const caption = balance.querySelector(":scope > span:last-child");
    if (caption)
      caption.textContent = tokens
        ? "Tokens · Click to show USD"
        : "USD · Click to show tokens";
  };
  onButton("Add Tokens", openTopup);
  const tabs = main.querySelector('[aria-label="Transaction type"]');
  buttons(tabs).forEach(
    (b) =>
      (b.onclick = () => {
        buttons(tabs).forEach((x) => x.setAttribute("aria-pressed", x === b));
        main.querySelector("h3").textContent =
          text(b) === "All"
            ? "No wallet activity yet"
            : `No ${text(b).toLowerCase()} transactions`;
      }),
  );
}
async function openTopup() {
  const el = await dialog("topup-dialog");
  const amount = el.querySelector("#topup-amount");
  const range = el.querySelector("input[type=range]");
  amount.disabled = false;
  amount.value = 10;
  amount.min = 1;
  amount.max = 200;
  range.min = 1;
  range.max = 200;
  range.step = 1;
  range.value = 10;
  range.disabled = false;
  function update(value) {
    const number = Number(value);
    el.querySelector(".wallet-simple-summary strong").textContent =
      `${fmt(Math.max(0, number) * 20000000)} tokens`;
    el.querySelector(".wallet-pay").disabled =
      !Number.isFinite(number) || number < 1 || number > 200;
  }
  amount.oninput = () => {
    range.value = amount.value;
    update(amount.value);
  };
  range.oninput = () => {
    amount.value = range.value;
    update(range.value);
  };
  buttons(el.querySelector(".wallet-presets")).forEach(
    (b) =>
      (b.onclick = () => {
        amount.value = Number(text(b).replace("$", ""));
        range.value = amount.value;
        update(amount.value);
      }),
  );
  onButton(
    "Cryptocurrency and network",
    () => {
      const select = selectControl(
        el.querySelector(".wallet-coin-trigger"),
        ["Litecoin · LTC", "Bitcoin · BTC", "USDT · TRON", "USDC · Ethereum"],
        () => {},
      );
      select?.focus();
    },
    el,
  );
  el.querySelector(".wallet-pay").onclick = () => {
    const p = el.querySelector(".wallet-simple-footnote");
    p.textContent =
      "Frontend preview — no payment was created and no funds were moved.";
    toast("Payment checkout requires a backend.");
  };
  update(10);
}
function initProfile() {
  main.querySelector(
    '[aria-label="Account summary"] > div:nth-child(2) strong',
  ).textContent = keys.length;
  const button = buttons(main).find((b) =>
    label(b).startsWith("Getting started"),
  );
  if (button)
    button.onclick = () => {
      const list = main.querySelector("ol") || main.querySelector("ul");
      if (list) {
        list.hidden = !list.hidden;
        button.setAttribute("aria-expanded", String(!list.hidden));
      }
    };
  buttons(main)
    .filter((b) => label(b).startsWith("Add funds"))
    .forEach((b) => (b.onclick = () => navigate("wallet")));
  buttons(main)
    .filter((b) => label(b).startsWith("Create your profile"))
    .forEach((b) => (b.onclick = () => toast("Your demo profile is ready.")));
}
function initReferrals() {
  const input = main.querySelector("input");
  input.value = `${location.origin}/register?ref=demo`;
  onButton("Copy invite link", () => copy(input.value));
}
function initSupport(view) {
  const showNew = () => navigate("support", "support-new");
  onButton("New ticket", showNew);
  onButton("Start a conversation", showNew);
  onButton("Cancel", () => navigate("support"));
  onButton("Refresh tickets", () => {
    renderTickets();
    toast("Demo tickets refreshed.");
  });
  const sound = main.querySelector(".sp-sound");
  sound.onclick = () => {
    const muted = sound.getAttribute("aria-pressed") !== "true";
    sound.setAttribute("aria-pressed", String(muted));
    sound.setAttribute(
      "aria-label",
      muted ? "Mute ticket sounds" : "Enable ticket sounds",
    );
  };
  selectControl(
    main.querySelector('[aria-label="Ticket status"]'),
    ["All statuses", "Open", "Closed"],
    (value) => renderTickets(value),
  );
  function renderTickets(status = "All statuses") {
    const list = main.querySelector(".sp-ticket-list");
    list.replaceChildren();
    const shown = tickets.filter(
      (t) => status === "All statuses" || t.status === status,
    );
    for (const ticket of shown) {
      const b = document.createElement("button");
      b.className = "demo-ticket";
      b.innerHTML = `${esc(ticket.subject)}<small>${ticket.status} · ${ticket.category} · Demo</small>`;
      b.onclick = () => openTicket(ticket);
      list.append(b);
    }
    if (!shown.length) {
      const p = document.createElement("p");
      p.className = "sp-list-empty";
      p.textContent = "No tickets here yet.";
      list.append(p);
    }
  }
  if (view === "support-new") {
    const form = main.querySelector("form");
    selectControl(
      form.querySelector('[aria-label="Ticket category"]'),
      ["Account", "API access", "Payments", "Other"],
      () => {},
    );
    const inputs = [...form.querySelectorAll("input,textarea")];
    const submit =
      form.querySelector("[type=submit]") ||
      buttons(form).find((b) => text(b) === "Create ticket");
    const message = form.querySelector("textarea");
    message.maxLength = 4000;
    const subject = form.querySelector("input");
    subject.required = true;
    subject.maxLength = 120;
    message.required = true;
    const update = () => {
      submit.disabled = !subject.value.trim() || !message.value.trim();
      form.querySelector(".sp-character-count").textContent =
        `${message.value.length} / 4,000`;
    };
    inputs.forEach((i) => i.addEventListener("input", update));
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!subject.value.trim() || !message.value.trim()) return;
      tickets.push({
        id: ++ticketId,
        subject: subject.value.trim(),
        message: message.value.trim(),
        category: form.querySelector("select").value,
        status: "Open",
        replies: [],
      });
      navigate("support");
      toast("Demo ticket created locally. Nothing was sent to support.");
    };
    update();
  }
  renderTickets();
}
function openTicket(ticket) {
  const el = customDialog(
    ticket.subject,
    `<p>${esc(ticket.category)} · ${ticket.status} · Local demo</p><div class="demo-reply">${esc(ticket.message)}</div><div data-replies></div><form><label>Reply<textarea name="reply" required maxlength="4000"></textarea></label><footer><button type="submit">Add demo reply</button><button type="button" data-close-ticket>${ticket.status === "Open" ? "Close ticket" : "Reopen ticket"}</button></footer></form>`,
  );
  const replies = el.querySelector("[data-replies]");
  const render = () =>
    (replies.innerHTML = ticket.replies
      .map((r) => `<div class="demo-reply">${esc(r)}</div>`)
      .join(""));
  render();
  el.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const input = el.querySelector("textarea");
    if (!input.value.trim()) return;
    ticket.replies.push(input.value.trim());
    input.value = "";
    render();
    toast("Reply saved in this preview only.");
  };
  el.querySelector("[data-close-ticket]").onclick = () => {
    ticket.status = ticket.status === "Open" ? "Closed" : "Open";
    el.close();
    navigate("support");
  };
}
route();
