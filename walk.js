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

  function save() {
    if (TEST_MODE) localStorage.setItem(TEST_PROGRESS_KEY, JSON.stringify(progress));
    else KP.saveProgress(progress);
  }

  function startWalk() {
    progress.stepIndex = 0;
    progress.answers = [];
    progress.startedAt = Date.now();
    progress.mapReady = true;
    uiState = {};
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
    uiState = {};
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
      iconSize: [36, 52],
      iconAnchor: [18, 48],
      tooltipAnchor: [0, -44],
    });
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
      mapInstance = L.map(el, { zoomControl: false, attributionControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "",
      }).addTo(mapInstance);

      const openLine = openRoutePoints(stepsWithGeo);
      const roadLine = await fetchRoadGeometry(openLine);
      // мягкая «тень» под пунктиром
      L.polyline(roadLine, {
        color: "#8b6914",
        weight: 7,
        opacity: 0.28,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(mapInstance);
      const line = L.polyline(roadLine, {
        color: "#e6c36a",
        weight: 4,
        opacity: 0.98,
        dashArray: "8 12",
        lineCap: "round",
        lineJoin: "round",
        className: "route-dash",
      }).addTo(mapInstance);

      stepsWithGeo.forEach((s, i) => {
        L.marker([s.lat, s.lon], {
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
        <p class="route-map-caption">${quest.subtitle || "Сначала посмотрите весь маршрут — задания откроются после карты."}</p>
        <div class="route-map" id="route-map-wrap">
          <div id="route-map-el"></div>
          <div id="route-map-svg-host" hidden>${buildRouteSvg()}</div>
        </div>
        <ol class="steps-mini route-legend">
          ${quest.steps
            .map(
              (s) =>
                `<li><b>${s.slot}.</b> ${s.chapterTitle || s.mechanicName}<br/><span class="muted">${s.placeName}</span></li>`
            )
            .join("")}
        </ol>
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
    if (ui === "safe" || ui === "input") return !!uiState.done;
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
      setFeedback("Тест: верный ответ показан", "ok");
      renderContour(step);
      return;
    }
    if (ui === "geo") {
      uiState.unlocked = true;
      setFeedback("Тест: сейф открыт", "ok");
      renderStep();
      return;
    }
    if (ui === "detail" || ui === "quiz" || ui === "finale" || ui === "input" || ui === "safe") {
      uiState.done = true;
      const ans = String(step.safeCode || step.expected || "");
      renderStep();
      requestAnimationFrame(() => {
        const input = document.getElementById("answer");
        if (input && ans) input.value = ans.replace(/-/g, "");
        const fact = document.getElementById("fact");
        if (fact) fact.innerHTML = `<div class="fact-box">${step.fact || ""}</div>`;
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
        ${TEST_MODE ? `<p class="test-banner">ТЕСТОВАЯ ПРОГУЛКА · Далее подставляет ответ</p>` : ""}
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

  function panelInputHint(step) {
    if (step.safePrompt) return step.safePrompt;
    if (step.ui === "contour") return "Совместите контур в камере";
    if (step.ui === "geo") return "Откройте сейф у точки";
    if (step.expected) return "Введите ответ на табло";
    return "Введите ответ на табло";
  }

  function photoSlotHtml(step, opts = {}) {
    const inputHint = opts.hintText || panelInputHint(step);
    return `<div class="photo-slot" aria-label="Место под фото с точки">
      <span class="photo-slot-label">ваше фото</span>
      <div class="photo-slot-hint">
        <span class="photo-slot-hint-kicker">На табло</span>
        <p>${inputHint}</p>
      </div>
    </div>`;
  }

  function hintPillHtml() {
    return `<button type="button" class="hint-pill" id="hint-pill" aria-expanded="false">Подсказка</button>
      <div class="hint-panel" id="hint-panel" hidden></div>`;
  }

  function bindHintPill(step) {
    const pill = document.getElementById("hint-pill");
    const panel = document.getElementById("hint-panel");
    if (!pill || !panel) return;
    const levels = [step.hintL1, step.hintL2, step.hintL3].filter(Boolean);
    let level = 0;
    pill.onclick = () => {
      if (!levels.length) {
        panel.hidden = false;
        panel.textContent = step.hint || "Смотрите на место.";
        pill.setAttribute("aria-expanded", "true");
        return;
      }
      panel.hidden = false;
      panel.innerHTML = `<p><b>L${level + 1}</b> · ${levels[level]}</p>`;
      pill.setAttribute("aria-expanded", "true");
      level = Math.min(level + 1, levels.length - 1);
    };
  }

  function inputSimHtml(step) {
    const isYear = step.safeType === "year" || (step.expected || "").match(/^\d{4}$/);
    const isCode = step.safeType === "code" || (step.expected || "").match(/^\d{4,}$/);
    const inputMode = isYear || isCode ? "numeric" : "text";
    const placeholder = isYear ? "4 цифры" : isCode ? "код" : "слово";
    return `<div class="input-sim panel">
      <input class="field input-sim-field" id="answer" inputmode="${inputMode}" autocomplete="off" placeholder="${placeholder}" />
      <div class="input-sim-keys" id="sim-keys" ${isYear || isCode ? "" : "hidden"}>
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"]
          .map((k) => `<button type="button" class="sim-key" data-k="${k}">${k}</button>`)
          .join("")}
      </div>
      <button type="button" class="btn primary" id="check">Проверить</button>
      <div id="fact"></div>
    </div>`;
  }

  function bindInputSim(step) {
    const input = document.getElementById("answer");
    const keys = document.getElementById("sim-keys");
    if (keys && !keys.hidden) {
      keys.querySelectorAll(".sim-key").forEach((btn) => {
        btn.onclick = () => {
          if (!input) return;
          const k = btn.dataset.k;
          if (k === "⌫") input.value = input.value.slice(0, -1);
          else if (k === "OK") document.getElementById("check")?.click();
          else input.value += k;
          input.focus();
        };
      });
    }
    document.getElementById("check").onclick = () => {
      const expected = step.safeCode || step.expected || "";
      const alts = step.alternatives || [];
      const ok = checkText(expected, alts) || (expected && checkText(String(expected).replace(/-/g, ""), alts));
      if (ok) {
        uiState.done = true;
        setFeedback("Засчитано", "ok");
        const fact = document.getElementById("fact");
        if (fact) fact.innerHTML = `<div class="fact-box">${step.fact || ""}</div>`;
        bindNext(true);
      } else setFeedback("Пока мимо — смотрите подсказку на фото-слоте", "bad");
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
           ? `<div class="panel fact-box">${step.fact || ""}</div>`
           : inputSimHtml(step)
       }`,
      footer(!!uiState.done)
    );
    bindHintPill(step);
    if (!uiState.done) bindInputSim(step);
    else bindNext(true);
  }

  function taskChrome(step, bodyHtml, footerHtml, opts = {}) {
    const hidePlace = opts.hidePlace || (step.hidePlaceUntilGuess && !uiState.guessed);
    const brief = step.brief || step.hint || "";
    const atmosphere = step.atmosphere || "";
    const cardBody = [brief, atmosphere].filter(Boolean).join(" ");
    shell(
      `<div class="walk-screen">
        <div class="chip-row">
          <span class="chip">Шаг ${step.slot} / ${quest.steps.length}</span>
          <span class="chip">${step.mechanicName}</span>
          ${step.uniqueFeature ? '<span class="chip feature">фишка</span>' : ""}
        </div>
        <h2 class="place">${hidePlace ? "???" : step.placeName}</h2>
        <p class="addr">${hidePlace ? "Сначала совместите контур" : step.address || ""}</p>
        <div class="panel">
          <h2>${step.title}</h2>
          <p>${cardBody}</p>
        </div>
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
        `<div class="panel contour-panel">
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
            document.getElementById("extra").innerHTML += `<div class="fact-box">${step.fact}</div>`;
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
          document.getElementById("extra").innerHTML = `<div class="fact-box">${step.fact}</div>`;
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
        <div class="fact-box">${step.fact}</div>
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
            ? "Далее подставляет верный ответ или отмечает вариант — можно пройти все шаги без ввода."
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
         <div class="panel geo-lock">
          <div class="lock-icon">${uiState.unlocked ? "открыто" : "закрыто"}</div>
          <p>${uiState.unlocked ? step.unlockedText : step.brief || step.lockedTeaser}</p>
          <div class="geo-hint-box">
            <p class="muted"><b>Кристалл.</b> Красный свет с ${reveal}&nbsp;м · сейф ≤ ${unlock}&nbsp;м.</p>
          </div>
          ${
            uiState.unlocked
              ? `<div class="fact-box">${step.fact}</div>`
              : `<button type="button" class="btn primary" id="open-radar">Включить кристалл</button>
                 <button type="button" class="btn ghost" id="geo-demo">Демо без GPS</button>`
          }
        </div>`,
        footer(!!uiState.unlocked)
      );
      bindHintPill(step);
      const openRadar = (demo) => {
        if (!window.KP_Radar) {
          setFeedback("Модуль радара не загружен", "bad");
          return;
        }
        if (uiState.radar) return;
        // Ровно один fixed safeType на задание (из content-db); без пикера/цикла.
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
          hintText: step.unlockedText || step.fact || "Подсказка открыта.",
          safeType: safe.safeType,
          safeCode: safe.safeCode || "",
          safePrompt: safe.safePrompt || "",
          onUnlock: () => {
            uiState.unlocked = true;
            setFeedback("Сейф открыт. Подсказка получена.", "ok");
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
              hintText: step.fact || "Открыто!",
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
