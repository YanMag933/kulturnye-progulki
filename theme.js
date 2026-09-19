/**
 * Тема оформления: slate | crystal | marble | basalt
 * Хранится в localStorage, применяется на html[data-theme]
 */
(function () {
  const KEY = "kp_theme";
  const THEMES = ["slate", "crystal", "marble", "basalt"];

  function apply(theme) {
    const t = THEMES.includes(theme) ? theme : "slate";
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch (_) {}
    document.querySelectorAll("[data-theme-pick]").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-theme-pick") === t);
      el.setAttribute("aria-pressed", el.getAttribute("data-theme-pick") === t ? "true" : "false");
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const colors = { slate: "#0e0e10", crystal: "#050814", marble: "#e8e6e2", basalt: "#101010" };
      meta.setAttribute("content", colors[t] || "#0e0e10");
    }
  }

  function current() {
    try {
      return localStorage.getItem(KEY) || "slate";
    } catch (_) {
      return "slate";
    }
  }

  apply(current());

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-pick]");
    if (!btn) return;
    apply(btn.getAttribute("data-theme-pick"));
  });

  window.KP_theme = { apply, current, THEMES };
})();
