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
              <div class="radar-title">GEO RADAR</div>
              <div class="radar-status" id="radar-status">СКАНИРОВАНИЕ…</div>
            </div>
            <div class="radar-hud-right">
              <div class="radar-readout" id="radar-dist">— м</div>
              <div class="radar-readout sub" id="radar-bearing">азимут —°</div>
            </div>
          </div>
          <button type="button" class="btn primary radar-hud-open" id="radar-open-safe" hidden>Открыть сейф</button>
          <div class="radar-scope-wrap">
            <div class="radar-you-marker" aria-hidden="true">▲</div>
            <div class="radar-compass-disk" id="radar-compass-disk">
              <canvas class="radar-canvas" id="radar-canvas"></canvas>
            </div>
            <div class="radar-glass"></div>
            <div class="radar-vignette"></div>
          </div>
          <div class="radar-legend">
            <span>кольца · ${Math.round(this.revealM / 4)} / ${Math.round(this.revealM / 2)} / ${Math.round((3 * this.revealM) / 4)} / ${this.revealM} м</span>
            <span>компас · верх экрана = куда смотрите · сейф ≤ ${this.unlockM} м</span>
          </div>
          <div class="radar-actions">
            <button type="button" class="btn primary" id="radar-demo-near">Симуляция: подойти ближе</button>
            <button type="button" class="btn ghost" id="radar-demo-turn">Симуляция: повернуть +45°</button>
            <button type="button" class="btn ghost" id="radar-close">Закрыть</button>
          </div>
        </div>

        <div class="compass-cal" id="compass-cal">
          <div class="compass-cal-card">
            <p class="compass-cal-title">Калибровка компаса</p>
            <p class="compass-cal-text">Поводите телефоном «восьмёркой», держите экран вверх. Диск должен крутиться при повороте.</p>
            <div class="compass-cal-readout" id="compass-cal-deg">курс —°</div>
            <button type="button" class="btn primary" id="compass-cal-done">Готово · смотреть радар</button>
            <button type="button" class="btn ghost" id="compass-cal-skip">Пропустить</button>
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
      this.canvas = root.querySelector("#radar-canvas");
      this.elDisk = root.querySelector("#radar-compass-disk");
      this.ctx = this.canvas.getContext("2d");
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
      this.elDemoTurn = root.querySelector("#radar-demo-turn");
      this.elCal = root.querySelector("#compass-cal");
      this.elCalDeg = root.querySelector("#compass-cal-deg");

      this._spinTurnsNeeded = 3;
      this._spinAccum = 0;
      this._spinAngle = 0;
      this._spinReady = false;
      this._spinDragging = false;
      this._spinLastAng = null;
      this._codeBuffer = "";
      this._dialAngle = 0;
      this._dialMarks = [];
      this._calDone = !this.needsCalibration;

      this._mountSafePanel();

      root.querySelector("#radar-close").onclick = () => this.close();
      root.querySelector("#compass-cal-done").onclick = () => this._finishCalibration();
      root.querySelector("#compass-cal-skip").onclick = () => this._finishCalibration();
      this.elDemoNear.onclick = () => {
        this.demo = true;
        if (this.demoDist == null) this.demoDist = Math.max(this.revealM + 20, 320);
        const cur = this.distance != null ? this.distance : this.demoDist;
        this.demoDist = Math.max(5, Math.min(this.demoDist, cur) - 55);
        this.demoAngle = this.demoAngle ?? 40;
        this._updateMetrics();
      };
      this.elDemoTurn.onclick = () => {
        this.heading = norm360(this.heading + 45);
        this.hasHeading = true;
        this.liveCompass = true;
        this._applyCompassRotate();
        this._updateMetrics();
      };
      this.elOpenSafe.onclick = () => this._forceShowSafeAndFocus();
      this.elScrollFly.onclick = () => this._openScroll();
      root.querySelector("#scroll-done").onclick = () => this._setUnlockedAndLeave();

      this._resize();
      window.addEventListener("resize", (this._onResize = () => this._resize()));
      if (!this._calDone) this.elCal.classList.add("show");
      else this.elCal.hidden = true;
    }

    _finishCalibration() {
      this._calDone = true;
      this.elCal.classList.remove("show");
      this.elCal.hidden = true;
      this.elStatus.textContent = this.liveCompass ? "КОМПАС ОК" : "СКАНИРОВАНИЕ…";
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
        // wheel — медный сейф анфас
        html = `
          <div class="safe-variant safe-wheel">
            <div class="safe-photo-stack" style="aspect-ratio:560/709">
              <img class="safe-img safe-img-body" src="assets/ui/safe-wheel-body.png" alt="Сейф" draggable="false" />
              <svg class="safe-progress" id="safe-progress" viewBox="0 0 100 100" aria-hidden="true"
                style="left:51.607%;top:46.121%;width:48%">
                <circle class="safe-progress-bg" cx="50" cy="50" r="46" />
                <circle class="safe-progress-fg" id="safe-progress-fg" cx="50" cy="50" r="46" />
              </svg>
              <img class="safe-handle-spin" id="safe-handle-spin" src="assets/ui/safe-wheel-handle.png" alt=""
                draggable="false" style="left:51.607%;top:46.121%;width:43.9%" />
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
      const wrap = this.root.querySelector(".radar-scope-wrap");
      const size = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight, 520));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.size = size;
      this.canvas.style.width = size + "px";
      this.canvas.style.height = size + "px";
      this.canvas.width = Math.floor(size * dpr);
      this.canvas.height = Math.floor(size * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    async start() {
      this.running = true;
      try {
        await this._requestOrientation();
      } catch (_) {
        /* north-up ok */
      }

      if (this.demo) {
        this.demoDist = Math.max(this.revealM + 40, 340);
        this.demoAngle = 40;
        this._updateMetrics();
        this._tick();
        return;
      }

      if (!navigator.geolocation) {
        this.elStatus.textContent = "ГЕО НЕДОСТУПНО — демо";
        this.demo = true;
        this.demoDist = Math.max(this.revealM - 20, 260);
        this._updateMetrics();
        this._tick();
        return;
      }

      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.userLat = pos.coords.latitude;
          this.userLon = pos.coords.longitude;
          // GPS course as soft fallback when compass silent
          if (!this.hasHeading && typeof pos.coords.heading === "number" && !Number.isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
            this.heading = pos.coords.heading;
            this.hasHeading = true;
          }
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
      this.orientHandler = (e) => {
        let h = null;
        if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
          h = e.webkitCompassHeading;
        } else if (e.absolute === true && typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
          h = norm360(360 - e.alpha);
          const so =
            (screen.orientation && typeof screen.orientation.angle === "number"
              ? screen.orientation.angle
              : typeof window.orientation === "number"
                ? window.orientation
                : 0) || 0;
          h = norm360(h + so);
        } else if (typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
          // относительный режим: крутится при повороте даже без абсолютного севера
          if (this._alpha0 == null) this._alpha0 = e.alpha;
          h = norm360(this._alpha0 - e.alpha);
        }
        if (h == null) return;

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
      // диск компаса крутится против курса — N/E/S/W и точка едут вместе
      if (this.elDisk) {
        const h = this.hasHeading ? this.heading : 0;
        this.elDisk.style.transform = `rotate(${-h}deg)`;
      }
      if (this.demo) {
        this.distance = this.demoDist;
        this._bearingToTarget = this.demoAngle;
        this._relativeBearing = this.hasHeading ? norm360(this.demoAngle - this.heading) : this.demoAngle;
      } else if (this._bearingToTarget != null) {
        this._relativeBearing = this.hasHeading
          ? norm360(this._bearingToTarget - this.heading)
          : this._bearingToTarget;
      }
      this._refreshHud();
    }

    _updateMetrics() {
      if (this.demo) {
        this.distance = this.demoDist;
        const bearing = this.demoAngle;
        this._bearingToTarget = bearing;
        this._relativeBearing = this.hasHeading ? norm360(bearing - this.heading) : bearing;
        this._applyCompassRotate();
        this._refreshHud();
        this._maybeShowChest();
        return;
      }
      if (this.userLat == null) return;
      this.distance = haversineM(this.userLat, this.userLon, this.targetLat, this.targetLon);
      const bearing = bearingDeg(this.userLat, this.userLon, this.targetLat, this.targetLon);
      this._bearingToTarget = bearing;
      this._relativeBearing = this.hasHeading ? norm360(bearing - this.heading) : bearing;
      this._applyCompassRotate();
      this._refreshHud();
      this._maybeShowChest();
    }

    _refreshHud() {
      if (this.distance == null) {
        this.elDist.textContent = "— м";
        this.elStatus.textContent = this.demo ? "ДЕМО · ЖДИТЕ КОМПАС…" : "ОЖИДАНИЕ GPS…";
        return;
      }
      this.elDist.textContent = Math.round(this.distance) + " м";
      const mode = this.liveCompass
        ? "компас · взгляд↑"
        : this.hasHeading
          ? "курс · взгляд↑"
          : "север↑";
      this.elBearing.textContent =
        "азимут " +
        Math.round(this._bearingToTarget || 0) +
        "° · отн. " +
        Math.round(this._relativeBearing || 0) +
        "° · " +
        mode;

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
      } else if (this.distance <= this.revealM) this.elStatus.textContent = "КОНТАКТ";
      else this.elStatus.textContent = this.liveCompass ? "ВНЕ РАДИУСА · КОМПАС ОК" : "ВНЕ РАДИУСА СКАНИРОВАНИЯ";
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
      if (this.elHandleSpin) this.elHandleSpin.style.transform = "translate(-50%, -50%) rotate(0deg)";
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
      if (!el) return;
      const angleAt = (ev) => {
        const rect = el.getBoundingClientRect();
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
          el.setPointerCapture(ev.pointerId);
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
        el.style.transform = `translate(-50%, -50%) rotate(${this._spinAngle}deg)`;
        const need = this._spinTurnsNeeded * 360;
        const t = Math.min(1, this._spinAccum / need);
        const circ = 2 * Math.PI * 46;
        this.elProgressFg.style.strokeDashoffset = String(circ * (1 - t));
        const turns = Math.min(3, Math.floor(this._spinAccum / 360));
        this.elTapHint.textContent =
          t < 1 ? `Крутите ручку · ${turns}/3` : "Готово — откройте сейф";
        if (t >= 1) {
          this._spinReady = true;
          this._spinDragging = false;
          this.elUnlockBtn.hidden = false;
          this.elSafeStage.classList.add("glowing");
          this.elStatus.textContent = "НАЖМИТЕ «ОТКРЫТЬ»";
        }
      };
      const onEnd = () => {
        this._spinDragging = false;
        this._spinLastAng = null;
      };
      el.addEventListener("pointerdown", onStart, { passive: false });
      window.addEventListener(
        "pointermove",
        (this._onSpinMove = onMove),
        { passive: false }
      );
      window.addEventListener("pointerup", (this._onSpinEnd = onEnd));
      window.addEventListener("pointercancel", this._onSpinEnd);
      el.style.touchAction = "none";
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
        this._relativeBearing = this.hasHeading
          ? norm360(this.demoAngle - this.heading)
          : this.demoAngle;
      } else if (this.userLat != null && this._bearingToTarget != null) {
        this._relativeBearing = this.hasHeading
          ? norm360(this._bearingToTarget - this.heading)
          : this._bearingToTarget;
      }
      if (this.elDisk) {
        const h = this.hasHeading ? this.heading : 0;
        this.elDisk.style.transform = `rotate(${-h}deg)`;
      }
      this.sweep = (this.sweep + 2.2) % 360;
      this._pulsePhase += 0.05;
      this._draw();
      this.raf = requestAnimationFrame(this._tick);
    };

    _draw() {
      const ctx = this.ctx;
      const S = this.size;
      if (!S) return;
      const cx = S / 2;
      const cy = S / 2;
      const R = S * 0.42;
      const headingUp = this.hasHeading;
      // Север↑ на холсте; CSS крутит диск — как компас
      const mapRot = 0;
      const bearingForBlip = this._bearingToTarget != null ? this._bearingToTarget : 0;

      ctx.clearRect(0, 0, S, S);

      const plate = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
      plate.addColorStop(0, "#0a1a12");
      plate.addColorStop(0.55, "#06140d");
      plate.addColorStop(1, "#020805");
      ctx.fillStyle = plate;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
      ctx.fill();

      const face = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.2, R * 0.05, cx, cy, R);
      face.addColorStop(0, "#0f3a24");
      face.addColorStop(0.45, "#0a2818");
      face.addColorStop(1, "#04140c");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = face;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(80,220,140,${0.015 + Math.random() * 0.02})`;
        ctx.fillRect(cx - R + Math.random() * R * 2, cy - R + Math.random() * R * 2, 1.5, 1.5);
      }

      const rings = [0.25, 0.5, 0.75, 1];
      rings.forEach((t, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * t, 0, Math.PI * 2);
        ctx.strokeStyle = i === rings.length - 1 ? "rgba(90,255,160,0.55)" : "rgba(60,200,120,0.28)";
        ctx.lineWidth = i === rings.length - 1 ? 2 : 1;
        ctx.stroke();
      });

      ctx.strokeStyle = "rgba(70,210,130,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();

      // ticks + cardinals (вращаются с компасом в heading-up)
      for (let a = 0; a < 360; a += 10) {
        const screenA = norm360(a - mapRot);
        const rad = toRad(screenA - 90);
        const major = a % 30 === 0;
        const r0 = R * (major ? 0.9 : 0.94);
        const r1 = R * 0.99;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0);
        ctx.lineTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
        ctx.strokeStyle = major ? "rgba(120,255,170,0.55)" : "rgba(80,200,130,0.3)";
        ctx.lineWidth = major ? 2 : 1;
        ctx.stroke();
        if (a % 90 === 0) {
          const label = a === 0 ? "N" : a === 90 ? "E" : a === 180 ? "S" : "W";
          const lx = cx + Math.cos(rad) * R * 0.78;
          const ly = cy + Math.sin(rad) * R * 0.78;
          ctx.fillStyle = a === 0 ? "rgba(255,220,120,0.95)" : "rgba(150,255,190,0.75)";
          ctx.font = `600 ${Math.max(10, S * 0.035)}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, lx, ly);
        }
      }

      // маркер «взгляд» рисуется HTML поверх диска (не крутится)
      void headingUp;

      ctx.fillStyle = "rgba(100,220,150,0.55)";
      ctx.font = `${Math.max(9, S * 0.028)}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      [0.25, 0.5, 0.75, 1].forEach((t) => {
        const m = Math.round(this.revealM * t);
        ctx.fillText(m + "m", cx + 4, cy - R * t + 3);
      });

      const sweepRad = toRad(this.sweep - 90);
      for (let i = 0; i < 28; i++) {
        const a0 = sweepRad - toRad(i * 1.1);
        const a1 = sweepRad - toRad(i * 1.1 + 1.2);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a1, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(80,255,140,${0.18 * (1 - i / 28)})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepRad) * R, cy + Math.sin(sweepRad) * R);
      ctx.strokeStyle = "rgba(180,255,200,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // вы — центр
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#9dffc0";
      ctx.fill();
      ctx.strokeStyle = "rgba(180,255,210,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.stroke();

      // цель по абсолютному азимуту (диск CSS крутится с компасом)
      if (this.distance != null && this.distance <= this.revealM) {
        const distClamped = Math.max(0, this.distance);
        const t = Math.min(1, distClamped / this.revealM);
        const br = toRad(bearingForBlip - 90);
        const bx = cx + Math.cos(br) * R * t;
        const by = cy + Math.sin(br) * R * t;

        const period = 0.25 + t * 0.95;
        const pulse = (Math.sin((this._pulsePhase * Math.PI * 2) / period) + 1) / 2;
        const glowR = 6 + (1 - t) * 10 + pulse * 8;

        ctx.beginPath();
        ctx.arc(bx, by, glowR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,40,60,${0.12 + pulse * 0.2})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx, by, 5 + pulse * 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ff2a3c";
        ctx.shadowColor = "#ff4455";
        ctx.shadowBlur = 12 + pulse * 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = `rgba(255,180,180,${0.5 + pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by);
        ctx.lineTo(bx + 10, by);
        ctx.moveTo(bx, by - 10);
        ctx.lineTo(bx, by + 10);
        ctx.stroke();

        const sweepDiff = Math.abs(((this.sweep - bearingForBlip + 540) % 360) - 180);
        if (sweepDiff < 4) this.blips.push({ x: bx, y: by, life: 1 });
      }

      this.blips = this.blips.filter((b) => b.life > 0.02);
      this.blips.forEach((b) => {
        b.life *= 0.96;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,60,80,${b.life * 0.55})`;
        ctx.fill();
      });

      ctx.fillStyle = "rgba(0,0,0,0.08)";
      for (let y = cy - R; y < cy + R; y += 3) {
        ctx.fillRect(cx - R, y, R * 2, 1);
      }

      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, R + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(40,90,60,0.9)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(180,150,90,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
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
      window.removeEventListener("resize", this._onResize);
      this.root.remove();
      this.onClose();
    }
  }

  window.KP_Radar = Radar;
  window.KP_geo = { haversineM, bearingDeg, REVEAL_M };
})();
