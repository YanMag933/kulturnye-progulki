(() => {
  const params = new URLSearchParams(location.search);
  const TEST_MODE = params.has("test");
  const STORY_ID = params.get("story");
  const TEST_PROGRESS_KEY = "kultprogulki.progress.test";
  const app = document.getElementById("app");

  if (STORY_ID && window.KP.materializeStoryRoute && window.STORY_ROUTES?.[STORY_ID]) {
    const storyQuest = KP.materializeStoryRoute(STORY_ID);
    KP.saveActiveQuest(storyQuest);
  }

  let quest = KP.loadActiveQuest() || KP.ensureDemoQuest();
  // story=… всегда пересобирает сюжет (новые тексты / контуры), не держит старый кэш
  if (STORY_ID && window.STORY_ROUTES?.[STORY_ID]) {
    quest = KP.materializeStoryRoute(STORY_ID);
    KP.saveActiveQuest(quest);
  }

  let progress = TEST_MODE
    ? JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || "null")
    : KP.loadProgress();
  if (!progress || progress.questId !== quest.id) {
    progress = { questId: quest.id, stepIndex: -1, answers: [], startedAt: Date.now(), mapReady: false };
    save();
  }
  let uiState = {};
  let mapInstance = null;

  const PHOTO_BANK_KEY = "kultprogulki.story.photos.pushkin";

  function loadPhotoBank() {
    try {
      return JSON.parse(localStorage.getItem(PHOTO_BANK_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function savePhotoBank(photos) {
    try {
      localStorage.setItem(PHOTO_BANK_KEY, JSON.stringify(photos || {}));
    } catch (_) {}
  }

  function hydrateStepPhotos() {
    progress.photos = progress.photos || {};
    const bank = loadPhotoBank();
    Object.keys(bank).forEach((k) => {
      if (!progress.photos[k] && bank[k]) progress.photos[k] = bank[k];
    });
    (quest.steps || []).forEach((s) => {
      const key = String(s.slot);
      if (s.userPhoto) progress.photos[key] = s.userPhoto;
      else if (progress.photos[key]) s.userPhoto = progress.photos[key];
    });
  }

  function getStepPhoto(step) {
    if (!step) return "";
    const key = String(step.slot);
    progress.photos = progress.photos || {};
    return progress.photos[key] || step.userPhoto || "";
  }

  function setStepPhoto(step, dataUrl) {
    if (!step) return;
    const key = String(step.slot);
    progress.photos = progress.photos || {};
    if (dataUrl) progress.photos[key] = dataUrl;
    else delete progress.photos[key];
    step.userPhoto = dataUrl || "";
    const qi = (quest.steps || []).findIndex((s) => s.slot === step.slot);
    if (qi >= 0) quest.steps[qi].userPhoto = dataUrl || "";
    KP.saveActiveQuest(quest);
    savePhotoBank(progress.photos);
    save();
  }

  function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.78));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Не удалось прочитать фото"));
      };
      img.src = url;
    });
  }

  hydrateStepPhotos();
  (quest.steps || []).forEach((s) => {
    const p = progress.photos && progress.photos[String(s.slot)];
    if (p) s.userPhoto = p;
  });
  if (STORY_ID === "pushkin") KP.saveActiveQuest(quest);

  function save() {
    if (TEST_MODE) localStorage.setItem(TEST_PROGRESS_KEY, JSON.stringify(progress));
    else KP.saveProgress(progress);
  }

  function startWalk() {
    progress.stepIndex = 0;
    progress.answers = [];
    progress.startedAt = Date.now();
    progress.mapReady = true;
    progress.letterScraps = [];
    progress.scrapDeal = null;
    uiState = {};
    ensureScrapDeal();
    if (mapInstance) {
      try {
        mapInstance.remove();
      } catch (_) {}
      mapInstance = null;
    }
    save();
    render();
  }

  function confirmRouteMap() {
    progress.mapReady = true;
    progress.stepIndex = 0;
    progress.answers = [];
    progress.startedAt = Date.now();
    progress.letterScraps = [];
    progress.scrapDeal = null;
    uiState = {};
    ensureScrapDeal();
    if (mapInstance) {
      try {
        mapInstance.remove();
      } catch (_) {}
      mapInstance = null;
    }
    save();
    render();
  }

  function buildRouteSvg() {
    return `<img class="route-map-fallback" src="assets/maps/pushkin-route.jpg" alt="Карта маршрута «Пушкин в Москве»" />`;
  }

  function walkerIcon(slot) {
    return L.divIcon({
      className: "map-walker-wrap",
      html: `<div class="map-walker" aria-hidden="true">
        <img class="map-walker-img" src="assets/maps/walker-3d.svg" alt="" draggable="false" />
        <span class="map-walker-num">${slot}</span>
      </div>`,
      iconSize: [26, 38],
      iconAnchor: [13, 36],
      tooltipAnchor: [0, -32],
    });
  }

  /** Развести маркеры с одинаковыми координатами (1/2/9 на площади и т.п.) */
  function markerPositions(stepsWithGeo) {
    const groups = new Map();
    stepsWithGeo.forEach((s, i) => {
      const key = `${Number(s.lat).toFixed(5)},${Number(s.lon).toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ s, i });
    });
    const pos = new Array(stepsWithGeo.length);
    groups.forEach((arr) => {
      if (arr.length === 1) {
        pos[arr[0].i] = [arr[0].s.lat, arr[0].s.lon];
        return;
      }
      const n = arr.length;
      arr.forEach((item, k) => {
        const angle = (Math.PI * 2 * k) / n - Math.PI / 2;
        const ring = 0.00032 + (n > 2 ? 0.00006 : 0);
        pos[item.i] = [
          item.s.lat + Math.cos(angle) * ring,
          item.s.lon + Math.sin(angle) * ring * 1.55,
        ];
      });
    });
    return pos;
  }

  function openRoutePoints(stepsWithGeo) {
    const linePts = stepsWithGeo.map((s) => [s.lat, s.lon]);
    if (linePts.length < 2) return linePts;
    const first = linePts[0];
    const last = linePts[linePts.length - 1];
    const sameEnds =
      Math.abs(first[0] - last[0]) < 0.00015 && Math.abs(first[1] - last[1]) < 0.00015;
    return sameEnds ? linePts.slice(0, -1) : linePts;
  }

  async function fetchRoadGeometry(latLngs) {
    if (!latLngs || latLngs.length < 2) return latLngs || [];
    const coords = latLngs.map(([lat, lon]) => `${lon},${lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("osrm");
      const data = await res.json();
      const geom = data?.routes?.[0]?.geometry?.coordinates;
      if (!geom || !geom.length) throw new Error("empty");
      return geom.map(([lon, lat]) => [lat, lon]);
    } catch (_) {
      return latLngs;
    }
  }

  function routeBearing(a, b) {
    const lat1 = (a[0] * Math.PI) / 180;
    const lat2 = (b[0] * Math.PI) / 180;
    const dLon = ((b[1] - a[1]) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  function addRouteArrows(map, latLngs) {
    if (!latLngs || latLngs.length < 2) return;
    const total = latLngs.length;
    const count = Math.min(14, Math.max(6, Math.floor(total / 18)));
    const step = Math.max(1, Math.floor(total / (count + 1)));
    for (let i = step; i < total - 1; i += step) {
      const a = latLngs[i];
      const b = latLngs[Math.min(i + Math.max(2, Math.floor(step / 3)), total - 1)];
      const deg = routeBearing(a, b);
      L.marker(a, {
        interactive: false,
        keyboard: false,
        zIndexOffset: 200,
        icon: L.divIcon({
          className: "route-arrow-wrap",
          html: `<div class="route-arrow" style="transform:rotate(${deg}deg)" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 11h10l-3.5-3.5 1.4-1.4L18.8 12l-6.9 5.9-1.4-1.4L14 13H4z" fill="#1e6bff"/></svg>
          </div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);
    }
  }

  async function mountLeafletMap() {
    const el = document.getElementById("route-map-el");
    if (!el || typeof L === "undefined") return false;
    const stepsWithGeo = quest.steps.filter((s) => s.lat && s.lon);
    if (!stepsWithGeo.length) return false;
    try {
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
      mapInstance = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        doubleClickZoom: false,
        boxZoom: false,
        scrollWheelZoom: false,
        tapHold: false,
      });
      mapInstance.doubleClickZoom.disable();
      el.style.touchAction = "manipulation";
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "",
      }).addTo(mapInstance);

      const openLine = openRoutePoints(stepsWithGeo);
      const roadLine = await fetchRoadGeometry(openLine);
      L.polyline(roadLine, {
        color: "#0b3d91",
        weight: 7,
        opacity: 0.22,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(mapInstance);
      const line = L.polyline(roadLine, {
        color: "#1e6bff",
        weight: 4,
        opacity: 0.98,
        dashArray: "8 12",
        lineCap: "round",
        lineJoin: "round",
        className: "route-dash",
      }).addTo(mapInstance);
      addRouteArrows(mapInstance, roadLine);

      const markerPos = markerPositions(stepsWithGeo);
      stepsWithGeo.forEach((s, i) => {
        L.marker(markerPos[i], {
          icon: walkerIcon(s.slot || i + 1),
          keyboard: false,
          riseOnHover: true,
        })
          .bindTooltip(`${s.slot || i + 1}. ${s.placeName}`, {
            direction: "top",
            sticky: true,
            opacity: 0.95,
            className: "map-walker-tip",
          })
          .addTo(mapInstance);
      });
      mapInstance.fitBounds(line.getBounds().pad(0.22));
      setTimeout(() => mapInstance && mapInstance.invalidateSize(), 80);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function renderRouteMap() {
    shell(
      `<div class="start-hero">
        <p class="eyebrow">Сюжет · карта</p>
        <h1>${quest.title}</h1>
        <p class="route-map-caption">${quest.subtitle || ""}</p>
        <div class="route-map" id="route-map-wrap">
          <div id="route-map-el"></div>
          <div id="route-map-svg-host" hidden>${buildRouteSvg()}</div>
        </div>
        <button type="button" class="btn primary" id="start-after-map">К заданиям</button>
        <a class="btn ghost" href="index.html" style="display:block;text-align:center;margin-top:8px">В меню</a>
      </div>`
    );
    const ok = await mountLeafletMap();
    if (!ok) {
      const host = document.getElementById("route-map-svg-host");
      const el = document.getElementById("route-map-el");
      if (host && el) {
        el.replaceWith(host.firstElementChild || host);
        host.remove();
      }
    }
    document.getElementById("start-after-map").onclick = confirmRouteMap;
  }

  function prevStep() {
    stopCamera();
    if (uiState.radar) {
      uiState.radar.close();
      uiState.radar = null;
    }
    if (progress.stepIndex > 0) {
      progress.stepIndex -= 1;
      uiState = {};
      save();
      render();
    } else if (progress.stepIndex === 0) {
      progress.stepIndex = -1;
      uiState = {};
      save();
      render();
    }
  }

  function nextStep() {
    stopCamera();
    if (uiState.radar) {
      uiState.radar.close();
      uiState.radar = null;
    }
    if (progress.stepIndex < quest.steps.length - 1) {
      progress.stepIndex += 1;
      uiState = {};
      save();
      render();
    } else {
      progress.stepIndex = quest.steps.length;
      save();
      render();
    }
  }

  function stepIsComplete() {
    if (progress.stepIndex < 0) return true;
    const step = currentStep();
    if (!step) return true;
    const ui = step.ui || "generic";
    if (ui === "geo") return !!uiState.unlocked;
    if (ui === "contour") return !!uiState.done || uiState.phase === "done";
    if (ui === "safe" || ui === "input" || ui === "letter_puzzle") return !!uiState.done;
    return !!uiState.done;
  }

  /** В тестовом режиме: заполняет правильный ответ / отмечает опции. */
  function autoSolveCurrent() {
    const step = currentStep();
    if (!step) return;
    const ui = step.ui || "generic";
    stopCamera();
    if (uiState.radar) {
      uiState.radar.close();
      uiState.radar = null;
    }

    if (ui === "contour") {
      uiState.guessed = true;
      uiState.done = true;
      uiState.phase = "done";
      collectScrap(step);
      setFeedback("Тест: верный ответ показан", "ok");
      renderContour(step);
      return;
    }
    if (ui === "geo") {
      uiState.unlocked = true;
      collectScrap(step);
      setFeedback("Тест: сейф открыт", "ok");
      renderStep();
      return;
    }
    if (ui === "letter_puzzle") {
      ensureScrapDeal();
      progress.letterScraps = (progress.scrapDeal || letterPieces().map((p) => p.id)).slice();
      save();
      uiState.placed = {};
      letterPieces().forEach((p) => {
        uiState.placed[p.id] = true;
      });
      uiState.done = true;
      setFeedback("Тест: письмо собрано", "ok");
      renderLetterPuzzle(step);
      return;
    }
    if (ui === "detail" || ui === "quiz" || ui === "finale" || ui === "input" || ui === "safe") {
      uiState.done = true;
      collectScrap(step);
      const ans = String(step.safeCode || step.expected || "");
      renderStep();
      requestAnimationFrame(() => {
        const input = document.getElementById("answer");
        if (input && ans) input.value = ans.replace(/-/g, "");
        const fact = document.getElementById("fact");
        if (fact) fact.innerHTML = scrapRevealHtml(step);
        const opts = app.querySelectorAll(".opt");
        if (opts.length && step.correctIndex != null) {
          opts.forEach((b, i) => {
            b.classList.toggle("correct", i === step.correctIndex);
            b.classList.remove("wrong");
          });
        }
        setFeedback("Тест: ответ подставлен" + (ans ? " — " + ans : ""), "ok");
      });
      return;
    }
    if (ui === "puzzle") {
      const tiles = step.puzzleTiles || [];
      uiState.order = tiles.map((_, i) => i);
      uiState.done = true;
      setFeedback("Тест: панно собрано", "ok");
      renderPuzzle(step);
      return;
    }
    if (ui === "circle") {
      uiState.doneCp = (step.checkpoints || []).map((_, i) => i);
      uiState.done = true;
      setFeedback("Тест: обход отмечен", "ok");
      renderCircle(step);
      return;
    }
    if (ui === "mosaic") {
      uiState.sel = {};
      (step.pairs || []).forEach((p, i) => {
        uiState.sel[i] = p.target;
      });
      uiState.done = true;
      setFeedback("Тест: пары заполнены", "ok");
      renderMosaic(step);
      return;
    }
    if (ui === "plaque" || ui === "year" || ui === "count") {
      uiState.done = true;
      const safe = ui !== "count" ? resolveStepSafe(step) : null;
      if (safe) {
        renderStep();
        setFeedback("Тест: сейф засчитан — " + (safe.safeCode || step.expected || ""), "ok");
        return;
      }
      const ans =
        ui === "count" ? String(step.correctNumber) : String(step.expected || "");
      renderStep();
      requestAnimationFrame(() => {
        const input = document.getElementById("answer");
        if (input) input.value = ans;
        const fact = document.getElementById("fact");
        if (fact) fact.innerHTML = `<div class="fact-box">${step.fact || ""}</div>`;
        setFeedback("Тест: ответ подставлен — " + ans, "ok");
      });
      return;
    }
    if (ui === "myth") {
      uiState.marks = (step.statements || []).map((s) => s.truth);
      uiState.done = true;
      renderStep();
      requestAnimationFrame(() => {
        app.querySelectorAll("[data-v]").forEach((btn) => {
          const i = Number(btn.dataset.i);
          const want = btn.dataset.v === "true";
          if (uiState.marks[i] === want) btn.style.borderColor = "var(--accent)";
        });
        const fact = document.getElementById("fact");
        if (fact) fact.innerHTML = `<div class="fact-box">${step.fact || ""}</div>`;
        setFeedback("Тест: миф/факт отмечены", "ok");
      });
      return;
    }
    uiState.done = true;
    setFeedback("Тест: засчитано", "ok");
    renderStep();
  }

  function currentStep() {
    return quest.steps[progress.stepIndex];
  }

  function shell(inner, footerHtml) {
    const dots =
      progress.stepIndex < 0
        ? ""
        : `<div class="progress-row">${quest.steps
            .map((_, idx) => {
              let cls = "progress-dot";
              if (idx < progress.stepIndex) cls += " done";
              if (idx === progress.stepIndex) cls += " current";
              return `<div class="${cls}"></div>`;
            })
            .join("")}</div>`;

    app.innerHTML = `
      <div class="phone-notch"></div>
      <div class="walk-top">
        <div class="walk-nav">
          <a href="index.html">← Меню</a>
          <a href="create.html">Создать</a>
        </div>
        ${TEST_MODE ? `<p class="test-banner">ТЕСТ · Пушкин · «Далее» подставляет ответ · можно вставлять фото</p>` : ""}
        <h1 class="walk-title">${quest.title}${TEST_MODE ? " · тест" : ""}</h1>
        <p class="walk-meta">${[quest.zoneLabel, quest.difficultyLabel, quest.durationHint].filter(Boolean).join(" · ")}</p>
        ${dots}
      </div>
      ${inner}
      ${footerHtml || ""}
    `;
  }

  function footer(canNext, feedback) {
    const nextEnabled = TEST_MODE || canNext;
    const backBtn = TEST_MODE
      ? `<button type="button" class="btn ghost" id="prev">Назад</button>`
      : "";
    return `<div class="walk-footer">
      <div class="feedback ${feedback?.cls || ""}" id="feedback">${feedback?.text || ""}</div>
      <div class="walk-footer-row">
        ${backBtn}
        <button type="button" class="btn primary" id="next" ${nextEnabled ? "" : "disabled"}>
          ${progress.stepIndex >= quest.steps.length - 1 ? "Завершить" : "Далее"}
        </button>
      </div>
    </div>`;
  }

  function bindNext(enabled) {
    const btn = document.getElementById("next");
    const prev = document.getElementById("prev");
    if (prev) prev.onclick = () => prevStep();
    if (!btn) return;
    if (TEST_MODE) {
      btn.disabled = false;
      btn.onclick = () => {
        if (!stepIsComplete()) {
          autoSolveCurrent();
          return;
        }
        nextStep();
      };
      return;
    }
    btn.disabled = !enabled;
    btn.onclick = () => nextStep();
  }

  function setFeedback(text, cls) {
    const el = document.getElementById("feedback");
    if (!el) return;
    el.textContent = text;
    el.className = "feedback " + (cls || "");
  }

  function checkText(expected, alternatives = []) {
    const norm = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, "")
        .replace(/-/g, "");
    const input = document.getElementById("answer");
    const val = norm(input?.value);
    const okList = [expected, ...alternatives].map(norm);
    return okList.includes(val);
  }

  /** Год/табличка/шифр → сейф; подтягивает safe* из QUEST_DB, если в кэше квеста их нет. */
  function resolveStepSafe(step) {
    const dbTask =
      step.id && window.QUEST_DB?.tasks
        ? window.QUEST_DB.tasks.find((t) => t.id === step.id)
        : null;
    const safeType = step.safeType || dbTask?.safeType || "";
    const safeCode = String(
      step.safeCode || dbTask?.safeCode || step.expected || dbTask?.expected || ""
    ).trim();
    const safePrompt =
      step.safePrompt || dbTask?.safePrompt || step.prompt || dbTask?.prompt || "";
    if (safeType) {
      return { safeType, safeCode, safePrompt };
    }
    if (step.ui === "year") {
      const digits = safeCode.replace(/\D/g, "").slice(0, 4);
      if (digits) return { safeType: "year", safeCode: digits, safePrompt: safePrompt || "Год" };
    }
    if (step.ui === "plaque") {
      const digits = safeCode.replace(/\D/g, "");
      if (digits.length >= 3 && digits.length <= 4) {
        return {
          safeType: "year",
          safeCode: digits.slice(0, 4),
          safePrompt: safePrompt || "Год с таблички",
        };
      }
    }
    return null;
  }

  function isLetterEra() {
    return !!(quest && (quest.letterEra || quest.characterId === "pushkin" || quest.storyId === "pushkin"));
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function letterLines(text) {
    return escapeHtml(text).replace(/\n/g, "<br />");
  }

  function letterSheetHtml({ title, body, variant = "task" } = {}) {
    const tit = title ? `<h2 class="letter-title">${escapeHtml(title)}</h2>` : "";
    const bod = body ? `<p class="letter-body">${letterLines(body)}</p>` : "";
    return `<article class="letter-sheet letter-${variant}" aria-label="Письмо">
      <div class="letter-sheet-inner">${tit}${bod}</div>
    </article>`;
  }

  function letterPieces() {
    return (window.KP_LETTER_PIECES || []).slice().sort((a, b) => a.order - b.order);
  }

  function letterEdgeProfiles() {
    // flat = прямая грань листа; v*/h* = заметно разные рваные стыки
    return {
      flat: [
        [0, 0],
        [100, 0],
      ],
      // широкий редкий рваный шов
      v0: [
        [0, 0],
        [10, 0],
        [14, 14],
        [22, -10],
        [30, 12],
        [38, -8],
        [48, 0],
        [55, 11],
        [64, -12],
        [74, 9],
        [84, -7],
        [92, 0],
        [100, 0],
      ],
      // частые мелкие зубцы
      v1: [
        [0, 0],
        [6, 7],
        [12, -6],
        [18, 8],
        [24, -7],
        [30, 6],
        [36, -8],
        [42, 7],
        [48, -6],
        [54, 8],
        [60, -7],
        [66, 6],
        [72, -8],
        [78, 7],
        [84, -5],
        [90, 6],
        [96, -4],
        [100, 0],
      ],
      // глубокая «ступенька» по центру
      v2: [
        [0, 0],
        [18, 0],
        [22, 16],
        [35, 16],
        [40, -12],
        [55, -12],
        [60, 10],
        [78, 10],
        [82, 0],
        [100, 0],
      ],
      // волна с одним большим вырезом
      v3: [
        [0, 0],
        [12, 5],
        [25, -4],
        [40, 6],
        [48, -14],
        [58, 14],
        [70, -5],
        [82, 6],
        [92, -3],
        [100, 0],
      ],
      // горизонталь: крупные пилы
      h0: [
        [0, 0],
        [8, 0],
        [12, 13],
        [20, -11],
        [32, 10],
        [44, -9],
        [56, 12],
        [68, -10],
        [80, 9],
        [90, -6],
        [100, 0],
      ],
      // горизонталь: мелкая греёнка
      h1: [
        [0, 0],
        [5, 6],
        [10, -5],
        [15, 7],
        [20, -6],
        [25, 5],
        [30, -7],
        [35, 6],
        [40, -5],
        [45, 7],
        [50, -6],
        [55, 5],
        [60, -7],
        [65, 6],
        [70, -5],
        [75, 7],
        [80, -4],
        [85, 5],
        [90, -6],
        [95, 4],
        [100, 0],
      ],
      // горизонталь: два глубоких кармана
      h2: [
        [0, 0],
        [15, 0],
        [20, 15],
        [32, 15],
        [38, -10],
        [50, -10],
        [55, 14],
        [68, 14],
        [74, 0],
        [100, 0],
      ],
      h3: [
        [0, 0],
        [10, -8],
        [22, 9],
        [35, -11],
        [48, 10],
        [60, -9],
        [72, 11],
        [85, -7],
        [100, 0],
      ],
      h4: [
        [0, 0],
        [20, 4],
        [28, -13],
        [42, 12],
        [55, -8],
        [70, 10],
        [85, -5],
        [100, 0],
      ],
      h5: [
        [0, 0],
        [12, 9],
        [25, -6],
        [40, 0],
        [48, 14],
        [62, -12],
        [75, 7],
        [88, -5],
        [100, 0],
      ],
    };
  }

  function edgePath(name, amp) {
    const profiles = letterEdgeProfiles();
    const pts = profiles[name] || profiles.flat;
    const a = amp == null ? 1 : amp;
    return pts.map(([x, y]) => [x, y * a]);
  }

  function edgeIsFlat(name) {
    return !name || name === "flat";
  }

  /** Прямые внешние грани листа; рваные только стыки между кусками. */
  function scrapClipPath(piece) {
    const e = piece.edges || {};
    const inset = 1.2;
    const tearAmp = 1.55;
    const topName = e.t || "flat";
    const rightName = e.r || "flat";
    const botName = e.b || "flat";
    const leftName = e.l || "flat";
    const top = edgePath(topName, edgeIsFlat(topName) ? 0 : tearAmp).map(([x, y]) => [
      x,
      Math.max(0.2, inset + y),
    ]);
    const right = edgePath(rightName, edgeIsFlat(rightName) ? 0 : tearAmp).map(([x, y]) => [
      Math.min(99.8, 100 - inset - y),
      x,
    ]);
    const bot = edgePath(botName, edgeIsFlat(botName) ? 0 : tearAmp).map(([x, y]) => [
      x,
      Math.min(99.8, 100 - inset - y),
    ]);
    const left = edgePath(leftName, edgeIsFlat(leftName) ? 0 : tearAmp).map(([x, y]) => [
      Math.max(0.2, inset + y),
      x,
    ]);
    const poly = [];
    top.forEach(([x, y]) => poly.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`));
    right.forEach(([x, y]) => poly.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`));
    bot
      .slice()
      .reverse()
      .forEach(([x, y]) => poly.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`));
    left
      .slice()
      .reverse()
      .forEach(([x, y]) => poly.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`));
    return `polygon(${poly.join(", ")})`;
  }

  function prevEdgeForOrder() {
    return "flat";
  }

  function scrapPieceHtml(piece, opts = {}) {
    if (!piece) return "";
    const clip = scrapClipPath(piece);
    const rot = opts.rotate != null ? opts.rotate : ((piece.order * 7) % 11) - 5;
    const blur = opts.blurText ? " is-blurred" : "";
    const placed = opts.placed ? " is-placed" : "";
    const tray = opts.tray ? " is-tray" : "";
    const align = piece.x >= 50 ? " is-right" : " is-left";
    return `<div class="scrap-piece scrap-rect scrap-${piece.id}${blur}${placed}${tray}${align}" data-piece="${piece.id}" data-order="${piece.order}" style="clip-path:${clip};-webkit-clip-path:${clip};--scrap-rot:${rot}deg">
      <div class="scrap-piece-face">
        <p class="scrap-piece-text">${letterLines(piece.text)}</p>
      </div>
    </div>`;
  }

  function factLetterHtml(text) {
    if (!text) return "";
    if (!isLetterEra()) return `<div class="fact-box">${escapeHtml(text)}</div>`;
    return letterSheetHtml({
      body: text,
      variant: "reveal",
    });
  }

  function scrapRevealHtml(step) {
    const piece = dealtPieceForStep(step);
    if (piece) {
      return `<div class="scrap-reveal">${scrapPieceHtml(piece, { rotate: ((piece.order * 9) % 13) - 6, tray: true })}</div>`;
    }
    return factLetterHtml(scrapText(step));
  }

  function questLetterScraps() {
    return letterPieces();
  }

  function shuffleIds(ids) {
    const arr = ids.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    if (arr.length > 1 && arr.every((v, i) => v === ids[i])) {
      const last = arr.pop();
      arr.unshift(last);
    }
    return arr;
  }

  function ensureScrapDeal() {
    const pieces = letterPieces();
    const n = pieces.length;
    if (progress.scrapDeal && progress.scrapDeal.length === n) return progress.scrapDeal;
    progress.scrapDeal = shuffleIds(pieces.map((p) => p.id));
    save();
    return progress.scrapDeal;
  }

  function awardSteps() {
    return (quest.steps || []).filter((s) => s.awardsScrap);
  }

  function pieceById(id) {
    return letterPieces().find((p) => p.id === id) || null;
  }

  function dealtPieceForStep(step) {
    if (!step || !step.awardsScrap) return null;
    const deal = ensureScrapDeal();
    const steps = awardSteps();
    const idx = steps.findIndex((s) => s.slot === step.slot);
    if (idx < 0) return null;
    return pieceById(deal[idx]);
  }

  function scrapText(step) {
    const piece = dealtPieceForStep(step);
    if (piece) return piece.text;
    return (step && step.letterScrap && step.letterScrap.text) || step.fact || "";
  }

  function collectScrap(step) {
    const piece = dealtPieceForStep(step);
    if (!piece) return;
    progress.letterScraps = progress.letterScraps || [];
    if (!progress.letterScraps.includes(piece.id)) {
      progress.letterScraps.push(piece.id);
      save();
    }
  }

  function ownedPieces() {
    const owned = new Set(progress.letterScraps || []);
    const pieces = letterPieces();
    if (!owned.size && TEST_MODE) return pieces;
    return pieces.filter((p) => owned.has(p.id));
  }

  function panelInputHint(step) {
    if (step.safePrompt) return step.safePrompt;
    if (step.ui === "contour") return isLetterEra() ? "Совмести контур с бронзой" : "Совместите контур в камере";
    if (step.ui === "geo") return isLetterEra() ? "Открой сейф у точки" : "Откройте сейф у точки";
    if (step.expected) return isLetterEra() ? "Впиши ответ" : "Введите ответ на табло";
    return isLetterEra() ? "Впиши ответ" : "Введите ответ на табло";
  }

  function photoSlotHtml(step, opts = {}) {
    if (opts.hide) return "";
    const userPhoto = getStepPhoto(step);
    const showClue = !!(step.clueImage && !userPhoto && !step.hideClueOnTask);
    if (!TEST_MODE && !userPhoto && !showClue && step.hideClueOnTask) return "";
    if (!TEST_MODE && !userPhoto && !showClue && !opts.forceEmpty && step.ui === "letter_puzzle") return "";

    const src = userPhoto || (showClue ? step.clueImage : "");
    const hasImg = !!src;
    const canEdit = TEST_MODE;
    const label = userPhoto ? "ваше фото" : showClue ? "циферблат" : "фото точки";
    const btnLabel = userPhoto ? "Заменить фото" : "Добавить фото";

    return `<div class="photo-slot${hasImg ? " has-clue" : ""}${canEdit ? " photo-slot-editable" : ""}" aria-label="Кадр задания">
      ${hasImg ? `<img class="photo-slot-clue" src="${src}" alt="" draggable="false" />` : `<span class="photo-slot-empty">${canEdit ? "Нет фото" : ""}</span>`}
      ${!isLetterEra() || canEdit ? `<span class="photo-slot-label">${label}</span>` : ""}
      ${
        canEdit
          ? `<div class="photo-slot-actions">
              <input type="file" id="photo-file" accept="image/*" capture="environment" hidden />
              <button type="button" class="btn photo-pick-btn" id="photo-pick">${btnLabel}</button>
            </div>`
          : ""
      }
    </div>`;
  }

  function bindPhotoSlot(step) {
    if (!TEST_MODE) return;
    const pick = document.getElementById("photo-pick");
    const file = document.getElementById("photo-file");
    if (!pick || !file) return;
    pick.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try {
        setFeedback("Сжимаю фото…", "ok");
        const dataUrl = await compressImageFile(f);
        setStepPhoto(step, dataUrl);
        setFeedback("Фото сохранено в прогулку", "ok");
        renderStep();
      } catch (err) {
        setFeedback(err.message || "Ошибка фото", "bad");
      }
    };
  }

  function hintPillHtml() {
    const label = isLetterEra() ? "Намёк" : "Подсказка";
    return `<button type="button" class="hint-pill" id="hint-pill" aria-expanded="false">${label}</button>
      <div class="hint-panel${isLetterEra() ? " letter-hint-panel" : ""}" id="hint-panel" hidden></div>`;
  }

  function bindHintPill(step) {
    const pill = document.getElementById("hint-pill");
    const panel = document.getElementById("hint-panel");
    if (!pill || !panel) return;
    const levels = [step.hintL1, step.hintL2, step.hintL3].filter(Boolean);
    let level = 0;
    pill.onclick = () => {
      const text = levels.length ? levels[level] : step.hint || "Смотрите на место.";
      panel.hidden = false;
      if (isLetterEra()) {
        panel.innerHTML = letterSheetHtml({
          body: text,
          variant: "hint",
        });
      } else {
        panel.innerHTML = `<p>${escapeHtml(text)}</p>`;
      }
      pill.setAttribute("aria-expanded", "true");
      if (levels.length) level = Math.min(level + 1, levels.length - 1);
    };
  }

  function inputSimHtml(step) {
    const expected = String(step.expected || step.safeCode || "");
    const wantsDigits =
      step.safeType === "year" ||
      step.safeType === "code" ||
      step.safeType === "dial" ||
      /^\d[\d-]*$/.test(expected);
    const wantsWord = step.ui === "input" || (!wantsDigits && /[а-яёa-z]/i.test(expected));
    const inputMode = wantsWord ? "text" : "numeric";
    const placeholder = wantsWord
      ? step.safePrompt || "слово"
      : step.safeType === "year"
        ? "год"
        : step.safePrompt || "код";
    return `<div class="input-sim panel">
      <input class="field input-sim-field" id="answer" type="text" inputmode="${inputMode}" lang="ru" autocomplete="off" enterkeyhint="done" placeholder="${placeholder}" />
      <button type="button" class="btn primary" id="check">${isLetterEra() ? "Сверить" : "Проверить"}</button>
      <div id="fact"></div>
    </div>`;
  }

  function bindInputSim(step) {
    document.getElementById("check").onclick = () => {
      const expected = step.safeCode || step.expected || "";
      const alts = step.alternatives || [];
      const ok = checkText(expected, alts) || (expected && checkText(String(expected).replace(/-/g, ""), alts));
      if (ok) {
        uiState.done = true;
        collectScrap(step);
        setFeedback(isLetterEra() ? "Обрывок получен" : "Засчитано", "ok");
        const fact = document.getElementById("fact");
        if (fact) fact.innerHTML = scrapRevealHtml(step);
        bindNext(true);
      } else setFeedback(isLetterEra() ? "Мимо — открой намёк" : "Мимо — откройте подсказку", "bad");
    };
    bindNext(!!uiState.done);
  }

  function renderSafeInput(step) {
    taskChrome(
      step,
      `${photoSlotHtml(step)}
       ${hintPillHtml()}
       ${
         uiState.done
           ? scrapRevealHtml(step)
           : inputSimHtml(step)
       }`,
      footer(!!uiState.done)
    );
    bindHintPill(step);
    bindPhotoSlot(step);
    if (!uiState.done) bindInputSim(step);
    else bindNext(true);
  }

  function taskChrome(step, bodyHtml, footerHtml, opts = {}) {
    const hidePlace = opts.hidePlace || (step.hidePlaceUntilGuess && !uiState.guessed);
    const brief = step.brief || step.hint || "";
    const eraClass = isLetterEra() ? " walk-letter-era" : "";
    const taskCard = isLetterEra()
      ? letterSheetHtml({
          title: step.title,
          body: brief,
          variant: "task",
        })
      : `<div class="panel panel-compact">
          <h2>${escapeHtml(step.title)}</h2>
          ${brief ? `<p>${letterLines(brief)}</p>` : ""}
        </div>`;
    shell(
      `<div class="walk-screen${eraClass}">
        <div class="chip-row">
          <span class="chip">${step.slot} / ${quest.steps.length}</span>
        </div>
        <h2 class="place">${hidePlace ? "???" : escapeHtml(step.placeName)}</h2>
        ${taskCard}
        ${bodyHtml}
      </div>`,
      footerHtml
    );
  }

  function stopCamera() {
    if (uiState.stream) {
      uiState.stream.getTracks().forEach((t) => t.stop());
      uiState.stream = null;
    }
  }

  function scoreCaptureVsSilhouette(video, key, minScore) {
    if (window.KP_MATCH && window.KP_MATCH.scoreCapture) {
      return window.KP_MATCH.scoreCapture(video, key, { minScore: minScore || 0.86 });
    }
    return { ok: false, score: 0, reason: "no-matcher" };
  }

  function renderContour(step) {
    const key = step.silhouetteKey || "pushkin";
    const silGuess = (window.KP_SILHOUETTE_HTML && window.KP_SILHOUETTE_HTML(key, "guess")) || "";
    const silAr = (window.KP_SILHOUETTE_HTML && window.KP_SILHOUETTE_HTML(key, "ar")) || "";
    const phase = uiState.phase || (step.skipGuess ? "ready" : "guess");

    if (phase === "guess") {
      taskChrome(
        step,
        `<div class="panel">
          <div class="silhouette-stage">${silGuess}</div>
          <p class="muted">${step.guessPrompt || "Кто это по внешнему контуру?"}</p>
          <div class="options">
            ${(step.guessOptions || []).map((o, i) => `<button type="button" class="opt" data-i="${i}">${o}</button>`).join("")}
          </div>
        </div>`,
        footer(false),
        { hidePlace: true }
      );
      app.querySelectorAll(".opt").forEach((btn) => {
        btn.onclick = () => {
          const ok = Number(btn.dataset.i) === step.guessCorrectIndex;
          btn.classList.add(ok ? "correct" : "wrong");
          if (ok) {
            uiState.guessed = true;
            uiState.phase = "ready";
            setFeedback("Верно. Теперь совместите контур в камере.", "ok");
            setTimeout(() => renderContour(step), 350);
          } else setFeedback("Не тот памятник — смотрите только внешний силуэт", "bad");
        };
      });
      bindNext(false);
      return;
    }

    if (phase === "ready") {
      taskChrome(
        step,
        `${TEST_MODE ? photoSlotHtml(step) : ""}
        <div class="panel contour-panel">
          <div class="silhouette-stage silhouette-stage-lg">${silGuess || `<img class="sticker-outline guess" src="assets/contours/pushkin-sticker-preview.png" alt="Контур Пушкина" />`}</div>
          <p class="muted">${step.contourHint || "Откройте камеру и совместите контур с памятником."}</p>
          ${hintPillHtml()}
          <button type="button" class="btn primary" id="open-cam">Открыть камеру</button>
          <button type="button" class="btn ghost" id="fallback">Без камеры — вопрос</button>
          <div id="extra"></div>
        </div>`,
        footer(!!uiState.done)
      );
      bindHintPill(step);
      bindPhotoSlot(step);
      document.getElementById("open-cam").onclick = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          uiState.stream = stream;
          uiState.phase = "camera";
          renderContour(step);
        } catch (err) {
          setFeedback("Камера недоступна: " + (err.message || "разрешите доступ"), "bad");
        }
      };
      document.getElementById("fallback").onclick = () => {
        document.getElementById("extra").innerHTML = `
          <p>${step.fallbackQuestion || "Опишите позу памятника"}</p>
          <input class="field" id="answer" placeholder="ответ" />
          <button type="button" class="btn primary" id="check">Проверить</button>`;
        document.getElementById("check").onclick = () => {
          if (checkText(step.fallbackAnswer, ["да", "yes"])) {
            uiState.done = true;
            uiState.phase = "done";
            setFeedback("Принято", "ok");
            document.getElementById("extra").innerHTML += scrapRevealHtml(step);
            collectScrap(step);
            bindNext(true);
          } else setFeedback("Попробуйте ещё", "bad");
        };
      };
      bindNext(!!uiState.done);
      return;
    }

    if (phase === "camera") {
      taskChrome(
        step,
        `<div class="panel">
          <div class="ar-stage">
            <video id="ar-video" playsinline autoplay muted></video>
            <div class="ar-overlay">${silAr}</div>
            <div class="stage-label">совместите контур</div>
          </div>
          <p class="muted">Совместите красный контур с памятником. Сверка строгая: погрешность не больше 10–15%.</p>
          <button type="button" class="btn primary" id="capture">Сфотографировать и сверить</button>
          <button type="button" class="btn ghost" id="close-cam">Закрыть камеру</button>
          <div id="extra"></div>
        </div>`,
        footer(!!uiState.done)
      );
      const video = document.getElementById("ar-video");
      if (video && uiState.stream) {
        video.srcObject = uiState.stream;
        video.play().catch(() => {});
      }
      document.getElementById("close-cam").onclick = () => {
        stopCamera();
        uiState.phase = "ready";
        renderContour(step);
      };
      document.getElementById("capture").onclick = () => {
        const result = scoreCaptureVsSilhouette(video, key, step.matchMinScore || 0.86);
        const pct = Math.round((result.score || 0) * 100);
        const errPct = Math.round((1 - (result.score || 0)) * 100);
        if (result.ok) {
          stopCamera();
          uiState.done = true;
          uiState.phase = "done";
          setFeedback(`Совпало (${pct}%, погрешность ~${errPct}%). Засчитано.`, "ok");
          document.getElementById("extra").innerHTML = scrapRevealHtml(step) || factLetterHtml(step.fact);
          collectScrap(step);
          bindNext(true);
        } else {
          setFeedback(
            `Не совпало (~${pct}%, ошибка ~${errPct}%). Нужно ≤15%. Совместите контур точнее с памятником — стол/стена не засчитываются.`,
            "bad"
          );
        }
      };
      bindNext(!!uiState.done);
      return;
    }

    // done
    taskChrome(
      step,
      `<div class="panel">
        <div class="silhouette-stage aligned">${silGuess}</div>
        ${scrapRevealHtml(step) || factLetterHtml(step.fact)}
      </div>`,
      footer(true)
    );
    bindNext(true);
  }

  function renderStart() {
    if (quest.isStory && !progress.mapReady) {
      renderRouteMap();
      return;
    }
    const storyMode = !!quest.isStory;
    shell(
      `<div class="start-hero">
        <p class="eyebrow">${TEST_MODE ? "Режим проверки" : storyMode ? "Сюжет" : "Режим игрока"}</p>
        <h1>${quest.title}</h1>
        <p class="muted">${
          TEST_MODE
            ? "Все главы сюжета. «Далее» само подставляет ответ — можно листать без камеры, GPS и ввода."
            : quest.subtitle
        }</p>
        <div class="map-fake">${storyMode ? "Маршрут готов · " : "Кластер точек · "}${quest.zoneLabel}</div>
        <div class="steps-mini">
          ${quest.steps
            .map(
              (s) =>
                `<div><b>${s.slot}.</b> ${s.chapterTitle || s.mechanicName}${s.uniqueFeature ? " · фишка" : ""}<br/><span class="muted">${s.placeName}</span></div>`
            )
            .join("")}
        </div>
        <button type="button" class="btn primary" id="start">${TEST_MODE ? "Смотреть задания" : "Начать прогулку"}</button>
        ${
          storyMode
            ? `<button type="button" class="btn ghost" id="show-map">Снова карта маршрута</button>
               <a class="btn ghost" href="index.html" style="display:block;text-align:center;margin-top:8px">В меню</a>`
            : `<button type="button" class="btn ghost" id="rebuild">Новая сборка из базы (без повторов)</button>
               <button type="button" class="btn ghost" id="import">Импорт JSON</button>
               <input type="file" id="file" accept="application/json,.json" hidden />`
        }
      </div>`
    );
    document.getElementById("start").onclick = startWalk;
    const showMapBtn = document.getElementById("show-map");
    if (showMapBtn) {
      showMapBtn.onclick = () => {
        progress.mapReady = false;
        save();
        render();
      };
    }
    const rebuild = document.getElementById("rebuild");
    if (rebuild) {
      rebuild.onclick = () => {
        const mechanics = quest.steps.map((s) => ({ id: s.mechanicId, name: s.mechanicName }));
        quest = KP.buildQuestFromMechanics(mechanics, {
          zone: quest.zone,
          difficulty: quest.difficulty,
        });
        KP.saveActiveQuest(quest);
        progress = KP.loadProgress();
        uiState = {};
        render();
      };
    }
    const importBtn = document.getElementById("import");
    if (importBtn) {
      importBtn.onclick = () => document.getElementById("file").click();
      document.getElementById("file").onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          quest = KP.materializeFromExport(data);
          KP.saveActiveQuest(quest);
          progress = KP.loadProgress();
          uiState = {};
          render();
        } catch (err) {
          alert("Не удалось прочитать JSON: " + err.message);
        }
      };
    }
  }

  function renderDone() {
    shell(
      `<div class="start-hero">
        <p class="eyebrow">Финиш</p>
        <h1>Прогулка пройдена</h1>
        <p class="muted">${quest.steps.length} заданий · ${quest.zoneLabel}</p>
        <div class="panel fact-box">${quest.steps.at(-1)?.fact || ""}</div>
        <button type="button" class="btn primary" id="again">Ещё раз</button>
        <button type="button" class="btn ghost" id="menu">Меню</button>
      </div>`
    );
    document.getElementById("again").onclick = startWalk;
    document.getElementById("menu").onclick = () => (location.href = "index.html");
  }

  function renderLetterPuzzle(step) {
    const pieces = letterPieces();
    let owned = ownedPieces();
    if (!owned.length) {
      ensureScrapDeal();
      progress.letterScraps = (progress.scrapDeal || []).slice();
      save();
      owned = ownedPieces();
    }
    if (!uiState.placed) uiState.placed = {};
    if (uiState.done) {
      pieces.forEach((p) => {
        uiState.placed[p.id] = true;
      });
    }

    const allPlaced = pieces.every((p) => uiState.placed[p.id]);
    if (allPlaced && !uiState.done) uiState.done = true;

    const trayPieces = owned.filter((p) => !uiState.placed[p.id]);
    let trayOrder =
      uiState.trayOrder && uiState.trayOrder.length
        ? uiState.trayOrder.filter((id) => trayPieces.some((p) => p.id === id))
        : shuffleIds(trayPieces.map((p) => p.id));
    trayPieces.forEach((p) => {
      if (!trayOrder.includes(p.id)) trayOrder.push(p.id);
    });
    uiState.trayOrder = trayOrder;

    const slotsHtml = pieces
      .map((p) => {
        const filled = uiState.placed[p.id];
        const clip = scrapClipPath(p);
        const align = p.x >= 50 ? " is-right" : " is-left";
        return `<div class="a4-slot${filled ? " is-filled" : ""}${align}" data-order="${p.order}" data-piece="${p.id}" style="left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%;clip-path:${clip};-webkit-clip-path:${clip}">
          ${
            filled
              ? `<div class="a4-slot-face"><p class="scrap-piece-text">${letterLines(p.text)}</p></div>`
              : `<div class="a4-slot-ghost" aria-hidden="true"></div>`
          }
        </div>`;
      })
      .join("");

    const trayHtml = trayOrder
      .map((id) => {
        const p = pieceById(id);
        if (!p || uiState.placed[p.id]) return "";
        const clip = scrapClipPath(p);
        const rot = ((p.order * 13) % 17) - 8;
        const align = p.x >= 50 ? " is-right" : " is-left";
        return `<div class="a4-tray-item" data-piece="${p.id}">
          <div class="scrap-piece scrap-rect is-tray${align}" data-piece="${p.id}" data-order="${p.order}" style="clip-path:${clip};-webkit-clip-path:${clip};--scrap-rot:${rot}deg">
            <div class="scrap-piece-face">
              <p class="scrap-piece-text">${letterLines(p.text)}</p>
            </div>
          </div>
        </div>`;
      })
      .join("");

    const sheetInner = uiState.done
      ? `<div class="a4-full-letter"><p class="letter-body">${letterLines(window.KP_LETTER_FULL || pieces.map((p) => p.text).join(" "))}</p></div>`
      : slotsHtml;

    shell(
      `<div class="walk-screen walk-letter-era walk-a4-era">
        <div class="a4-topbar">
          <span class="chip">${step.slot} / ${quest.steps.length}</span>
          <h2 class="place">${escapeHtml(step.placeName)}</h2>
        </div>
        <p class="a4-lead">Перетащи обрывок на своё место на листе. Прямые края — внешняя рамка письма; зубцы — стык с соседом.</p>
        ${TEST_MODE ? photoSlotHtml(step) : ""}
        ${hintPillHtml()}
        <div class="a4-workspace" id="a4-assemble">
          <div class="a4-sheet a4-mosaic${uiState.done ? " is-complete" : ""}" id="a4-sheet">
            ${sheetInner}
          </div>
          ${
            uiState.done
              ? `<p class="a4-done-note">${escapeHtml(step.fact || "Письмо собрано.")}</p>`
              : `<div class="a4-tray a4-tray-rail" id="a4-tray">${trayHtml || "<p class='muted a4-tray-empty'>Обрывков пока нет</p>"}</div>`
          }
        </div>
      </div>`,
      footer(!!uiState.done)
    );
    bindHintPill(step);
    bindPhotoSlot(step);
    if (!uiState.done) bindA4Drag(step, pieces);
    bindNext(!!uiState.done);
  }

  function bindA4Drag(step, pieces) {
    const root = document.getElementById("a4-assemble");
    if (!root) return;
    let drag = null;

    const clearHover = () => {
      root.querySelectorAll(".a4-slot.is-hover").forEach((el) => el.classList.remove("is-hover"));
    };

    const slotAtPoint = (x, y) => {
      const els = document.elementsFromPoint(x, y);
      return els.find((el) => el.classList && el.classList.contains("a4-slot")) || null;
    };

    const placePiece = (pieceId, slotEl, ghost) => {
      const piece = pieceById(pieceId);
      if (!piece || !slotEl) return false;
      const want = Number(slotEl.dataset.order);
      if (want !== piece.order || uiState.placed[piece.id]) {
        return false;
      }
      uiState.placed[piece.id] = true;
      uiState.trayOrder = (uiState.trayOrder || []).filter((id) => id !== piece.id);
      if (ghost) ghost.remove();
      const all = pieces.every((p) => uiState.placed[p.id]);
      if (all) {
        uiState.done = true;
        setFeedback("Письмо собрано", "ok");
      } else {
        setFeedback("Кусок на месте", "ok");
      }
      renderLetterPuzzle(step);
      return true;
    };

    const returnGhost = (ghost, fromEl) => {
      if (!ghost) return;
      ghost.classList.add("is-return");
      const rect = fromEl ? fromEl.getBoundingClientRect() : null;
      if (rect) {
        ghost.style.transition = "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease";
        ghost.style.transform = `translate(${rect.left}px, ${rect.top}px) rotate(var(--scrap-rot, 0deg)) scale(1)`;
      }
      setTimeout(() => ghost.remove(), 360);
    };

    root.querySelectorAll(".a4-tray-item .scrap-piece").forEach((el) => {
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", (ev) => {
        if (uiState.done) return;
        ev.preventDefault();
        const pieceId = el.dataset.piece;
        const piece = pieceById(pieceId);
        if (!piece || uiState.placed[piece.id]) return;
        const rect = el.getBoundingClientRect();
        const ghost = el.cloneNode(true);
        ghost.classList.add("scrap-ghost");
        ghost.style.position = "fixed";
        ghost.style.left = "0";
        ghost.style.top = "0";
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.margin = "0";
        ghost.style.zIndex = "80";
        ghost.style.pointerEvents = "none";
        ghost.style.transform = `translate(${rect.left}px, ${rect.top}px) rotate(${getComputedStyle(el).getPropertyValue("--scrap-rot") || "0deg"}) scale(1.04)`;
        ghost.style.transition = "none";
        document.body.appendChild(ghost);
        el.classList.add("is-dragging-source");
        el.setPointerCapture(ev.pointerId);
        drag = {
          pieceId,
          el,
          ghost,
          ox: ev.clientX - rect.left,
          oy: ev.clientY - rect.top,
        };
      });

      el.addEventListener("pointermove", (ev) => {
        if (!drag || drag.el !== el) return;
        const x = ev.clientX - drag.ox;
        const y = ev.clientY - drag.oy;
        drag.ghost.style.transform = `translate(${x}px, ${y}px) rotate(-2deg) scale(1.06)`;
        clearHover();
        const slot = slotAtPoint(ev.clientX, ev.clientY);
        if (slot && Number(slot.dataset.order) === Number(el.dataset.order) && !slot.classList.contains("is-filled")) {
          slot.classList.add("is-hover");
        }
      });

      el.addEventListener("pointerup", (ev) => {
        if (!drag || drag.el !== el) return;
        clearHover();
        const slot = slotAtPoint(ev.clientX, ev.clientY);
        const ok = slot && placePiece(drag.pieceId, slot, drag.ghost);
        if (!ok) {
          el.classList.add("is-shake");
          setTimeout(() => el.classList.remove("is-shake"), 420);
          returnGhost(drag.ghost, el);
          setFeedback("Край не сходится — ищи своё место", "bad");
        }
        el.classList.remove("is-dragging-source");
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch (_) {}
        drag = null;
      });

      el.addEventListener("pointercancel", () => {
        if (!drag || drag.el !== el) return;
        clearHover();
        returnGhost(drag.ghost, el);
        el.classList.remove("is-dragging-source");
        drag = null;
      });
    });
  }

  function renderDetail(step) {
    // Больше не multiple-choice — симуляция ввода + фото-слот
    renderSafeInput({
      ...step,
      safePrompt: step.safePrompt || "Что нашли? (одно слово)",
      expected: step.expected || (step.options && step.options[step.correctIndex]) || "",
      alternatives: step.alternatives || [],
    });
  }

  function renderPuzzle(step) {
    const tiles = step.puzzleTiles || [];
    if (!uiState.order) uiState.order = [];
    taskChrome(
      step,
      `<div class="panel">
        <p class="muted">Нажимайте фрагменты, пока не соберёте все. Смотрите на реальное панно рядом.</p>
        <div class="puzzle-grid">
          ${tiles
            .map(
              (t, i) =>
                `<button type="button" class="puzzle-piece ${uiState.order.includes(i) ? "on" : ""}" data-i="${i}" style="background:${t.color}">${uiState.order.includes(i) ? t.label : ""}</button>`
            )
            .join("")}
        </div>
        <div id="fact"></div>
      </div>`,
      footer(!!uiState.done)
    );
    app.querySelectorAll(".puzzle-piece").forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        if (!uiState.order.includes(i)) uiState.order.push(i);
        if (uiState.order.length >= tiles.length) {
          uiState.done = true;
          setFeedback("Панно собрано", "ok");
        }
        renderPuzzle(step);
      };
    });
    if (uiState.done) {
      document.getElementById("fact").innerHTML = `<div class="fact-box">${step.fact}</div>`;
    }
    bindNext(!!uiState.done);
  }

  function renderCircle(step) {
    if (!uiState.doneCp) uiState.doneCp = [];
    const cps = step.checkpoints || [];
    taskChrome(
      step,
      `<div class="panel">
        <p class="muted">Обойдите объект и отметьте ракурсы.</p>
        <div class="options">
          ${cps
            .map(
              (c, i) =>
                `<button type="button" class="opt ${uiState.doneCp.includes(i) ? "correct" : ""}" data-i="${i}">${uiState.doneCp.includes(i) ? "✓ " : ""}${c}</button>`
            )
            .join("")}
        </div>
        <div id="fact"></div>
      </div>`,
      footer(!!uiState.done)
    );
    app.querySelectorAll(".opt").forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        if (!uiState.doneCp.includes(i)) uiState.doneCp.push(i);
        if (uiState.doneCp.length >= cps.length) {
          uiState.done = true;
          setFeedback("Обход завершён", "ok");
        }
        renderCircle(step);
      };
    });
    if (uiState.done) document.getElementById("fact").innerHTML = `<div class="fact-box">${step.fact}</div>`;
    bindNext(!!uiState.done);
  }

  function renderMosaic(step) {
    if (!uiState.sel) uiState.sel = {};
    const pairs = step.pairs || [];
    const targets = step.shuffleTargets || [];
    taskChrome(
      step,
      `<div class="panel">
        ${pairs
          .map(
            (p, i) => `<div class="myth-item">
            <div style="flex:1"><b>${p.fact}</b></div>
            <select data-i="${i}" class="field" style="width:auto;margin:0">
              <option value="">—</option>
              ${targets.map((t) => `<option value="${t}" ${uiState.sel[i] === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>`
          )
          .join("")}
        <button type="button" class="btn primary" id="check">Проверить</button>
        <div id="fact"></div>
      </div>`,
      footer(!!uiState.done)
    );
    app.querySelectorAll("select[data-i]").forEach((sel) => {
      sel.onchange = () => {
        uiState.sel[Number(sel.dataset.i)] = sel.value;
      };
    });
    document.getElementById("check").onclick = () => {
      const ok = pairs.every((p, i) => uiState.sel[i] === p.target);
      if (ok) {
        uiState.done = true;
        setFeedback("Все пары верны", "ok");
        document.getElementById("fact").innerHTML = `<div class="fact-box">${step.fact}</div>`;
        bindNext(true);
      } else setFeedback("Есть ошибка", "bad");
    };
    bindNext(!!uiState.done);
  }

  function renderStep() {
    const step = currentStep();
    if (!step) return renderDone();
    const ui = step.ui || "generic";

    if (ui === "contour") return renderContour(step);
    if (ui === "detail" || ui === "input") return renderDetail(step);
    if (ui === "safe") return renderSafeInput(step);
    if (ui === "letter_puzzle") return renderLetterPuzzle(step);
    if (ui === "puzzle") return renderPuzzle(step);
    if (ui === "circle") return renderCircle(step);
    if (ui === "mosaic") return renderMosaic(step);

    if (ui === "geo") {
      const reveal = step.revealM || 150;
      const unlock = step.radiusM || 35;
      taskChrome(
        step,
        `${photoSlotHtml(step)}
         ${hintPillHtml()}
         <div class="panel geo-lock panel-compact">
          ${
            uiState.unlocked
              ? scrapRevealHtml(step) || factLetterHtml(step.fact || step.unlockedText || "")
              : `<button type="button" class="btn primary" id="open-radar">Кристалл</button>
                 <button type="button" class="btn ghost" id="geo-demo">Демо</button>`
          }
        </div>`,
        footer(!!uiState.unlocked)
      );
      bindHintPill(step);
      bindPhotoSlot(step);
      const openRadar = (demo) => {
        if (!window.KP_Radar) {
          setFeedback("Модуль радара не загружен", "bad");
          return;
        }
        if (uiState.radar) return;
        const safe = resolveStepSafe(step) || {
          safeType: step.safeType || "wheel",
          safeCode: step.safeCode || "",
          safePrompt: step.safePrompt || "",
        };
        uiState.radar = new window.KP_Radar({
          targetLat: step.lat,
          targetLon: step.lon,
          unlockM: unlock,
          revealM: reveal,
          demo,
          fitMode: false,
          letterEra: isLetterEra(),
          hintText: scrapText(step) || step.fact || step.unlockedText || (isLetterEra() ? "Обрывок получен." : "Подсказка открыта."),
          safeType: safe.safeType,
          safeCode: safe.safeCode || "",
          safePrompt: safe.safePrompt || "",
          onUnlock: () => {
            uiState.unlocked = true;
            collectScrap(step);
            setFeedback(isLetterEra() ? "Обрывок получен" : "Сейф открыт. Подсказка получена.", "ok");
            bindNext(true);
          },
          onClose: () => {
            uiState.radar = null;
            if (uiState.unlocked) renderStep();
          },
        });
        uiState.radar.start();
      };
      document.getElementById("open-radar")?.addEventListener("click", () => openRadar(false));
      document.getElementById("geo-demo")?.addEventListener("click", () => openRadar(true));
      bindNext(!!uiState.unlocked);
      return;
    }

    if (ui === "quiz" || ui === "finale") {
      taskChrome(
        step,
        `<div class="panel">
          ${step.question ? `<p><b>${step.question}</b></p>` : ""}
          <div class="options">
            ${(step.options || []).map((o, i) => `<button type="button" class="opt" data-i="${i}">${o}</button>`).join("")}
          </div>
          <div id="fact"></div>
        </div>`,
        footer(!!uiState.done)
      );
      app.querySelectorAll(".opt").forEach((btn) => {
        btn.onclick = () => {
          const ok = Number(btn.dataset.i) === step.correctIndex;
          btn.classList.add(ok ? "correct" : "wrong");
          if (ok) {
            uiState.done = true;
            setFeedback("Верно", "ok");
            document.getElementById("fact").innerHTML = `<div class="fact-box">${step.fact}</div>`;
            bindNext(true);
          } else setFeedback("Не то", "bad");
        };
      });
      bindNext(!!uiState.done);
      return;
    }

    if (ui === "plaque" || ui === "year" || ui === "count") {
      const safe = ui !== "count" ? resolveStepSafe(step) : null;
      // Год / табличка / буквенный шифр — сейф без гео
      if (safe) {
        taskChrome(
          step,
          `<div class="panel">
            <p>${step.prompt || "Разгадка"}</p>
            ${
              uiState.done
                ? `<div class="fact-box">${step.fact || ""}</div>`
                : `<p class="muted">${safe.safePrompt || "Откройте сейф и введите ответ"}</p>
                   <button type="button" class="btn primary" id="open-safe">Открыть сейф</button>
                   <div id="fact"></div>`
            }
          </div>`,
          footer(!!uiState.done)
        );
        if (!uiState.done) {
          const openSafe = () => {
            if (!window.KP_openSafe) {
              setFeedback("Модуль сейфа не загружен", "bad");
              return;
            }
            if (uiState.radar) return;
            uiState.radar = window.KP_openSafe({
              safeType: safe.safeType,
              safeCode: safe.safeCode || "",
              safePrompt: safe.safePrompt || step.prompt || "",
              letterEra: isLetterEra(),
              hintText: step.fact || (isLetterEra() ? "Строка открыта." : "Открыто!"),
              onUnlock: () => {
                uiState.done = true;
                setFeedback("Сейф открыт", "ok");
                bindNext(true);
              },
              onClose: () => {
                uiState.radar = null;
                if (uiState.done) renderStep();
              },
            });
          };
          document.getElementById("open-safe")?.addEventListener("click", openSafe);
          // сразу открываем сейф — без текстового поля
          openSafe();
        }
        bindNext(!!uiState.done);
        return;
      }
      taskChrome(
        step,
        `<div class="panel">
          <p>${step.prompt || "Ответ"}</p>
          <input class="field" id="answer" />
          <button type="button" class="btn primary" id="check">Проверить</button>
          <div id="fact"></div>
        </div>`,
        footer(!!uiState.done)
      );
      document.getElementById("check").onclick = () => {
        let ok = false;
        if (ui === "count") {
          const n = Number(document.getElementById("answer").value);
          ok = Math.abs(n - step.correctNumber) <= (step.tolerance ?? 0);
        } else ok = checkText(step.expected, step.alternatives || []);
        if (ok) {
          uiState.done = true;
          setFeedback("Засчитано", "ok");
          document.getElementById("fact").innerHTML = `<div class="fact-box">${step.fact}</div>`;
          bindNext(true);
        } else setFeedback("Пока мимо", "bad");
      };
      bindNext(!!uiState.done);
      return;
    }

    if (ui === "myth") {
      if (!uiState.marks) uiState.marks = step.statements.map(() => null);
      taskChrome(
        step,
        `<div class="panel">
          ${step.statements
            .map(
              (s, i) => `<div class="myth-item">
              <div style="flex:1">${s.text}</div>
              <button type="button" class="btn ghost" style="width:auto;padding:6px 10px" data-i="${i}" data-v="true">Факт</button>
              <button type="button" class="btn ghost" style="width:auto;padding:6px 10px" data-i="${i}" data-v="false">Миф</button>
            </div>`
            )
            .join("")}
          <button type="button" class="btn primary" id="check">Проверить</button>
          <div id="fact"></div>
        </div>`,
        footer(!!uiState.done)
      );
      app.querySelectorAll("[data-v]").forEach((btn) => {
        btn.onclick = () => {
          uiState.marks[Number(btn.dataset.i)] = btn.dataset.v === "true";
          btn.style.borderColor = "var(--accent)";
        };
      });
      document.getElementById("check").onclick = () => {
        const ok = step.statements.every((s, i) => uiState.marks[i] === s.truth);
        if (ok) {
          uiState.done = true;
          setFeedback("Верно", "ok");
          document.getElementById("fact").innerHTML = `<div class="fact-box">${step.fact}</div>`;
          bindNext(true);
        } else setFeedback("Есть ошибка", "bad");
      };
      bindNext(!!uiState.done);
      return;
    }

    taskChrome(
      step,
      `<div class="panel"><p>Демо: ${step.mechanicName}</p>
       <button type="button" class="btn primary" id="ok">Засчитать</button>
       <div class="fact-box">${step.fact || ""}</div></div>`,
      footer(!!uiState.done)
    );
    document.getElementById("ok").onclick = () => {
      uiState.done = true;
      setFeedback("Засчитано", "ok");
      bindNext(true);
    };
    bindNext(!!uiState.done);
  }

  function render() {
    if (progress.stepIndex < 0) return renderStart();
    if (progress.stepIndex >= quest.steps.length) return renderDone();
    return renderStep();
  }

  render();
  if (window.KP_PRELOAD_SILHOUETTES) window.KP_PRELOAD_SILHOUETTES();
})();
