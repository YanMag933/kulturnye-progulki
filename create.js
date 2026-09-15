(() => {
  const DB = window.MECHANICS_DB;
  const STORAGE_KEY = "kultprogulki.mechanics.enabled.v1";
  const QUEST_KEY = "kultprogulki.quest.draft.v1";

  const GROUP_LABEL = {
    unique: "Фишка",
    visual: "Визуал",
    text: "Текст",
    puzzle: "Пазл",
    space: "Пространство",
    meaning: "Смысл",
  };

  const DIFF_LABEL = { easy: "лёгкий", medium: "средний", hard: "сложный" };
  const EFFORT_LABEL = { low: "мало", medium: "средне", high: "много" };

  const els = {
    zone: document.getElementById("zone"),
    difficulty: document.getElementById("difficulty"),
    filterGroup: document.getElementById("filter-group"),
    search: document.getElementById("search"),
    stats: document.getElementById("stats"),
    mechanics: document.getElementById("mechanics"),
    slots: document.getElementById("slots"),
  };

  function defaultEnabledMap() {
    const map = {};
    for (const m of DB.mechanics) map[m.id] = !!m.defaultEnabled;
    return map;
  }

  function loadEnabled() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultEnabledMap();
      return { ...defaultEnabledMap(), ...JSON.parse(raw) };
    } catch {
      return defaultEnabledMap();
    }
  }

  function saveEnabled() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  }

  function loadQuest() {
    try {
      const raw = localStorage.getItem(QUEST_KEY);
      if (!raw) return { zone: "garden", difficulty: "medium", slots: [] };
      return JSON.parse(raw);
    } catch {
      return { zone: "garden", difficulty: "medium", slots: [] };
    }
  }

  function saveQuest() {
    localStorage.setItem(
      QUEST_KEY,
      JSON.stringify({
        zone: els.zone.value,
        difficulty: els.difficulty.value,
        slots: questSlots,
      })
    );
  }

  let enabled = loadEnabled();
  let questDraft = loadQuest();
  let questSlots = Array.isArray(questDraft.slots) ? questDraft.slots : [];
  if (questDraft.zone) els.zone.value = questDraft.zone;
  if (questDraft.difficulty) els.difficulty.value = questDraft.difficulty;

  // If no draft yet — seed from demo export (user's ttk-medium set)
  if (!questSlots.length && window.DEMO_EXPORT?.questDraft?.mechanics) {
    els.zone.value = window.DEMO_EXPORT.zone || "ttk";
    els.difficulty.value = window.DEMO_EXPORT.difficulty || "medium";
    questSlots = window.DEMO_EXPORT.questDraft.mechanics.map((m) => m.id);
    for (const id of window.DEMO_EXPORT.enabledMechanics || []) enabled[id] = true;
    for (const id of window.DEMO_EXPORT.disabledMechanics || []) enabled[id] = false;
    saveEnabled();
    saveQuest();
  }

  function byId(id) {
    return DB.mechanics.find((m) => m.id === id);
  }

  function taskCount() {
    return DB.rules.zones[els.zone.value].tasks;
  }

  function fitsDifficulty(m) {
    return m.difficulties.includes(els.difficulty.value);
  }

  function featureCountInQuest(featureKey) {
    return questSlots.filter((id) => {
      const m = byId(id);
      return m && m.featureKey === featureKey;
    }).length;
  }

  function canAddToQuest(m) {
    if (!enabled[m.id]) return { ok: false, reason: "Сначала включите в пул базы" };
    if (!fitsDifficulty(m)) return { ok: false, reason: "Не подходит к выбранной сложности" };
    if (questSlots.includes(m.id)) return { ok: false, reason: "Уже в квесте" };
    if (questSlots.length >= taskCount()) return { ok: false, reason: "Все слоты заняты" };
    if (m.uniqueFeature) {
      const used = featureCountInQuest(m.featureKey);
      const max = DB.rules.uniqueFeatureMaxPerQuest[m.featureKey] ?? 1;
      if (used >= max) return { ok: false, reason: "Фишка уже использована в этом квесте" };
    }
    return { ok: true };
  }

  function renderStats() {
    const on = DB.mechanics.filter((m) => enabled[m.id]);
    const fit = on.filter(fitsDifficulty);
    const uniqueOn = on.filter((m) => m.uniqueFeature).length;
    els.stats.innerHTML = `
      <span class="stat">В пуле: <b>${on.length}</b> / ${DB.mechanics.length}</span>
      <span class="stat">Под сложность: <b>${fit.length}</b></span>
      <span class="stat">Фишек в пуле: <b>${uniqueOn}</b></span>
      <span class="stat">Слотов квеста: <b>${questSlots.length}</b> / ${taskCount()}</span>
    `;
  }

  function renderSlots() {
    const n = taskCount();
    if (questSlots.length > n) questSlots = questSlots.slice(0, n);
    els.slots.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const id = questSlots[i];
      const m = id ? byId(id) : null;
      const div = document.createElement("div");
      div.className = "slot" + (m ? " filled" : "");
      if (m) {
        div.innerHTML = `
          <span class="n">#${i + 1}${m.uniqueFeature ? " · фишка" : ""}</span>
          <strong>${m.name}</strong>
          <button type="button" data-remove="${m.id}">убрать</button>
        `;
      } else {
        div.innerHTML = `<span class="n">#${i + 1}</span><span>пусто</span>`;
      }
      els.slots.appendChild(div);
    }
    els.slots.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        questSlots = questSlots.filter((id) => id !== btn.getAttribute("data-remove"));
        saveQuest();
        render();
      });
    });
  }

  function filteredMechanics() {
    const group = els.filterGroup.value;
    const q = els.search.value.trim().toLowerCase();
    return DB.mechanics.filter((m) => {
      if (group !== "all" && m.group !== group) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.short.toLowerCase().includes(q) ||
        String(m.num) === q
      );
    });
  }

  function renderList() {
    els.mechanics.innerHTML = "";
    for (const m of filteredMechanics()) {
      const on = !!enabled[m.id];
      const add = canAddToQuest(m);
      const card = document.createElement("article");
      card.className = "card" + (on ? "" : " off") + (m.uniqueFeature ? " unique" : "");
      card.innerHTML = `
        <button type="button" class="toggle ${on ? "on" : ""}" data-toggle="${m.id}" aria-label="Переключить"></button>
        <div>
          <h3>${m.num}. ${m.name}</h3>
          <p>${m.short}</p>
          <div class="meta">
            <span class="pill">${GROUP_LABEL[m.group] || m.group}</span>
            ${m.uniqueFeature ? '<span class="pill feature">уникальная фишка ≤1</span>' : ""}
            ${m.mvp ? '<span class="pill mvp">MVP</span>' : ""}
            <span class="pill">${m.difficulties.map((d) => DIFF_LABEL[d]).join(" · ")}</span>
            <span class="pill">контент: ${EFFORT_LABEL[m.effort]}</span>
            ${m.needsCamera ? '<span class="pill">камера</span>' : ""}
            ${m.needsOnSite ? '<span class="pill">на месте</span>' : ""}
          </div>
          <details>
            <summary>Данные для базы</summary>
            <div>Типы мест: ${(m.placeTypes || []).join(", ")}</div>
            <div>Ассеты: ${(m.needsAsset || []).join(", ")}</div>
            <div>id: <code>${m.id}</code></div>
          </details>
        </div>
        <div class="card-actions">
          <button type="button" class="btn ghost" data-add="${m.id}" ${add.ok ? "" : "disabled"} title="${add.reason || ""}">В квест</button>
        </div>
      `;
      els.mechanics.appendChild(card);
    }

    els.mechanics.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle");
        enabled[id] = !enabled[id];
        if (!enabled[id]) questSlots = questSlots.filter((x) => x !== id);
        saveEnabled();
        saveQuest();
        render();
      });
    });

    els.mechanics.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-add");
        const m = byId(id);
        const check = canAddToQuest(m);
        if (!check.ok) return;
        questSlots.push(id);
        saveQuest();
        render();
      });
    });
  }

  function render() {
    renderStats();
    renderSlots();
    renderList();
  }

  function exportJson() {
    const payload = buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kultprogulki-mechanics-${els.zone.value}-${els.difficulty.value}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function autoFill() {
    questSlots = [];
    const pool = DB.mechanics.filter((m) => enabled[m.id] && fitsDifficulty(m));
    const features = pool.filter((m) => m.uniqueFeature);
    const normal = pool.filter((m) => !m.uniqueFeature);
    const target = taskCount();

    // Prefer one feature if available, then fill with normal MVP-first
    for (const f of features) {
      if (questSlots.length >= Math.min(2, target)) break;
      const check = canAddToQuest(f);
      if (check.ok) questSlots.push(f.id);
    }

    const ordered = [
      ...normal.filter((m) => m.mvp),
      ...normal.filter((m) => !m.mvp),
    ];
    for (const m of ordered) {
      if (questSlots.length >= target) break;
      const check = canAddToQuest(m);
      if (check.ok) questSlots.push(m.id);
    }
    saveQuest();
    render();
  }

  document.getElementById("btn-mvp").addEventListener("click", () => {
    for (const m of DB.mechanics) enabled[m.id] = !!m.mvp || !!m.uniqueFeature;
    questSlots = questSlots.filter((id) => enabled[id]);
    saveEnabled();
    saveQuest();
    render();
  });

  document.getElementById("btn-all-on").addEventListener("click", () => {
    for (const m of DB.mechanics) enabled[m.id] = true;
    saveEnabled();
    render();
  });

  document.getElementById("btn-all-off").addEventListener("click", () => {
    for (const m of DB.mechanics) {
      if (!m.uniqueFeature) enabled[m.id] = false;
    }
    questSlots = questSlots.filter((id) => enabled[id]);
    saveEnabled();
    saveQuest();
    render();
  });

  function buildExportPayload() {
    return {
      exportedAt: new Date().toISOString(),
      rules: DB.rules,
      zone: els.zone.value,
      difficulty: els.difficulty.value,
      enabledMechanics: DB.mechanics.filter((m) => enabled[m.id]).map((m) => m.id),
      disabledMechanics: DB.mechanics.filter((m) => !enabled[m.id]).map((m) => m.id),
      questDraft: {
        taskCount: taskCount(),
        mechanics: questSlots.map((id, i) => {
          const m = byId(id);
          return { slot: i + 1, id, name: m?.name, uniqueFeature: !!m?.uniqueFeature };
        }),
      },
    };
  }

  function walkWithQuest() {
    if (!questSlots.length) {
      alert("Сначала соберите черновик квеста (или нажмите «Автозаполнить»).");
      return;
    }
    if (typeof KP === "undefined" || !window.QUEST_DB) {
      alert("Не загружена база заданий.");
      return;
    }
    const payload = buildExportPayload();
    const quest = KP.materializeFromExport(payload);
    KP.saveActiveQuest(quest);
    location.href = "walk.html";
  }

  document.getElementById("btn-export").addEventListener("click", exportJson);
  document.getElementById("btn-walk")?.addEventListener("click", walkWithQuest);
  document.getElementById("btn-walk-2")?.addEventListener("click", walkWithQuest);
  document.getElementById("btn-auto").addEventListener("click", autoFill);
  document.getElementById("btn-clear-quest").addEventListener("click", () => {
    questSlots = [];
    saveQuest();
    render();
  });

  ["zone", "difficulty", "filter-group"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      if (id === "zone" || id === "difficulty") {
        questSlots = questSlots.filter((sid) => {
          const m = byId(sid);
          return m && enabled[m.id] && m.difficulties.includes(els.difficulty.value);
        });
        if (questSlots.length > taskCount()) questSlots = questSlots.slice(0, taskCount());
        saveQuest();
      }
      render();
    });
  });

  els.search.addEventListener("input", render);

  render();
})();
