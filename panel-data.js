export const sections = {
  overview: "Overview",
  keys: "API keys",
  logs: "Requests",
  cli: "Setup",
  wallet: "Wallet",
  profile: "Profile",
  referrals: "Referral program",
  support: "Support",
};
export const guides = [
  "cli",
  "cli-claude",
  "cli-codex",
  "cli-api",
  "cli-env",
  "cli-reference",
];
export const requests = Array.from({ length: 48 }, (_, i) => ({
  id: `demo-request-${String(i + 1).padStart(4, "0")}`,
  model: ["dawvqBEAST", "gpt-6-astra", "claude-opus-5", "gemini-3.7-flash"][
    i % 4
  ],
  input: 1200 + i * 137,
  output: 180 + i * 11,
  multiplier: [3, 10, 5, 2][i % 4],
  latency: Number((0.85 + (i % 9) * 0.43).toFixed(2)),
  status: i % 17 === 16 ? "Failed" : "Completed",
}));
export const spent = (r) => Math.ceil((r.input + r.output) * r.multiplier);
export function filterRequests(
  rows,
  {
    query = "",
    model = "All models",
    status = "All statuses",
    slow = false,
  } = {},
) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || `${r.id} ${r.model}`.toLowerCase().includes(q)) &&
      (model === "All models" || r.model === model) &&
      (status === "All statuses" || r.status === status) &&
      (!slow || r.latency > 2),
  );
}
export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function csvRows(rows) {
  return [
    ["Request", "Model", "Input", "Output", "Spent", "Latency", "Status"],
    ...rows.map((r) => [
      r.id,
      r.model,
      r.input,
      r.output,
      spent(r),
      r.latency,
      r.status,
    ]),
  ]
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}
