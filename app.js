import { initAccessArt } from "./access-art.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const landing = document.querySelector(".dn-landing");
const running = () => !reduceMotion.matches && !document.hidden;
function updateMotion() {
  if (landing) landing.dataset.motion = running() ? "running" : "paused";
}
reduceMotion.addEventListener("change", updateMotion);
document.addEventListener("visibilitychange", updateMotion);
updateMotion();

if (landing) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        target.dataset.active = String(isIntersecting);
        if (isIntersecting) target.classList.add("dn-seen");
      }
    },
    { threshold: 0.12 },
  );
  document
    .querySelectorAll(
      ".dn-feature, .dn-step, .dn-section-heading, .dn-preview-wrap, .dn-final-cta, .dn-faq-list, .dn-hero, .dn-activity-widget",
    )
    .forEach((element) => {
      element.classList.add("dn-reveal");
      observer.observe(element);
    });
  landing.dataset.enhanced = "true";
  const platforms = [...document.querySelectorAll(".dn-platforms > span")];
  let selected = 0;
  function select(index) {
    const indicator = document.querySelector(".dn-platforms i");
    platforms.forEach((el, i) => el.classList.toggle("is-active", i === index));
    if (indicator) platforms[index].append(indicator);
    selected = index;
  }
  platforms.forEach((el, index) =>
    el.addEventListener("mouseenter", () => select(index)),
  );
  setInterval(() => {
    if (running() && !document.querySelector(".dn-platforms:hover"))
      select((selected + 1) % platforms.length);
  }, 2400);
  for (const card of document.querySelectorAll(".dn-activity-model")) {
    const button = card.querySelector("button");
    button.addEventListener("click", () => {
      const paused = card.dataset.modelPaused !== "true";
      card.dataset.modelPaused = String(paused);
      button.setAttribute("aria-pressed", String(paused));
      button.setAttribute(
        "aria-label",
        `${paused ? "Resume" : "Pause"} ${card.querySelector("h4").textContent} animation`,
      );
      button.querySelector("svg").innerHTML = paused
        ? '<path d="M5 3l16 9-16 9z"/>'
        : '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>';
    });
  }
  initComparison();
  initCode();
  initRun();
}

function initComparison() {
  const stage = document.querySelector(".dn-request-stage");
  const output = stage.querySelector(".dn-request-output");
  const divider = stage.querySelector(".dn-request-divider");
  const note = document.querySelector(".dn-compare-note");
  const buttons = [...document.querySelectorAll(".dn-compare-tabs button")];
  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = "100";
  range.value = "53";
  range.setAttribute("aria-label", "Blend request and response");
  note.after(range);
  let value = 53,
    mode = "Split";
  function render() {
    stage.dataset.split = String(mode === "Split");
    divider.hidden = mode !== "Split";
    range.hidden = mode !== "Overlay";
    output.style.clipPath = mode === "Split" ? `inset(0 0 0 ${value}%)` : "";
    output.style.opacity = mode === "Overlay" ? (100 - value) / 100 : 1;
    divider.style.left = `${value}%`;
    divider.setAttribute("aria-valuenow", value);
    for (const el of [divider, range])
      el.setAttribute(
        "aria-valuetext",
        `${value}% request, ${100 - value}% response`,
      );
    note.textContent =
      mode === "Split"
        ? "Drag the divider to explore."
        : mode === "Overlay"
          ? "Request — Blend the views — Response"
          : "An example of streamed output.";
    buttons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.textContent === mode)),
    );
  }
  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      mode = button.textContent;
      render();
    }),
  );
  const move = (event) => {
    const box = stage.getBoundingClientRect();
    value = Math.round(
      Math.max(
        0,
        Math.min(100, ((event.clientX - box.left) / box.width) * 100),
      ),
    );
    range.value = value;
    render();
  };
  stage.addEventListener("pointerdown", (event) => {
    if (mode === "Split" && event.isPrimary && event.button === 0) {
      stage.setPointerCapture(event.pointerId);
      move(event);
    }
  });
  stage.addEventListener("pointermove", (event) => {
    if (stage.hasPointerCapture(event.pointerId)) move(event);
  });
  for (const name of ["pointerup", "pointercancel"])
    stage.addEventListener(name, (event) => {
      if (stage.hasPointerCapture(event.pointerId))
        stage.releasePointerCapture(event.pointerId);
    });
  range.addEventListener("input", () => {
    value = Number(range.value);
    render();
  });
  divider.addEventListener("keydown", (event) => {
    const deltas = {
      ArrowLeft: -2,
      ArrowDown: -2,
      ArrowRight: 2,
      ArrowUp: 2,
      PageDown: -10,
      PageUp: 10,
    };
    if (event.key in deltas || ["Home", "End"].includes(event.key)) {
      event.preventDefault();
      value =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? 100
            : Math.max(0, Math.min(100, value + deltas[event.key]));
      range.value = value;
      render();
    }
  });
  render();
}

function initCode() {
  const reply = document.querySelector(".dn-code-reply p");
  const code = document.querySelector(".dn-code-answer code");
  const example =
    '#include "updater/Updater.hpp"\n\nint main() {\n  if (!Updater::Init()) return 1;\n  return 0;\n}';
  let tick = reduceMotion.matches ? 120 : 0;
  const render = () => {
    reply.firstChild.textContent = "Can’t respond.".slice(
      0,
      Math.max(0, tick - 5),
    );
    code.firstChild.textContent = example.slice(
      0,
      Math.max(0, (tick - 28) * 2),
    );
  };
  render();
  setInterval(() => {
    if (running()) {
      tick = (tick + 1) % 160;
      render();
    }
  }, 65);
}

function initRun() {
  const scene = document.querySelector(".dn-run-scene");
  const durations = [1300, 1800, 1400, 1700, 1100, 2700];
  const statuses = [
    "Inspecting example",
    "Issue detected",
    "Removing old line",
    "Inserting replacement",
    "Replaying example",
    "Example passed",
  ];
  const examples = [
    [
      "response.ts",
      "Read the generated text",
      "The output field is undefined.",
      "const text = response.text;",
      "const text = response.output_text;",
      "render(text);",
    ],
    [
      "client.ts",
      "Wait for the response",
      "The request is still pending.",
      "const result = generate(prompt);",
      "const result = await generate(prompt);",
      "render(result);",
    ],
    [
      "request.ts",
      "Remove the duplicate call",
      "The same request is sent twice.",
      "await generate(prompt); // duplicate",
      "render(result); // reuse response",
      "return result;",
    ],
  ];
  let step = 0,
    paused = false,
    elapsed = 0;
  const pause = scene.querySelector("button");
  function render() {
    const phase = step % 6,
      example = examples[Math.floor(step / 6)];
    scene.dataset.phase = phase;
    scene.dataset.moving = String(running() && !paused);
    scene.querySelector(".dn-run-scene-title > span").textContent = example[1];
    scene.querySelector(".dn-run-editor header span").textContent = example[0];
    scene
      .querySelector(".dn-run-issue")
      .classList.toggle("is-visible", phase >= 1);
    scene.querySelector(".dn-run-issue p").textContent =
      phase === 5 ? "The example now completes successfully." : example[2];
    scene.querySelector(".dn-run-issue div > span").firstChild.textContent =
      phase === 5 ? "Resolved " : "Issue detected ";
    const removed = scene.querySelector(".dn-run-removed"),
      added = scene.querySelector(".dn-run-added");
    removed.classList.toggle("is-marked", phase >= 1);
    removed.classList.toggle("is-gone", phase >= 3);
    removed.querySelector("b").textContent = phase >= 1 ? "−" : "";
    removed.querySelector("code").textContent = example[3];
    added.classList.toggle("is-present", phase >= 3);
    added.querySelector("code").textContent = example[4];
    scene.querySelector(".dn-run-line:last-child code").textContent =
      example[5];
    const outcome = scene.querySelector(".dn-run-outcome");
    outcome.classList.toggle("is-success", phase === 5);
    outcome.querySelector("span").lastChild.textContent = statuses[phase];
    outcome.querySelector("small").textContent = `${phase + 1} / 6`;
  }
  pause.addEventListener("click", () => {
    paused = !paused;
    pause.querySelector('svg').innerHTML = paused
      ? '<path d="M5 3l16 9-16 9z"/>'
      : '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>';
    pause.setAttribute("aria-pressed", paused);
    pause.setAttribute(
      "aria-label",
      `${paused ? "Resume" : "Pause"} code animation`,
    );
    render();
  });
  scene
    .querySelector('button[aria-label="Replay code animation"]')
    .addEventListener("click", () => {
      step = 0;
      elapsed = 0;
      render();
    });
  setInterval(() => {
    if (running() && !paused) {
      elapsed += 100;
      if (elapsed >= durations[step % 6]) {
        elapsed = 0;
        step = (step + 1) % 18;
        render();
      }
    }
  }, 100);
}

const form = document.querySelector(".access-form");
if (form) {
  document
    .querySelectorAll(".access-visual,.access-panel,.access-captcha > span")
    .forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  initAccessArt();
  document.querySelectorAll(".access-input-action").forEach((button) =>
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute(
        "aria-label",
        `${visible ? "Hide" : "Show"} ${input.id.endsWith("confirmation") ? "confirmed " : ""}password`,
      );
      button.setAttribute("aria-pressed", visible);
    }),
  );
  const checkbox = form.querySelector('input[type="checkbox"]');
  checkbox.addEventListener("change", () => {
    form.querySelector(".access-captcha > span:last-child").textContent =
      checkbox.checked
        ? "Done — you are human"
        : "Confirm that you are not a robot";
    form.querySelector(".access-captcha-box").textContent = checkbox.checked
      ? "✓"
      : "";
    form.querySelector('[type="submit"]').disabled = !checkbox.checked;
  });
  const notice = document.createElement("p");
  notice.className = "access-message";
  notice.setAttribute("role", "status");
  notice.textContent =
    "Frontend preview. Sign-in and account creation require a connected backend.";
  form.after(notice);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = form.querySelector('[id$="-password"]');
    const confirmation = form.querySelector('[id$="-confirmation"]');
    if (!checkbox.checked) {
      notice.textContent = "Confirm that you are not a robot.";
      return;
    }
    if (
      confirmation &&
      (password.value.length < 8 ||
        !/[A-Z]/.test(password.value) ||
        !/\d/.test(password.value) ||
        !/[^\p{L}\p{N}\s]/u.test(password.value))
    ) {
      notice.textContent =
        "At least 8 characters, with an uppercase letter, a number and a symbol.";
      return;
    }
    if (confirmation && confirmation.value !== password.value) {
      notice.textContent = "Passwords do not match.";
      return;
    }
    notice.textContent =
      "Frontend preview — no credentials were sent or saved. Connect your backend to enable this action.";
    form.querySelectorAll("input").forEach((input) => {
      if (input.type !== "checkbox") input.value = "";
    });
  });
}
