(() => {
  const app = document.getElementById("app");
  let quest = KP.ensureDemoQuest();
  let progress = KP.loadProgress();
  if (!progress || progress.questId !== quest.id) {
    progress = { questId: quest.id, stepIndex: -1, answers: [], startedAt: Date.now() };
    KP.saveProgress(progress);
  }
  let uiState = {};

  function save() {
    KP.saveProgress(progress);
  }

  function startWalk() {
    progress.stepIndex = 0;
    progress.answers = [];
    progress.startedAt = Date.now();
    uiState = {};
    save();
    render();
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

  function currentStep() {
    return quest.steps[progress.stepIndex];
  }

  function shell(inner, footer) {
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
        <h1 class="walk-title">${quest.title}</h1>
        <p class="walk-meta">${quest.zoneLabel} · ${quest.difficultyLabel} · ${quest.durationHint}</p>
        ${dots}
      </div>
      ${inner}
      ${footer || ""}
    `;
  }

  function footer(canNext, feedback) {
    return `<div class="walk-footer">
      <div class="feedback ${feedback?.cls || ""}" id="feedback">${feedback?.text || ""}</div>
      <button type="button" class="btn primary" id="next" ${canNext ? "" : "disabled"}>
        ${progress.stepIndex >= quest.steps.length - 1 ? "Завершить" : "Далее"}
      </button>
    </div>`;
  }

  function bindNext(enabled) {
    const btn = document.getElementById("next");
    if (!btn) return;
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
    const input = document.getElementById("answer");
    const val = (input?.value || "").trim().toLowerCase();
    const okList = [expected, ...alternatives].map((x) => String(x).trim().toLowerCase());
    return okList.includes(val);
  }

  function taskChrome(step, bodyHtml, footerHtml, opts = {}) {
    const hidePlace = opts.hidePlace || (step.hidePlaceUntilGuess && !uiState.guessed);
    shell(
      `<div class="walk-screen">
        <div class="chip-row">
          <span class="chip">Шаг ${step.slot} / ${quest.steps.length}</span>
          <span class="chip">${step.mechanicName}</span>
          ${step.uniqueFeature ? '<span class="chip feature">фишка</span>' : ""}
        </div>
        <h2 class="place">${hidePlace ? "???" : step.placeName}</h2>
        <p class="addr">${hidePlace ? "Сначала угадайте по контуру" : step.address || ""}</p>
        <div class="panel">
          <h2>${step.title}</h2>
          <p>${step.hint}</p>
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

  function scoreCaptureVsSilhouette(video, key, tolerance) {
    const w = 180;
    const h = 320;
    const mask = window.KP_SILHOUETTE_MASK && window.KP_SILHOUETTE_MASK(key, w, h);
    if (!mask) return { ok: false, score: 0 };
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    // cover-fit video into canvas
    const vw = video.videoWidth || w;
    const vh = video.videoHeight || h;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const frame = ctx.getImageData(0, 0, w, h);
    let maskOn = 0;
    let hit = 0;
    for (let i = 0; i < mask.data.length; i += 4) {
      const inMask = mask.data[i] > 180;
      if (!inMask) continue;
      maskOn += 1;
      const r = frame.data[i];
      const g = frame.data[i + 1];
      const b = frame.data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // monument bronze/stone vs bright sky — dark-ish pixels inside silhouette
      if (lum < 140) hit += 1;
    }
    const score = maskOn ? hit / maskOn : 0;
    const thr = tolerance != null ? tolerance : 0.22;
    return { ok: score >= thr, score };
  }

  function renderContour(step) {
    const key = step.silhouetteKey || "pushkin";
    const silGuess = (window.KP_SILHOUETTE_HTML && window.KP_SILHOUETTE_HTML(key, "guess")) || "";
    const silAr = (window.KP_SILHOUETTE_HTML && window.KP_SILHOUETTE_HTML(key, "ar")) || "";
    const phase = uiState.phase || "guess"; // guess | camera | done

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
        `<div class="panel">
          <div class="silhouette-stage">${silGuess}</div>
          <p class="muted">${step.contourHint || "Откройте камеру и совместите контур с памятником."}</p>
          <button type="button" class="btn primary" id="open-cam">Открыть камеру</button>
          <button type="button" class="btn ghost" id="fallback">Без камеры — вопрос</button>
          <div id="extra"></div>
        </div>`,
        footer(!!uiState.done)
      );
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
          if (checkText(step.fallbackAnswer, [])) {
            uiState.done = true;
            uiState.phase = "done";
            setFeedback("Fallback принят", "ok");
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
          <p class="muted">Наведите камеру так, чтобы памятник совпал с золотым контуром.</p>
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
        const result = scoreCaptureVsSilhouette(video, key, step.matchTolerance);
        const pct = Math.round(result.score * 100);
        if (result.ok) {
          stopCamera();
          uiState.done = true;
          uiState.phase = "done";
          setFeedback(`Совпало (~${pct}%). Засчитано.`, "ok");
          document.getElementById("extra").innerHTML = `<div class="fact-box">${step.fact}</div>`;
          bindNext(true);
        } else {
          setFeedback(`Пока мимо (~${pct}%). Подвиньте камеру и попробуйте ещё — допускается небольшая погрешность.`, "bad");
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
    shell(
      `<div class="start-hero">
        <p class="eyebrow">Режим игрока</p>
        <h1>${quest.title}</h1>
        <p class="muted">${quest.subtitle}</p>
        <div class="map-fake">Кластер точек · ${quest.zoneLabel}</div>
        <div class="steps-mini">
          ${quest.steps
            .map(
              (s) =>
                `<div><b>${s.slot}.</b> ${s.mechanicName}${s.uniqueFeature ? " · фишка" : ""}<br/><span class="muted">${s.placeName}</span></div>`
            )
            .join("")}
        </div>
        <button type="button" class="btn primary" id="start">Начать прогулку</button>
        <button type="button" class="btn ghost" id="rebuild">Новая сборка из базы (без повторов)</button>
        <button type="button" class="btn ghost" id="import">Импорт JSON</button>
        <input type="file" id="file" accept="application/json,.json" hidden />
      </div>`
    );
    document.getElementById("start").onclick = startWalk;
    document.getElementById("rebuild").onclick = () => {
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
    document.getElementById("import").onclick = () => document.getElementById("file").click();
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
    const crop = KP.assetSvg(step.cropAsset || "crop_lion_mascaron");
    taskChrome(
      step,
      `<div class="panel">
        <div class="crop-photo">${crop}</div>
        <p class="muted">${step.cropCaption || "Кроп с реального декора. Найдите тот же фрагмент на месте."}</p>
        <div class="options">
          ${(step.options || []).map((o, i) => `<button type="button" class="opt" data-i="${i}">${o}</button>`).join("")}
        </div>
        <div id="fact"></div>
      </div>`,
      footer(!!uiState.done)
    );
    app.querySelectorAll(".opt").forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        const ok = i === step.correctIndex;
        app.querySelectorAll(".opt").forEach((b) => b.classList.remove("correct", "wrong"));
        btn.classList.add(ok ? "correct" : "wrong");
        if (ok) {
          uiState.done = true;
          setFeedback("Верно — вы нашли деталь на фасаде", "ok");
          document.getElementById("fact").innerHTML = `<div class="fact-box">${step.fact}</div>`;
          bindNext(true);
        } else setFeedback("Не тот элемент — сравните кроп с фасадом", "bad");
      };
    });
    bindNext(!!uiState.done);
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
    if (ui === "detail") return renderDetail(step);
    if (ui === "puzzle") return renderPuzzle(step);
    if (ui === "circle") return renderCircle(step);
    if (ui === "mosaic") return renderMosaic(step);

    if (ui === "geo") {
      const reveal = step.revealM || 150;
      const unlock = step.radiusM || 35;
      taskChrome(
        step,
        `<div class="panel geo-lock">
          <div class="lock-icon">${uiState.unlocked ? "открыто" : "закрыто"}</div>
          <p>${uiState.unlocked ? step.unlockedText : step.lockedTeaser}</p>
          <div class="geo-hint-box">
            <p class="muted"><b>Подсказка.</b> Радар показывает вас в центре. Красная цель появляется ближе ${reveal}&nbsp;м, пульсирует чаще при сближении и ползёт к центру. Сейф открывается ≤ ${unlock}&nbsp;м.</p>
          </div>
          ${
            uiState.unlocked
              ? `<div class="fact-box">${step.fact}</div>`
              : `<button type="button" class="btn primary" id="open-radar">Включить радар</button>
                 <button type="button" class="btn ghost" id="geo-demo">Демо без GPS</button>`
          }
        </div>`,
        footer(!!uiState.unlocked)
      );
      const openRadar = (demo) => {
        if (!window.KP_Radar) {
          setFeedback("Модуль радара не загружен", "bad");
          return;
        }
        if (uiState.radar) return;
        uiState.radar = new window.KP_Radar({
          targetLat: step.lat,
          targetLon: step.lon,
          unlockM: unlock,
          revealM: reveal,
          demo,
          onUnlock: () => {
            uiState.unlocked = true;
            setFeedback("Точка захвачена. Сейф открыт.", "ok");
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
