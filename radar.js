/**
 * Полноэкранный гео-радар: sweep, кольца дальности, красный blip < 300 м.
 * Режим heading-up: верх экрана = направление взгляда; точка и N/E/S/W крутятся с компасом.
 */
(function () {
  const REVEAL_M = 300;

  function toRad(d) {
    return (d * Math.PI) / 180;
  }
  function toDeg(r) {
    return (r * 180) / Math.PI;
  }

  function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function bearingDeg(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function norm360(d) {
    return ((d % 360) + 360) % 360;
  }

  function lerpAngle(from, to, t) {
    let d = to - from;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return norm360(from + d * t);
  }

  class Radar {
    constructor(opts) {
      this.targetLat = opts.targetLat;
      this.targetLon = opts.targetLon;
      this.unlockM = opts.unlockM || 35;
      this.revealM = opts.revealM || REVEAL_M;
      this.onUnlock = opts.onUnlock || (() => {});
      this.onClose = opts.onClose || (() => {});
      this.hintText = opts.hintText || "Подсказка открыта.";
      this.demo = !!opts.demo;
      this.safeType = opts.safeType || "wheel"; // wheel | year | code | dial
      this.safeCode = String(opts.safeCode || "").trim();
      this.safePrompt = opts.safePrompt || "";
      this.needsCalibration = opts.needsCalibration !== false;

      this.userLat = null;
      this.userLon = null;
      this.heading = 0;
      this.hasHeading = false;
      this.distance = null;
      this.unlocked = false;
      this.running = false;
      this.sweep = 0;
      this.blips = [];
      this.watchId = null;
      this.orientHandler = null;
      this.raf = 0;
      this.demoAngle = 40;
      this.demoDist = Math.max(this.revealM + 40, 340);
      this._pulsePhase = 0;
      this.chestReady = false;
      this.chestOpened = false;
      this.scrollReady = false;
      this.scrollOpened = false;
      this.liveCompass = false;
      this._compassRaw = null;

      this._buildDom();
    }

    _buildDom() {
      const root = document.createElement("div");
      root.className = "radar-overlay";
      root.innerHTML = `
        <div class="radar-bezel">
          <div class="radar-hud">
            <div class="radar-hud-left">
              <div class="radar-title">КРИСТАЛЛ</div>
              <div class="radar-status" id="radar-status">ПОИСК…</div>
            </div>
            <div class="radar-hud-right">
              <div class="radar-readout" id="radar-dist">— м</div>
              <div class="radar-readout sub" id="radar-bearing">сейф ≤ ${this.unlockM} м</div>
            </div>
          </div>
          <button type="button" class="btn primary radar-hud-open" id="radar-open-safe" hidden>Открыть сейф</button>
          <div class="radar-scope-wrap crystal-stage">
            <div class="radar-crystal" id="radar-crystal">
              <div class="radar-crystal-glow" id="radar-crystal-glow"></div>
              <img class="radar-crystal-img" src="assets/ui/crystal.png" alt="" draggable="false" />
            </div>
          </div>
          <div class="radar-legend">
            <span>красный свет · с 300 м тускло · ближе ярче и чаще</span>
          </div>
          <div class="radar-actions">
            <button type="button" class="btn primary" id="radar-demo-near">Симуляция: подойти ближе</button>
            <button type="button" class="btn ghost" id="radar-close">Закрыть</button>
          </div>
        </div>

        <div class="loot-stage" id="loot-stage" aria-hidden="true">
          <div class="safe-stage" id="safe-stage">
            <div class="safe-glow" aria-hidden="true"></div>
            <div class="safe-photo-wrap" id="radar-safe"></div>
          </div>

          <button type="button" class="scroll-fly" id="scroll-fly" hidden aria-label="Открыть свиток">
            <img class="scroll-rolled-img" src="assets/ui/scroll-rolled.png" alt="" draggable="false" />
            <span class="scroll-label">Подсказка</span>
          </button>

          <div class="scroll-sheet" id="scroll-sheet" hidden>
            <img class="scroll-bg" src="assets/ui/scroll-unrolled.png" alt="" draggable="false" />
            <div class="scroll-text">
              <p class="scroll-title">Подсказка</p>
              <p class="scroll-body" id="scroll-hint-text"></p>
              <button type="button" class="btn primary" id="scroll-done">Продолжить</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(root);
      this.root = root;
      this.canvas = null;
      this.elDisk = null;
      this.ctx = null;
      this.elStatus = root.querySelector("#radar-status");
      this.elDist = root.querySelector("#radar-dist");
      this.elBearing = root.querySelector("#radar-bearing");
      this.elLoot = root.querySelector("#loot-stage");
      this.elSafeStage = root.querySelector("#safe-stage");
      this.elSafe = root.querySelector("#radar-safe");
      this.elOpenSafe = root.querySelector("#radar-open-safe");
      this.elScrollFly = root.querySelector("#scroll-fly");
      this.elScrollSheet = root.querySelector("#scroll-sheet");
      this.elScrollHint = root.querySelector("#scroll-hint-text");
      this.elDemoNear = root.querySelector("#radar-demo-near");
      this.elDemoTurn = null;
      this.elCal = null;
      this.elCalDeg = null;
      this.elCrystal = root.querySelector("#radar-crystal");
      this.elCrystalGlow = root.querySelector("#radar-crystal-glow");
      this._crystalPhase = 0;
      this._crystalOn = false;

      this._spinTurnsNeeded = 3;
      this._spinAccum = 0;
      this._spinAngle = 0;
      this._spinReady = false;
      this._spinDragging = false;
      this._spinLastAng = null;
      this._codeBuffer = "";
      this._dialAngle = 0;
      this._dialMarks = [];
      this._calDone = true;
      this.needsCalibration = false;

      this._mountSafePanel();

      root.querySelector("#radar-close").onclick = () => this.close();
      this.elDemoNear.onclick = () => {
        this.demo = true;
        if (this.demoDist == null) this.demoDist = Math.max(this.revealM + 20, 320);
        const cur = this.distance != null ? this.distance : this.demoDist;
        this.demoDist = Math.max(5, Math.min(this.demoDist, cur) - 55);
        this.demoAngle = this.demoAngle ?? 40;
        this._updateMetrics();
      };
      this.elOpenSafe.onclick = () => this._forceShowSafeAndFocus();
      this.elScrollFly.onclick = () => this._openScroll();
      root.querySelector("#scroll-done").onclick = () => this._setUnlockedAndLeave();

      this._updateCrystal();
    }

    _mountSafePanel() {
      const type = this.safeType;
      const prompt = this.safePrompt || "";
      let html = "";
      if (type === "year") {
        const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        // тройной цикл — бесконечная прокрутка барабанов
        const strip = [...digits, ...digits, ...digits]
          .map((d) => `<div class="year-cell">${d}</div>`)
          .join("");
        html = `
          <div class="safe-variant safe-year">
            <img class="safe-img safe-img-body" src="assets/ui/safe-dial-body.png" alt="Сейф" draggable="false" />
            <div class="safe-overlay-card">
              <p class="safe-tap-hint">${prompt || "Прокрутите год"}</p>
              <div class="year-lock" id="year-drums">
                ${[0, 1, 2, 3]
                  .map(
                    (i) => `<div class="year-drum" data-i="${i}">
                  <div class="year-track" id="year-track-${i}">${strip}</div>
                </div>`
                  )
                  .join("")}
                <div class="year-window" aria-hidden="true"></div>
              </div>
              <button type="button" class="btn primary safe-unlock-btn" id="safe-unlock-btn">Открыть</button>
            </div>
          </div>`;
      } else if (type === "code") {
        html = `
          <div class="safe-variant safe-code">
            <img class="safe-img safe-img-body" src="assets/ui/safe-keypad-body.png" alt="Сейф" draggable="false" />
            <div class="safe-overlay-card">
              <p class="safe-tap-hint">${prompt || "Введите код"}</p>
              <div class="code-display" id="code-display">****</div>
              <div class="code-pad" id="code-pad">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"]
                  .map((k) => `<button type="button" class="code-key" data-k="${k}">${k}</button>`)
                  .join("")}
              </div>
            </div>
          </div>`;
      } else if (type === "dial") {
        html = `
          <div class="safe-variant safe-dial">
            <img class="safe-img safe-img-body" src="assets/ui/safe-dial-body.png" alt="Сейф" draggable="false" />
            <div class="safe-overlay-card">
              <p class="safe-tap-hint">${prompt || "Крутите диск · зафиксируйте 3 числа"}</p>
              <div class="dial-readout"><span id="dial-num">0</span><span class="dial-marks" id="dial-marks">—</span></div>
              <div class="dial-ring" id="dial-ring" role="slider" aria-label="Диск шифра">
                <div class="dial-knob" id="dial-knob"></div>
                <div class="dial-notch"></div>
              </div>
              <div class="dial-actions">
                <button type="button" class="btn ghost" id="dial-mark">Зафиксировать</button>
                <button type="button" class="btn ghost" id="dial-reset">Сброс</button>
              </div>
              <button type="button" class="btn primary safe-unlock-btn" id="safe-unlock-btn" hidden>Открыть</button>
            </div>
          </div>`;
      } else {
        // wheel — тёмный сейф AIKO + трёхлучевая ручка (pivot = центр ступицы)
        html = `
          <div class="safe-variant safe-wheel">
            <div class="safe-photo-stack" style="aspect-ratio:3/4">
              <img class="safe-img safe-img-body" src="assets/ui/safe-aiko-body.png" alt="Сейф" draggable="false" />
              <svg class="safe-progress" id="safe-progress" viewBox="0 0 100 100" aria-hidden="true"
                style="left:52.5%;top:47.5%;width:48%">
                <circle class="safe-progress-bg" cx="50" cy="50" r="46" />
                <circle class="safe-progress-fg" id="safe-progress-fg" cx="50" cy="50" r="46" />
              </svg>
              <div class="safe-handle-pivot" id="safe-handle-pivot" style="left:52.5%;top:47.5%;width:42%">
                <img class="safe-handle-spin" id="safe-handle-spin" src="assets/ui/safe-aiko-handle.png" alt=""
                  draggable="false" />
              </div>
            </div>
            <p class="safe-tap-hint" id="safe-tap-hint">Крутите ручку пальцем · 3 оборота</p>
            <button type="button" class="btn primary safe-unlock-btn" id="safe-unlock-btn" hidden>Открыть</button>
          </div>`;
      }
      this.elSafe.innerHTML = html;
      this.elHandleSpin = this.elSafe.querySelector("#safe-handle-spin");
      this.elProgressFg = this.elSafe.querySelector("#safe-progress-fg");
      this.elUnlockBtn = this.elSafe.querySelector("#safe-unlock-btn");
      this.elTapHint = this.elSafe.querySelector("#safe-tap-hint") || this.elSafe.querySelector(".safe-tap-hint");
      if (this.elProgressFg) {
        const circ = 2 * Math.PI * 46;
        this.elProgressFg.style.strokeDasharray = String(circ);
        this.elProgressFg.style.strokeDashoffset = String(circ);
      }
      if (this.elUnlockBtn) this.elUnlockBtn.onclick = () => this._tryUnlockSafe();
      if (type === "wheel") this._bindHandleSpin();
      if (type === "year") this._bindYearDrums();
      if (type === "code") this._bindCodePad();
      if (type === "dial") this._bindDial();
    }

    _resize() {
      /* crystal stage — no canvas */
    }

    async start() {
      this.running = true;

      if (this.demo) {
        this.demoDist = Math.max(this.revealM - 40, 220);
        this.demoAngle = 40;
        this._updateMetrics();
        this._tick();
        return;
      }

      if (!navigator.geolocation) {
        this.elStatus.textContent = "ГЕО НЕДОСТУПНО — демо";
        this.demo = true;
        this.demoDist = Math.max(this.revealM - 40, 220);
        this._updateMetrics();
        this._tick();
        return;
      }

      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.userLat = pos.coords.latitude;
          this.userLon = pos.coords.longitude;
          this._updateMetrics();
        },
        (err) => {
          this.elStatus.textContent = "GPS: " + (err.message || "ошибка") + " — демо";
          this.demo = true;
          this.demoDist = Math.max(this.revealM - 20, 260);
          this._updateMetrics();
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
      );
      this._tick();
    }

    async _requestOrientation() {
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") {
          this.elStatus.textContent = "НЕТ ДОСТУПА К КОМПАСУ";
          return;
        }
      }

      this._alpha0 = null;
      this._compassMode = null; // webkit | absolute | relative
      this.orientHandler = (e) => {
        let h = null;
        let mode = null;
        if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
          h = e.webkitCompassHeading;
          mode = "webkit";
        } else if (e.absolute === true && typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
          if (this._compassMode === "webkit") return;
          h = norm360(360 - e.alpha);
          const so =
            (screen.orientation && typeof screen.orientation.angle === "number"
              ? screen.orientation.angle
              : typeof window.orientation === "number"
                ? window.orientation
                : 0) || 0;
          h = norm360(h + so);
          mode = "absolute";
        } else if (typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
          if (this._compassMode === "webkit" || this._compassMode === "absolute") return;
          if (this._alpha0 == null) this._alpha0 = e.alpha;
          h = norm360(this._alpha0 - e.alpha);
          mode = "relative";
        }
        if (h == null) return;

        if (mode) this._compassMode = mode;
        this._compassRaw = h;
        this.liveCompass = true;
        this.hasHeading = true;
        this.heading = this._compassInited ? lerpAngle(this.heading, h, 0.9) : h;
        this._compassInited = true;
        if (this.elCalDeg) this.elCalDeg.textContent = "курс " + Math.round(this.heading) + "°";
        if (this.running) this._applyCompassRotate();
      };

      window.addEventListener("deviceorientationabsolute", this.orientHandler, true);
      window.addEventListener("deviceorientation", this.orientHandler, true);
    }

    _applyCompassRotate() {
      this._refreshHud();
    }

    _updateMetrics() {
      if (this.demo) {
        this.distance = this.demoDist;
        this._bearingToTarget = this.demoAngle ?? 40;
        this._refreshHud();
        this._updateCrystal();
        this._maybeShowChest();
        return;
      }
      if (this.userLat == null) return;
      this.distance = haversineM(this.userLat, this.userLon, this.targetLat, this.targetLon);
      this._bearingToTarget = bearingDeg(this.userLat, this.userLon, this.targetLat, this.targetLon);
      this._refreshHud();
      this._updateCrystal();
      this._maybeShowChest();
    }

    _refreshHud() {
      if (this.distance == null) {
        this.elDist.textContent = "— м";
        this.elStatus.textContent = this.demo ? "ДЕМО" : "ОЖИДАНИЕ GPS…";
        if (this.elBearing) this.elBearing.textContent = "сейф ≤ " + this.unlockM + " м";
        return;
      }
      this.elDist.textContent = Math.round(this.distance) + " м";
      if (this.elBearing) this.elBearing.textContent = "сейф ≤ " + this.unlockM + " м";

      const inRange = this.distance <= this.unlockM;
      this.elOpenSafe.hidden = !(inRange || this.chestReady) || this.chestOpened || this.unlocked;

      if (this.unlocked) this.elStatus.textContent = "ПОДСКАЗКА ОТКРЫТА";
      else if (this.chestOpened) this.elStatus.textContent = "СВИТОК!";
      else if (this.chestReady || inRange) {
        const t = this.safeType;
        if (t === "year") this.elStatus.textContent = "ПРОКРУТИТЕ ГОД";
        else if (t === "code") this.elStatus.textContent = "ВВЕДИТЕ КОД";
        else if (t === "dial") this.elStatus.textContent = "НАБЕРИТЕ ШИФР";
        else if (this._spinReady) this.elStatus.textContent = "НАЖМИТЕ «ОТКРЫТЬ»";
        else this.elStatus.textContent = "КРУТИТЕ РУЧКУ СЕЙФА";
      } else if (this.distance <= this.revealM) {
        const t = 1 - this.distance / this.revealM;
        this.elStatus.textContent =
          t > 0.7 ? "КРАСНЫЙ СВЕТ СИЛЬНЫЙ" : t > 0.35 ? "СВЕТ УСИЛИВАЕТСЯ" : "СЛАБОЕ МЕРЦАНИЕ";
      } else this.elStatus.textContent = "СЛИШКОМ ДАЛЕКО";
    }

    _maybeShowChest() {
      if (this.unlocked || this.chestOpened) return;
      if (this.distance == null || this.distance > this.unlockM) return;
      if (this.chestReady) {
        this._refreshHud();
        return;
      }
      this.chestReady = true;
      this._spinAccum = 0;
      this._spinAngle = 0;
      this._spinReady = false;
      if (this.elHandleSpin) this.elHandleSpin.style.transform = "rotate(0deg)";
      if (this.elProgressFg) {
        const circ = 2 * Math.PI * 46;
        this.elProgressFg.style.strokeDashoffset = String(circ);
      }
      const t = this.safeType;
      if (t === "wheel") {
        if (this.elUnlockBtn) this.elUnlockBtn.hidden = true;
        if (this.elTapHint) this.elTapHint.textContent = "Крутите ручку пальцем · 3 оборота";
      } else if (t === "year") {
        if (this.elUnlockBtn) this.elUnlockBtn.hidden = false;
        if (this.elTapHint) this.elTapHint.textContent = this.safePrompt || "Прокрутите год на барабанах";
      } else if (t === "code") {
        if (this.elTapHint) this.elTapHint.textContent = this.safePrompt || "Введите код";
      } else if (t === "dial") {
        if (this.elUnlockBtn) this.elUnlockBtn.hidden = true;
        if (this.elTapHint) this.elTapHint.textContent = this.safePrompt || "Крутите диск · 3 числа";
      }
      if (this.elSafeStage) this.elSafeStage.style.display = "";
      this.elLoot.classList.add("show");
      this.elLoot.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        this.elSafeStage.classList.add("rise", "glowing");
      });
      this._refreshHud();
    }

    _forceShowSafeAndFocus() {
      if (this.unlocked) return;
      if (this.distance == null || this.distance > this.unlockM) {
        if (this.demo) {
          this.demoDist = Math.min(this.demoDist, this.unlockM - 1);
          this._updateMetrics();
        } else {
          this.elStatus.textContent = "ПОДОЙДИТЕ БЛИЖЕ (≤ " + this.unlockM + " м)";
          return;
        }
      }
      this._maybeShowChest();
    }

    _bindHandleSpin() {
      const el = this.elHandleSpin;
      const pivot = this.elSafe.querySelector("#safe-handle-pivot") || el;
      if (!el) return;
      const angleAt = (ev) => {
        const rect = pivot.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const pt = ev.touches ? ev.touches[0] : ev;
        return (Math.atan2(pt.clientY - cy, pt.clientX - cx) * 180) / Math.PI;
      };
      const onStart = (ev) => {
        if (this._spinReady || this.chestOpened) return;
        ev.preventDefault();
        this._spinDragging = true;
        this._spinLastAng = angleAt(ev);
        try {
          pivot.setPointerCapture(ev.pointerId);
        } catch (_) {}
      };
      const onMove = (ev) => {
        if (!this._spinDragging || this._spinReady) return;
        ev.preventDefault();
        const ang = angleAt(ev);
        let d = ang - this._spinLastAng;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        this._spinLastAng = ang;
        this._spinAngle += d;
        this._spinAccum += Math.abs(d);
        // только rotate вокруг центра PNG (ступица уже в центре файла)
        el.style.transform = `rotate(${this._spinAngle}deg)`;
        const need = this._spinTurnsNeeded * 360;
        const t = Math.min(1, this._spinAccum / need);
        const circ = 2 * Math.PI * 46;
        if (this.elProgressFg) this.elProgressFg.style.strokeDashoffset = String(circ * (1 - t));
        const turns = Math.min(3, Math.floor(this._spinAccum / 360));
        if (this.elTapHint) {
          this.elTapHint.textContent =
            t < 1 ? `Крутите ручку · ${turns}/3` : "Готово — откройте сейф";
        }
        if (t >= 1) {
          this._spinReady = true;
          this._spinDragging = false;
          if (this.elUnlockBtn) this.elUnlockBtn.hidden = false;
          this.elSafeStage.classList.add("glowing");
          this.elStatus.textContent = "НАЖМИТЕ «ОТКРЫТЬ»";
        }
      };
      const onEnd = () => {
        this._spinDragging = false;
        this._spinLastAng = null;
      };
      pivot.addEventListener("pointerdown", onStart, { passive: false });
      window.addEventListener("pointermove", (this._onSpinMove = onMove), { passive: false });
      window.addEventListener("pointerup", (this._onSpinEnd = onEnd));
      window.addEventListener("pointercancel", this._onSpinEnd);
      pivot.style.touchAction = "none";
      el.style.transform = "rotate(0deg)";
    }

    _revealScroll() {
      if (this.chestOpened) return;
      this.chestOpened = true;
      if (this.elUnlockBtn) this.elUnlockBtn.hidden = true;
      this.elOpenSafe.hidden = true;
      this.elSafe.classList.add("vanishing");
      this.elStatus.textContent = "СВИТОК!";
      setTimeout(() => {
        this.elSafeStage.style.display = "none";
        this._spawnScroll();
      }, 450);
    }

    _tryUnlockSafe() {
      const type = this.safeType;
      if (type === "wheel") {
        if (!this._spinReady) return;
        this._revealScroll();
        return;
      }
      if (type === "year") {
        const got = [0, 1, 2, 3].map((i) => String(this._yearDigits[i])).join("");
        if (got === this.safeCode) this._revealScroll();
        else {
          this.elStatus.textContent = "НЕВЕРНЫЙ ГОД";
          if (this.elTapHint) this.elTapHint.textContent = "Не то — крутите барабаны";
        }
        return;
      }
      if (type === "code") {
        if (this._codeBuffer === this.safeCode) this._revealScroll();
        else {
          this.elStatus.textContent = "НЕВЕРНЫЙ КОД";
          this._codeBuffer = "";
          const disp = this.root.querySelector("#code-display");
          if (disp) disp.textContent = "****";
        }
        return;
      }
      if (type === "dial") {
        const got = this._dialMarks.join("-");
        if (got === this.safeCode) this._revealScroll();
        else {
          this.elStatus.textContent = "НЕВЕРНЫЙ ШИФР";
          if (this.elTapHint) this.elTapHint.textContent = "Сбросьте и наберите снова: " + this.safeCode;
        }
      }
    }

    _openSafe() {
      this._tryUnlockSafe();
    }

    _bindYearDrums() {
      this._yearDigits = [0, 0, 0, 0];
      const cellH = 44;
      const midStart = 10; // средняя копия 0..9
      this.root.querySelectorAll(".year-drum").forEach((drum) => {
        const i = Number(drum.dataset.i);
        const track = drum.querySelector(".year-track");
        if (!track) return;
        // стартуем на «0» средней копии
        drum.scrollTop = midStart * cellH;
        this._yearDigits[i] = 0;
        let snapTimer = null;
        const readDigit = () => {
          const idx = Math.round(drum.scrollTop / cellH);
          this._yearDigits[i] = ((idx % 10) + 10) % 10;
        };
        const snap = () => {
          const idx = Math.round(drum.scrollTop / cellH);
          const target = idx * cellH;
          drum.scrollTo({ top: target, behavior: "smooth" });
          // держим скролл в средней копии
          const wrapped = midStart + (idx % 10);
          if (idx < 5 || idx > 24) {
            requestAnimationFrame(() => {
              drum.scrollTop = wrapped * cellH;
            });
          }
          readDigit();
        };
        drum.addEventListener(
          "scroll",
          () => {
            readDigit();
            clearTimeout(snapTimer);
            snapTimer = setTimeout(snap, 80);
          },
          { passive: true }
        );
      });
    }

    _bindCodePad() {
      this._codeBuffer = "";
      const disp = this.root.querySelector("#code-display");
      this.root.querySelectorAll(".code-key").forEach((btn) => {
        btn.onclick = () => {
          const k = btn.dataset.k;
          if (k === "C") {
            this._codeBuffer = "";
            if (disp) disp.textContent = "****";
            return;
          }
          if (k === "OK") {
            this._tryUnlockSafe();
            return;
          }
          if (this._codeBuffer.length >= 8) return;
          this._codeBuffer += k;
          if (disp) disp.textContent = this._codeBuffer.replace(/./g, "•");
        };
      });
    }

    _bindDial() {
      this._dialAngle = 0;
      this._dialMarks = [];
      const ring = this.root.querySelector("#dial-ring");
      const knob = this.root.querySelector("#dial-knob");
      const numEl = this.root.querySelector("#dial-num");
      const marksEl = this.root.querySelector("#dial-marks");
      const paint = () => {
        // 0..39 like classic dial
        const n = Math.round(norm360(this._dialAngle) / 9) % 40;
        if (numEl) numEl.textContent = String(n);
        if (knob) knob.style.transform = `translate(-50%,-50%) rotate(${this._dialAngle}deg)`;
        if (marksEl) marksEl.textContent = this._dialMarks.length ? this._dialMarks.join("-") : "—";
        if (this.elUnlockBtn) this.elUnlockBtn.hidden = this._dialMarks.length < 3;
      };
      paint();
      let dragging = false;
      let last = null;
      const angAt = (ev) => {
        const rect = ring.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const pt = ev.touches ? ev.touches[0] : ev;
        return (Math.atan2(pt.clientY - cy, pt.clientX - cx) * 180) / Math.PI;
      };
      ring.addEventListener(
        "pointerdown",
        (ev) => {
          dragging = true;
          last = angAt(ev);
          try {
            ring.setPointerCapture(ev.pointerId);
          } catch (_) {}
          ev.preventDefault();
        },
        { passive: false }
      );
      ring.addEventListener(
        "pointermove",
        (ev) => {
          if (!dragging) return;
          const a = angAt(ev);
          let d = a - last;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          last = a;
          this._dialAngle += d;
          paint();
          ev.preventDefault();
        },
        { passive: false }
      );
      const end = () => {
        dragging = false;
        last = null;
      };
      ring.addEventListener("pointerup", end);
      ring.addEventListener("pointercancel", end);
      this.root.querySelector("#dial-mark").onclick = () => {
        if (this._dialMarks.length >= 3) return;
        const n = Math.round(norm360(this._dialAngle) / 9) % 40;
        this._dialMarks.push(n);
        paint();
        if (this._dialMarks.length >= 3) this.elStatus.textContent = "ШИФР НАБРАН — ОТКРОЙТЕ";
      };
      this.root.querySelector("#dial-reset").onclick = () => {
        this._dialMarks = [];
        paint();
      };
    }

    _spawnScroll() {
      if (this.scrollReady) return;
      this.scrollReady = true;
      this.elScrollFly.hidden = false;
      requestAnimationFrame(() => this.elScrollFly.classList.add("fly"));
    }

    _openScroll() {
      if (this.scrollOpened) return;
      this.scrollOpened = true;
      this.elScrollFly.classList.add("hide");
      this.elScrollHint.textContent = this.hintText;
      this.elScrollSheet.hidden = false;
      requestAnimationFrame(() => this.elScrollSheet.classList.add("unfurl"));
      this.elStatus.textContent = "ЧИТАЙТЕ ПОДСКАЗКУ";
    }

    _setUnlockedAndLeave() {
      if (this.unlocked) return;
      this.unlocked = true;
      this.root.classList.add("unlocked", "leaving");
      this.onUnlock();
      setTimeout(() => this.close(), 700);
    }

    _tick = () => {
      if (!this.running) return;
      if (this.demo) {
        this.distance = this.demoDist;
        this._bearingToTarget = this.demoAngle;
      }
      this._updateCrystal();
      this.raf = requestAnimationFrame(this._tick);
    };

    _updateCrystal() {
      const el = this.elCrystal;
      const glow = this.elCrystalGlow;
      if (!el || !glow) return;

      // кристалл всегда чёткий и видимый; пульсирует только красный свет
      el.classList.add("active");
      const dist = this.distance;
      const inRange = dist != null && dist <= this.revealM;

      if (!inRange) {
        el.style.setProperty("--glow-alpha", "0");
        el.style.setProperty("--glow-size", "0.6");
        el.classList.remove("hot", "near");
        this._crystalOn = false;
        return;
      }

      this._crystalOn = true;
      const t = Math.max(0, Math.min(1, 1 - dist / this.revealM));
      // период: ~2.6с далеко → ~0.2с вплотную
      const period = 2.6 - t * 2.4;
      this._crystalPhase += (0.016 * Math.PI * 2) / Math.max(0.18, period);
      const wave = (Math.sin(this._crystalPhase) + 1) / 2;
      // тускло/редко далеко, ярко/часто близко — только glow
      const alpha = (0.08 + t * 0.92) * (0.15 + wave * 0.85);
      const size = 0.7 + t * 0.9 + wave * (0.05 + t * 0.15);
      el.style.setProperty("--glow-alpha", String(alpha.toFixed(3)));
      el.style.setProperty("--glow-size", String(size.toFixed(3)));
      el.classList.toggle("hot", t > 0.72);
      el.classList.toggle("near", this.chestReady || dist <= this.unlockM);
    }

    _draw() {
      /* radar canvas removed */
    }

    close() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
      if (this.orientHandler) {
        window.removeEventListener("deviceorientationabsolute", this.orientHandler, true);
        window.removeEventListener("deviceorientation", this.orientHandler, true);
      }
      if (this._onSpinMove) window.removeEventListener("pointermove", this._onSpinMove);
      if (this._onSpinEnd) {
        window.removeEventListener("pointerup", this._onSpinEnd);
        window.removeEventListener("pointercancel", this._onSpinEnd);
      }
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      this.root.remove();
      this.onClose();
    }
  }

  window.KP_Radar = Radar;
  window.KP_geo = { haversineM, bearingDeg, REVEAL_M };
})();
