/** Тестовый хаб мини-игр. Ядро общее, оболочка временная. */
(() => {
  const PHOTO = "assets/contours/pushkin-photo.jpg";
  const PHOTO_B = "assets/contours/griboedov-photo.jpg";
  const STICKERS = [
    ["assets/contours/pushkin-sticker-preview.png", "pushkin"],
    ["assets/contours/pushkin-side-sticker-preview.png", "side"],
    ["assets/contours/gogol-sticker-preview.png", "gogol"],
    ["assets/contours/griboedov-sticker-preview.png", "griboedov"],
  ];

  const CATALOG = [
    [1, "easy", "Пазл 3×3", "Собери бронзу Пушкина по кускам.", "puzzle"],
    [2, "easy", "Пятнашки", "Сдвинь плитки в порядок. Пустая клетка — сосед.", "slide"],
    [3, "easy", "Собери ряд", "Поменяй два соседних символа, чтобы вышло три в ряд.", "match3"],
    [4, "easy", "Найди отличия", "На правом кадре четыре метки. Нажми их.", "diff"],
    [5, "easy", "Memory", "Открой пары: имя и факт.", "memory"],
    [6, "easy", "Порядок кадров", "Расставь годы по возрастанию.", "order"],
    [7, "easy", "Слово из букв", "Собери слово с таблички у дуба.", "anagram"],
    [8, "easy", "Цифровой замок", "Год открытия памятника на Пушкинской.", "lock"],
    [9, "easy", "Соедини пары", "Имя слева — факт справа.", "pairs"],
    [10, "easy", "Выбери лишнее", "Что не про Пушкина в Москве.", "odd"],
    [11, "easy", "Тень-силуэт", "Какой контур — стоящий Пушкин анфас.", "sil"],
    [12, "easy", "Собери цитату", "Строки «Я памятник…» по порядку.", "quote"],
    [13, "easy", "Лабиринт", "Дойди от зелёного до золотого.", "maze"],
    [14, "easy", "Угадай год", "Поставь год открытия памятника (±2).", "year"],
    [15, "easy", "Найди деталь", "На фото три детали. Нажми их.", "spot"],
    [16, "med", "Пазл фигурный", "Поставь 6 кусков на места.", "jigsaw"],
    [17, "med", "Ряд с падением", "Собери три — верхние упадут.", "cascade"],
    [18, "med", "Много отличий", "Восемь меток на кадре.", "diff8"],
    [19, "med", "Кроссворд", "Впиши слово ДУБ и ГОД.", "cross"],
    [20, "med", "Судоку 4×4", "В каждой строке и столбце 1–4.", "sudoku"],
    [21, "med", "Нонограм", "Закрась клетки по числам слева и сверху.", "nonogram"],
    [22, "med", "Цепь", "Поверни звенья, чтобы путь шёл слева направо.", "pipes"],
    [23, "med", "Герб", "Собери щит: лира, дуб, перо.", "crest"],
    [24, "med", "Таймлайн", "Поставь события в хронологию.", "timeline"],
    [25, "med", "Шифр Цезаря", "Сдвинь алфавит и прочитай слово.", "caesar"],
    [26, "med", "Карта маршрута", "Отметь точки в порядке прогулки.", "route"],
    [27, "med", "Полки", "Разложи карточки по двум полкам.", "bins"],
    [28, "med", "Ребус", "Картинки складываются в одно слово.", "rebus"],
    [29, "med", "Портрет", "Подкрути слои к эталону.", "portrait"],
    [30, "med", "Ритм стиха", "Нажми в такт пять раз.", "rhythm"],
    [31, "hard", "AR-контур", "Наведи камеру на силуэт или засчитай тест.", "ar"],
    [32, "hard", "Физический пазл", "Перетащи три обрывка в конверт.", "physics"],
    [33, "hard", "Платформер", "Дойди до печати. Стрелки или тап.", "platform"],
    [34, "hard", "Найди предметы", "Восемь предметов на сцене.", "hidden"],
    [35, "hard", "Нарисуй контур", "Обведи силуэт пальцем.", "draw"],
    [36, "hard", "Строфа вслух", "Скажи или впиши строку.", "voice"],
    [37, "hard", "Кабинет", "Две комнаты, ключ и письмо.", "escape"],
    [38, "hard", "Общий лист", "Три роли сдают свою строку.", "coopboard"],
    [39, "hard", "Постамент 3D", "Поверни куб и найди грань «лира».", "orbit"],
    [40, "hard", "Фото-охота", "Отметь, что ты у дуба (прототип без нейросети).", "photohunt"],
    [41, "hard", "Один ход", "Поставь ладью, чтобы закрыть короля.", "chess"],
    [42, "hard", "Переулок", "Случайный лабиринт на сегодня.", "genmaze"],
    [43, "hard", "Диалог", "Выбери реплику, которая ведёт к бронзе.", "branch"],
    [44, "hard", "Эстафета GPS", "Отметь три точки эстафеты.", "relay"],
    [45, "hard", "Письмо класса", "Собери три куска на одном листе.", "letter"],
  ];

  const TIERS = {
    easy: { title: "Лёгкие", label: "Простые в создании", hint: "15 игр · ядро grid / hotspot / cards" },
    med: { title: "Средние", label: "Нужен арт и правила", hint: "15 игр · пазлы, шифры, ритм" },
    hard: { title: "Сложные", label: "Камера, физика, 3D", hint: "15 игр · прототипы для теста" },
  };

  const app = document.getElementById("games-app");
  let view = "hub";
  let tier = null;
  let game = null;
  const done = new Set(JSON.parse(localStorage.getItem("kp.games.done") || "[]"));

  function markDone(id) {
    done.add(id);
    localStorage.setItem("kp.games.done", JSON.stringify([...done]));
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shell(title, brief, stageHtml) {
    return `<div class="games-top">
        <button type="button" class="btn ghost games-back" id="back">Назад</button>
        <h2>${esc(title)}</h2>
      </div>
      <p class="game-play-brief">${esc(brief)}</p>
      <div class="game-stage" id="stage">${stageHtml}</div>
      <div class="game-hud" id="hud"></div>
      <div id="banner"></div>`;
  }

  function bindBack() {
    document.getElementById("back").onclick = () => {
      stopLoops();
      view = "list";
      render();
    };
  }

  function setHud(text) {
    const h = document.getElementById("hud");
    if (h) h.textContent = text;
  }

  function celebrate() {
    markDone(game.id);
    const b = document.getElementById("banner");
    if (b) b.innerHTML = `<div class="game-win-banner">Засчитано · ${esc(game.name)}</div>`;
  }

  let loopTimer = 0;
  function stopLoops() {
    if (loopTimer) cancelAnimationFrame(loopTimer);
    loopTimer = 0;
  }

  function render() {
    stopLoops();
    if (view === "hub") return renderHub();
    if (view === "list") return renderList();
    renderPlay();
  }

  function renderHub() {
    const counts = { easy: 0, med: 0, hard: 0 };
    CATALOG.forEach((g) => {
      if (done.has(g[0])) counts[g[1]]++;
    });
    app.innerHTML = `<div class="games-top"><a class="btn ghost games-back" href="index.html">На главную</a><h1>Тест игр</h1></div>
      <p class="games-lead">45 мини-игр на фото и фактах маршрута. Оболочка тестовая — сначала проверяем механику.</p>
      <div class="games-tiers">
        ${["easy", "med", "hard"]
          .map(
            (k) => `<button type="button" class="games-tier-card" data-tier="${k}">
              <span class="tier-label">${TIERS[k].label}</span>
              <span class="tier-title">${TIERS[k].title}</span>
              <span class="tier-meta">${counts[k]} из 15 пройдено · ${TIERS[k].hint}</span>
            </button>`
          )
          .join("")}
      </div>`;
    app.querySelectorAll("[data-tier]").forEach((btn) => {
      btn.onclick = () => {
        tier = btn.dataset.tier;
        view = "list";
        render();
      };
    });
  }

  function renderList() {
    const items = CATALOG.filter((g) => g[1] === tier);
    app.innerHTML = `<div class="games-top">
        <button type="button" class="btn ghost games-back" id="back">Назад</button>
        <h2>${TIERS[tier].title}</h2>
      </div>
      <div class="games-list">
        ${items
          .map(
            (g) => `<button type="button" class="games-item ${done.has(g[0]) ? "done" : ""}" data-id="${g[0]}">
            <span class="games-item-num">${g[0]}</span>
            <span class="games-item-body">
              <span class="games-item-name">${esc(g[2])}</span>
              <span class="games-item-hint">${esc(g[3])}</span>
            </span>
          </button>`
          )
          .join("")}
      </div>`;
    document.getElementById("back").onclick = () => {
      view = "hub";
      render();
    };
    app.querySelectorAll("[data-id]").forEach((btn) => {
      btn.onclick = () => {
        const id = Number(btn.dataset.id);
        const row = CATALOG.find((g) => g[0] === id);
        game = { id: row[0], tier: row[1], name: row[2], brief: row[3], kind: row[4] };
        view = "play";
        render();
      };
    });
  }

  const PLAY = {
    puzzle() {
      const n = 3;
      let order = shuffle([...Array(n * n).keys()]);
      if (order.every((v, i) => v === i)) order = shuffle(order);
      let sel = -1;
      const paint = () => {
        const cells = order
          .map((src, i) => {
            const r = Math.floor(src / n);
            const c = src % n;
            return `<button type="button" class="mg-tile ${sel === i ? "sel" : ""}" data-i="${i}" style="background-image:url('${PHOTO}');background-size:${n * 100}% ${n * 100}%;background-position:${(c / (n - 1)) * 100}% ${(r / (n - 1)) * 100}%"></button>`;
          })
          .join("");
        document.getElementById("stage").innerHTML = `<div class="mg-grid" style="grid-template-columns:repeat(${n},1fr)">${cells}</div>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.i);
            if (sel < 0) sel = i;
            else {
              [order[sel], order[i]] = [order[i], order[sel]];
              sel = -1;
              if (order.every((v, idx) => v === idx)) celebrate();
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    slide() {
      const n = 3;
      let tiles = [...Array(n * n - 1).keys(), null];
      // a few random legal shuffles
      const neigh = (i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        return [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ]
          .filter(([y, x]) => y >= 0 && x >= 0 && y < n && x < n)
          .map(([y, x]) => y * n + x);
      };
      for (let k = 0; k < 40; k++) {
        const e = tiles.indexOf(null);
        const opts = neigh(e);
        const j = opts[Math.floor(Math.random() * opts.length)];
        [tiles[e], tiles[j]] = [tiles[j], tiles[e]];
      }
      const paint = () => {
        const cells = tiles
          .map((src, i) => {
            if (src == null) return `<button type="button" class="mg-tile empty" data-i="${i}"></button>`;
            const r = Math.floor(src / n);
            const c = src % n;
            return `<button type="button" class="mg-tile" data-i="${i}" style="background-image:url('${PHOTO}');background-size:${n * 100}% ${n * 100}%;background-position:${(c / (n - 1)) * 100}% ${(r / (n - 1)) * 100}%"></button>`;
          })
          .join("");
        document.getElementById("stage").innerHTML = `<div class="mg-grid" style="grid-template-columns:repeat(${n},1fr)">${cells}</div>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.i);
            const e = tiles.indexOf(null);
            if (!neigh(e).includes(i)) return;
            [tiles[e], tiles[i]] = [tiles[i], tiles[e]];
            paint();
            if (tiles.every((v, idx) => (idx === tiles.length - 1 ? v == null : v === idx))) celebrate();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    match3() {
      const glyphs = ["лира", "дуб", "перо", "кольцо"];
      const cols = 5;
      const rows = 4;
      let board = [];
      for (let i = 0; i < cols * rows; i++) board.push(glyphs[i % glyphs.length]);
      // break accidental lines
      board = shuffle(board);
      let sel = -1;
      const line = () => {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols - 2; c++) {
            const a = board[r * cols + c];
            if (a && a === board[r * cols + c + 1] && a === board[r * cols + c + 2]) return true;
          }
        }
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows - 2; r++) {
            const a = board[r * cols + c];
            if (a && a === board[(r + 1) * cols + c] && a === board[(r + 2) * cols + c]) return true;
          }
        }
        return false;
      };
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-match3" style="grid-template-columns:repeat(${cols},1fr)">${board
          .map((g, i) => `<button type="button" class="mg-m3 ${sel === i ? "sel" : ""}" data-i="${i}">${esc(g)}</button>`)
          .join("")}</div><p class="mg-note">Тап по двум соседним клеткам</p>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.i);
            if (sel < 0) sel = i;
            else {
              const ar = Math.floor(sel / cols);
              const ac = sel % cols;
              const br = Math.floor(i / cols);
              const bc = i % cols;
              if (Math.abs(ar - br) + Math.abs(ac - bc) === 1) {
                [board[sel], board[i]] = [board[i], board[sel]];
                if (line()) celebrate();
              }
              sel = -1;
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    diff() {
      hotspots(4, false);
    },
    diff8() {
      hotspots(8, false);
    },
    spot() {
      hotspots(3, true);
    },

    memory() {
      const pairs = [
        ["Пушкин", "поэт"],
        ["Опекушин", "резец"],
        ["Дуб", "200"],
        ["Венец", "1831"],
      ];
      let deck = shuffle(pairs.flatMap(([a, b], i) => [{ k: i, t: a }, { k: i, t: b }]));
      let open = [];
      let lock = false;
      let matched = 0;
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-card-grid">${deck
          .map((card, i) => {
            const show = open.includes(i) || card.gone;
            return `<button type="button" class="mg-card ${show ? "open" : ""} ${card.gone ? "matched" : ""}" data-i="${i}">${show ? esc(card.t) : "·"}</button>`;
          })
          .join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.i);
            if (lock || deck[i].gone || open.includes(i)) return;
            open.push(i);
            if (open.length === 2) {
              lock = true;
              const [a, c] = open;
              if (deck[a].k === deck[c].k) {
                deck[a].gone = deck[c].gone = true;
                matched++;
                open = [];
                lock = false;
                if (matched === pairs.length) celebrate();
              } else {
                setTimeout(() => {
                  open = [];
                  lock = false;
                  paint();
                }, 700);
              }
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    order() {
      const target = ["1799", "1814", "1828", "1831", "1880"];
      let items = shuffle(target);
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-row">${items
          .map((y, i) => `<button type="button" class="mg-chip" data-i="${i}">${y}</button>`)
          .join("")}</div><p class="mg-note">Нажми год — он встанет в конец. Собери возрастание.</p>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.i);
            const [x] = items.splice(i, 1);
            items.push(x);
            if (items.join() === target.join()) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Порядок: рождение, дуб, встреча, венчание, памятник.", "");
      bindBack();
      paint();
    },

    anagram() {
      const word = "ДУБ";
      let bank = shuffle(word.split(""));
      let slots = [];
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-slot-row">${slots.map((ch, i) => `<button type="button" class="mg-letter" data-s="${i}">${ch}</button>`).join("") || `<span class="mg-note">слоты пусты</span>`}</div>
          <div class="mg-letter-bank">${bank.map((ch, i) => `<button type="button" class="mg-letter" data-b="${i}">${ch}</button>`).join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-b]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.b);
            slots.push(bank.splice(i, 1)[0]);
            if (slots.join("") === word) celebrate();
            paint();
          };
        });
        document.getElementById("stage").querySelectorAll("[data-s]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.s);
            bank.push(slots.splice(i, 1)[0]);
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "На табличке у корней: дуб черешчатый. Собери слово.", "");
      bindBack();
      paint();
    },

    lock() {
      let code = "";
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-code-display">${esc(code.padEnd(4, "·"))}</div>
          <div class="mg-keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "←"].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-k]").forEach((b) => {
          b.onclick = () => {
            const k = b.dataset.k;
            if (k === "C") code = "";
            else if (k === "←") code = code.slice(0, -1);
            else if (code.length < 4) code += k;
            if (code === "1880") celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    pairs() {
      const left = [
        ["Опекушин", "a"],
        ["Гончарова", "b"],
        ["Дуб", "c"],
      ];
      const right = shuffle([
        ["скульптор", "a"],
        ["невеста", "b"],
        ["200 лет", "c"],
      ]);
      let pickL = null;
      let pickR = null;
      const solved = new Set();
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-pair"><div>${left
          .map(
            ([t, id]) =>
              `<button type="button" data-side="l" data-id="${id}" class="${pickL === id ? "sel" : ""} ${solved.has(id) ? "done" : ""}">${esc(t)}</button>`
          )
          .join("")}</div><div>${right
          .map(
            ([t, id]) =>
              `<button type="button" data-side="r" data-id="${id}" class="${pickR === id ? "sel" : ""} ${solved.has(id) ? "done" : ""}">${esc(t)}</button>`
          )
          .join("")}</div></div>`;
        document.getElementById("stage").querySelectorAll("button").forEach((b) => {
          b.onclick = () => {
            if (solved.has(b.dataset.id)) return;
            if (b.dataset.side === "l") pickL = b.dataset.id;
            else pickR = b.dataset.id;
            if (pickL && pickR) {
              if (pickL === pickR) solved.add(pickL);
              pickL = pickR = null;
              if (solved.size === left.length) celebrate();
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    odd() {
      const opts = shuffle([
        ["Памятник на Пушкинской", false],
        ["Дуб на Тверском", false],
        ["Венчание у Никитских", false],
        ["Циферблат, которого нет", true],
      ]);
      document.getElementById("stage") && 0;
      app.innerHTML = shell(game.name, game.brief, `<div class="mg-row">${opts
        .map(([t, bad], i) => `<button type="button" class="mg-chip" data-i="${i}">${esc(t)}</button>`)
        .join("")}</div>`);
      bindBack();
      const stage = document.getElementById("stage");
      document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
        b.onclick = () => {
          if (opts[Number(b.dataset.i)][1]) celebrate();
          else b.classList.add("bad");
        };
      });
    },

    sil() {
      const opts = shuffle(STICKERS);
      app.innerHTML = shell(
        game.name,
        game.brief,
        `<img src="${PHOTO}" alt="" style="width:100%;border-radius:8px;max-height:180px;object-fit:cover" />
         <div class="mg-sil-options">${opts
           .map(([src, id]) => `<button type="button" data-id="${id}"><img src="${src}" alt="" /></button>`)
           .join("")}</div>`
      );
      bindBack();
      document.getElementById("stage").querySelectorAll("[data-id]").forEach((b) => {
        b.onclick = () => {
          if (b.dataset.id === "pushkin") celebrate();
          else b.style.opacity = "0.35";
        };
      });
    },

    quote() {
      const lines = [
        "Я памятник себе воздвиг нерукотворный",
        "К нему не зарастёт народная тропа",
        "И долго буду тем любезен я народу",
        "Что чувства добрые я лирой пробуждал",
      ];
      let pool = shuffle(lines.map((t, i) => ({ t, i })));
      let built = [];
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-slot-row" style="flex-direction:column;align-items:stretch">${built
          .map((x) => `<div class="mg-chip">${esc(x.t)}</div>`)
          .join("")}</div><div class="mg-row">${pool
          .map((x, i) => `<button type="button" class="mg-chip" data-i="${i}">${esc(x.t)}</button>`)
          .join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            const x = pool.splice(Number(b.dataset.i), 1)[0];
            built.push(x);
            if (built.length === lines.length) {
              if (built.every((item, idx) => item.i === idx)) celebrate();
              else {
                pool = shuffle(built);
                built = [];
                setHud("Порядок сбился — ещё раз");
              }
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    maze() {
      drawMaze(
        [
          "########",
          "#S.....#",
          "#.####.#",
          "#.#..#.#",
          "#.#.##.#",
          "#...#..#",
          "#####E##",
        ],
        false
      );
    },

    genmaze() {
      const rows = 9;
      const cols = 9;
      const grid = Array.from({ length: rows }, () => Array(cols).fill("#"));
      const carve = (y, x) => {
        grid[y][x] = ".";
        shuffle([
          [0, 2],
          [0, -2],
          [2, 0],
          [-2, 0],
        ]).forEach(([dy, dx]) => {
          const ny = y + dy;
          const nx = x + dx;
          if (ny > 0 && nx > 0 && ny < rows - 1 && nx < cols - 1 && grid[ny][nx] === "#") {
            grid[y + dy / 2][x + dx / 2] = ".";
            carve(ny, nx);
          }
        });
      };
      carve(1, 1);
      grid[1][1] = "S";
      grid[rows - 2][cols - 2] = "E";
      drawMaze(
        grid.map((r) => r.join("")),
        true
      );
    },

    year() {
      let val = 1850;
      app.innerHTML = shell(
        game.name,
        game.brief,
        `<div class="mg-slider-wrap"><div class="mg-year-val" id="yv">${val}</div><input id="yr" type="range" min="1790" max="1900" value="${val}" /></div>`
      );
      bindBack();
      const input = document.getElementById("yr");
      const label = document.getElementById("yv");
      input.oninput = () => {
        val = Number(input.value);
        label.textContent = val;
        if (Math.abs(val - 1880) <= 2) celebrate();
      };
    },

    jigsaw() {
      const n = 6;
      let placed = Array(n).fill(false);
      let hold = null;
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-grid" style="grid-template-columns:repeat(3,1fr);max-width:280px">${placed
          .map(
            (on, i) =>
              `<button type="button" class="mg-tile" data-slot="${i}" style="${on ? `background-image:url('${PHOTO}');background-size:300% 200%;background-position:${(i % 3) * 50}% ${Math.floor(i / 3) * 100}%` : "background:#2a2118"}">${on ? "" : i + 1}</button>`
          )
          .join("")}</div>
          <div class="mg-row" style="margin-top:10px">${[...Array(n).keys()]
            .filter((i) => !placed[i])
            .map(
              (i) =>
                `<button type="button" class="mg-chip ${hold === i ? "on" : ""}" data-piece="${i}" style="width:54px;height:54px;background-image:url('${PHOTO}');background-size:300% 200%;background-position:${(i % 3) * 50}% ${Math.floor(i / 3) * 100}%"></button>`
            )
            .join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-piece]").forEach((b) => {
          b.onclick = () => {
            hold = Number(b.dataset.piece);
            paint();
          };
        });
        document.getElementById("stage").querySelectorAll("[data-slot]").forEach((b) => {
          b.onclick = () => {
            const s = Number(b.dataset.slot);
            if (hold == null || placed[s]) return;
            if (hold === s) placed[s] = true;
            hold = null;
            if (placed.every(Boolean)) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Возьми кусок и положи на клетку с тем же номером.", "");
      bindBack();
      paint();
    },

    cascade() {
      const glyphs = ["А", "Б", "В", "Г"];
      const w = 5;
      const h = 6;
      let board = Array.from({ length: h }, () => Array.from({ length: w }, () => glyphs[Math.floor(Math.random() * glyphs.length)]));
      let sel = null;
      const falls = () => {
        let changed = false;
        for (let x = 0; x < w; x++) {
          const col = [];
          for (let y = h - 1; y >= 0; y--) if (board[y][x]) col.push(board[y][x]);
          while (col.length < h) col.push(glyphs[Math.floor(Math.random() * glyphs.length)]);
          for (let y = h - 1; y >= 0; y--) {
            const next = col[h - 1 - y];
            if (board[y][x] !== next) changed = true;
            board[y][x] = next;
          }
        }
        return changed;
      };
      const clearLines = () => {
        const kill = Array.from({ length: h }, () => Array(w).fill(false));
        let any = false;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w - 2; x++) {
            const a = board[y][x];
            if (a && a === board[y][x + 1] && a === board[y][x + 2]) {
              kill[y][x] = kill[y][x + 1] = kill[y][x + 2] = true;
              any = true;
            }
          }
        }
        if (!any) return false;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (kill[y][x]) board[y][x] = "";
        return true;
      };
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-match3" style="grid-template-columns:repeat(${w},1fr)">${board
          .flatMap((row, y) => row.map((g, x) => `<button type="button" class="mg-m3 ${sel && sel[0] === y && sel[1] === x ? "sel" : ""}" data-y="${y}" data-x="${x}">${esc(g)}</button>`))
          .join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-y]").forEach((b) => {
          b.onclick = () => {
            const y = Number(b.dataset.y);
            const x = Number(b.dataset.x);
            if (!sel) sel = [y, x];
            else {
              if (Math.abs(sel[0] - y) + Math.abs(sel[1] - x) === 1) {
                const [y0, x0] = sel;
                [board[y0][x0], board[y][x]] = [board[y][x], board[y0][x0]];
                let guard = 0;
                while (clearLines() && guard++ < 8) falls();
                setHud("Комбо: " + guard);
                if (guard > 0) celebrate();
              }
              sel = null;
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    cross() {
      const words = { ДУБ: "", ГОД: "" };
      app.innerHTML = shell(
        game.name,
        "1. Дерево на Тверском (3). 2. То, что шепчет табличка? Нет — единица времени из трёх букв у памятника… слово ГОД.",
        `<div class="mg-row" style="flex-direction:column;align-items:stretch">
          <label>Дерево <input id="w1" class="field" maxlength="3" style="margin-top:6px" /></label>
          <label>Единица <input id="w2" class="field" maxlength="3" style="margin-top:6px" /></label>
          <button type="button" class="btn primary" id="ok">Сверить</button>
        </div>`
      );
      bindBack();
      document.getElementById("ok").onclick = () => {
        const a = document.getElementById("w1").value.trim().toUpperCase();
        const b = document.getElementById("w2").value.trim().toUpperCase();
        if (a === "ДУБ" && b === "ГОД") celebrate();
        else setHud("Не то");
      };
      words;
    },

    sudoku() {
      const sol = [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ];
      const holes = new Set(["0,2", "1,0", "2,3", "3,1"]);
      const val = {};
      const paint = () => {
        let html = `<div class="mg-grid" style="grid-template-columns:repeat(4,1fr);max-width:260px">`;
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            const key = `${y},${x}`;
            if (!holes.has(key)) html += `<div class="mg-tile" style="background:#3a3228;display:grid;place-items:center">${sol[y][x]}</div>`;
            else html += `<button type="button" class="mg-tile" data-k="${key}" style="background:#1c1814">${val[key] || ""}</button>`;
          }
        }
        html += `</div><p class="mg-note">Тап по пустой клетке ставит следующее число 1–4</p>`;
        document.getElementById("stage").innerHTML = html;
        document.getElementById("stage").querySelectorAll("[data-k]").forEach((b) => {
          b.onclick = () => {
            const k = b.dataset.k;
            val[k] = ((val[k] || 0) % 4) + 1;
            const ok = [...holes].every((key) => {
              const [yy, xx] = key.split(",").map(Number);
              return val[key] === sol[yy][xx];
            });
            if (ok) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    nonogram() {
      const pattern = [
        [0, 1, 1, 1, 0],
        [1, 0, 1, 0, 1],
        [1, 1, 1, 1, 1],
        [1, 0, 1, 0, 1],
        [0, 1, 0, 1, 0],
      ];
      const on = Array.from({ length: 5 }, () => Array(5).fill(false));
      const paint = () => {
        document.getElementById("stage").innerHTML = `<p class="mg-note">Ряды: 3 · 1 1 1 · 5 · 1 1 1 · 1 1. Столбцы: 2 · 1 2 · 4 · 1 2 · 2</p>
          <div class="mg-grid" style="grid-template-columns:repeat(5,1fr);max-width:260px">${on
            .flatMap((row, y) =>
              row.map(
                (v, x) =>
                  `<button type="button" class="mg-tile" data-y="${y}" data-x="${x}" style="background:${v ? "#e8c547" : "#1c1814"}"></button>`
              )
            )
            .join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-y]").forEach((b) => {
          b.onclick = () => {
            const y = Number(b.dataset.y);
            const x = Number(b.dataset.x);
            on[y][x] = !on[y][x];
            if (on.every((row, yy) => row.every((v, xx) => v === !!pattern[yy][xx]))) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Силуэт лиры. Закрась по подсказкам.", "");
      bindBack();
      paint();
    },

    pipes() {
      // 0 empty 1 horiz 2 vert 3 corner
      let cells = [
        [1, 3, 2],
        [0, 2, 2],
        [1, 1, 1],
      ];
      const solved = [
        [1, 1, 1],
        [0, 0, 0],
        [0, 0, 0],
      ];
      const glyph = ["·", "—", "|", "┐"];
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-pipe" style="grid-template-columns:repeat(3,1fr)">${cells
          .flatMap((row, y) => row.map((v, x) => `<button type="button" class="mg-pipe-cell" data-y="${y}" data-x="${x}">${glyph[v]}</button>`))
          .join("")}</div><p class="mg-note">Тап крутит звено. Нужна прямая линия в верхнем ряду.</p>`;
        document.getElementById("stage").querySelectorAll("[data-y]").forEach((b) => {
          b.onclick = () => {
            const y = Number(b.dataset.y);
            const x = Number(b.dataset.x);
            cells[y][x] = (cells[y][x] + 1) % 4;
            if (cells.every((row, yy) => row.every((v, xx) => v === solved[yy][xx]))) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    crest() {
      const need = ["лира", "дуб", "перо"];
      let bag = shuffle(need.concat(["фонарь"]));
      let slots = [null, null, null];
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-row">${slots
          .map((s, i) => `<button type="button" class="mg-chip" data-slot="${i}">${s || "слот " + (i + 1)}</button>`)
          .join("")}</div><div class="mg-row" style="margin-top:10px">${bag
          .map((s, i) => `<button type="button" class="mg-chip" data-b="${i}">${esc(s)}</button>`)
          .join("")}</div>`;
        let hold = paint.hold;
        document.getElementById("stage").querySelectorAll("[data-b]").forEach((b) => {
          b.onclick = () => {
            paint.hold = Number(b.dataset.b);
            setHud("Выбрано: " + bag[paint.hold]);
          };
        });
        document.getElementById("stage").querySelectorAll("[data-slot]").forEach((b) => {
          b.onclick = () => {
            if (paint.hold == null) return;
            const i = Number(b.dataset.slot);
            if (slots[i]) bag.push(slots[i]);
            slots[i] = bag.splice(paint.hold, 1)[0];
            paint.hold = null;
            if (slots.every((s, idx) => s === need[idx])) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Порядок щита: лира, дуб, перо. Фонарь лишний.", "");
      bindBack();
      paint();
    },

    timeline() {
      const ev = [
        [1799, "рождение"],
        [1828, "бал"],
        [1831, "венчание"],
        [1880, "бронза"],
      ];
      let items = shuffle(ev);
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-row" style="flex-direction:column;align-items:stretch">${items
          .map(([y, t], i) => `<button type="button" class="mg-chip" data-i="${i}">${y} · ${esc(t)}</button>`)
          .join("")}</div><p class="mg-note">Нажатое событие уходит вниз. Собери хронологию.</p>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            const i = Number(b.dataset.i);
            const [x] = items.splice(i, 1);
            items.push(x);
            if (items.every((it, idx) => it[0] === ev[idx][0])) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    caesar() {
      const alphabet = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
      const plain = "МОСКВА";
      let shift = 3;
      const enc = (s, sh) =>
        s
          .split("")
          .map((ch) => {
            const i = alphabet.indexOf(ch);
            if (i < 0) return ch;
            return alphabet[(i + sh) % alphabet.length];
          })
          .join("");
      const secret = enc(plain, shift);
      const paint = () => {
        document.getElementById("stage").innerHTML = `<p>Шифр: <b>${secret}</b></p>
          <div class="mg-slider-wrap"><div class="mg-year-val" id="sh">${shift}</div><input id="sl" type="range" min="0" max="20" value="${shift}" /></div>
          <p class="mg-note">Сдвиг 0 показывает исходное слово. Нужна МОСКВА.</p>
          <p id="decoded" style="text-align:center;font-size:22px">${enc(secret, (alphabet.length - shift) % alphabet.length)}</p>`;
        const sl = document.getElementById("sl");
        sl.oninput = () => {
          shift = Number(sl.value);
          const decoded = enc(secret, (alphabet.length - shift) % alphabet.length);
          document.getElementById("sh").textContent = shift;
          document.getElementById("decoded").textContent = decoded;
          if (decoded === plain) celebrate();
        };
      };
      app.innerHTML = shell(game.name, "Крути диск, пока не прочитаешь город.", "");
      bindBack();
      paint();
    },

    route() {
      const pts = shuffle([
        [1, "Пушкинская"],
        [2, "Дуб"],
        [3, "Вознесение"],
      ]);
      let next = 1;
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-row">${pts
          .map(([n, t]) => `<button type="button" class="mg-chip ${n < next ? "ok" : ""}" data-n="${n}">${esc(t)}</button>`)
          .join("")}</div><p class="mg-note">Порядок прогулки: площадь → дуб → храм</p>`;
        document.getElementById("stage").querySelectorAll("[data-n]").forEach((b) => {
          b.onclick = () => {
            if (Number(b.dataset.n) === next) {
              next++;
              if (next > 3) celebrate();
            } else setHud("Не эта точка");
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    bins() {
      const cards = shuffle([
        ["Опекушин", "люди"],
        ["Гончарова", "люди"],
        ["1880", "годы"],
        ["1831", "годы"],
      ]);
      const bins = { люди: [], годы: [] };
      let hold = null;
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-row">${cards
          .map((c, i) => (c ? `<button type="button" class="mg-chip ${hold === i ? "on" : ""}" data-i="${i}">${esc(c[0])}</button>` : ""))
          .join("")}</div>
          <div class="mg-bins" style="margin-top:10px">${["люди", "годы"]
            .map(
              (name) =>
                `<div class="mg-bin" data-bin="${name}"><h4>${name}</h4>${bins[name].map((t) => `<div>${esc(t)}</div>`).join("")}</div>`
            )
            .join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            hold = Number(b.dataset.i);
            paint();
          };
        });
        document.getElementById("stage").querySelectorAll("[data-bin]").forEach((b) => {
          b.onclick = () => {
            if (hold == null || !cards[hold]) return;
            const [text, kind] = cards[hold];
            if (kind === b.dataset.bin) {
              bins[kind].push(text);
              cards[hold] = null;
              hold = null;
              if (cards.every((c) => !c)) celebrate();
            } else setHud("Не та полка");
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Люди к людям, годы к годам.", "");
      bindBack();
      paint();
    },

    rebus() {
      app.innerHTML = shell(
        game.name,
        "Дом + дуб? Нет. Смотри знаки.",
        `<div style="font-size:28px;text-align:center;letter-spacing:6px">ДУ + Б</div>
         <div class="mg-row" style="margin-top:12px">${["ДОМ", "ДУБ", "ГОД", "ЛИРА"]
           .map((w) => `<button type="button" class="mg-chip" data-w="${w}">${w}</button>`)
           .join("")}</div>`
      );
      bindBack();
      document.getElementById("stage").querySelectorAll("[data-w]").forEach((b) => {
        b.onclick = () => {
          if (b.dataset.w === "ДУБ") celebrate();
          else b.classList.add("bad");
        };
      });
    },

    portrait() {
      const target = { c: 40, s: 70, b: 55 };
      let c = 10;
      let s = 20;
      let b = 90;
      const paint = () => {
        const stageEl = document.getElementById("stage");
        stageEl.innerHTML = `<div class="mg-portrait" id="face" style="background-image:url('${PHOTO}');filter:contrast(${c / 40}) saturate(${s / 50}) brightness(${b / 70})"></div>
          <label>Контраст <input id="c" type="range" min="10" max="80" value="${c}" /></label>
          <label>Цвет <input id="s" type="range" min="10" max="100" value="${s}" /></label>
          <label>Свет <input id="b" type="range" min="30" max="100" value="${b}" /></label>`;
        ["c", "s", "b"].forEach((id) => {
          document.getElementById(id).oninput = (e) => {
            if (id === "c") c = Number(e.target.value);
            if (id === "s") s = Number(e.target.value);
            if (id === "b") b = Number(e.target.value);
            if (Math.abs(c - target.c) < 8 && Math.abs(s - target.s) < 10 && Math.abs(b - target.b) < 8) celebrate();
            else paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Подгони портрет к эталону: контраст 40, цвет 70, свет 55.", "");
      bindBack();
      paint();
    },

    rhythm() {
      let beat = 0;
      let hits = 0;
      let on = false;
      app.innerHTML = shell(game.name, "Жми, когда круг вспыхивает. Нужно 5 точных ударов.", `<div class="mg-rhythm"><div class="mg-beat" id="beat"></div><button type="button" class="btn primary" id="tap">Удар</button></div>`);
      bindBack();
      const el = document.getElementById("beat");
      const tick = () => {
        on = !on;
        el.classList.toggle("pulse", on);
        beat++;
      };
      const timer = setInterval(tick, 700);
      const oldStop = stopLoops;
      stopLoops = () => {
        clearInterval(timer);
        stopLoops = oldStop;
      };
      document.getElementById("tap").onclick = () => {
        if (on) {
          hits++;
          setHud("Попадания: " + hits + "/5");
          if (hits >= 5) {
            clearInterval(timer);
            celebrate();
          }
        } else {
          hits = Math.max(0, hits - 1);
          setHud("Мимо · " + hits);
        }
      };
    },

    ar() {
      app.innerHTML = shell(
        game.name,
        "Прототип: камера и красный контур. Для теста можно засчитать без точного IoU.",
        `<video id="vid" autoplay playsinline muted style="width:100%;border-radius:8px;background:#000;max-height:280px"></video>
         <img src="assets/contours/pushkin-sticker.png" alt="" style="position:absolute;left:12px;right:12px;top:48px;height:240px;object-fit:contain;pointer-events:none;opacity:.85" />
         <div class="game-actions"><button type="button" class="btn primary" id="cam">Включить камеру</button>
         <button type="button" class="btn ghost" id="pass">Засчитать тест</button></div>`
      );
      bindBack();
      document.getElementById("cam").onclick = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          document.getElementById("vid").srcObject = stream;
        } catch (e) {
          setHud("Камера недоступна");
        }
      };
      document.getElementById("pass").onclick = () => celebrate();
    },

    physics() {
      const pieces = [
        { id: 0, x: 10, y: 10 },
        { id: 1, x: 40, y: 20 },
        { id: 2, x: 20, y: 40 },
      ];
      let drag = null;
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div id="field" style="position:relative;height:280px;background:#1a1510;border-radius:10px">
          <div id="basket" style="position:absolute;right:8px;bottom:8px;width:90px;height:110px;border:2px dashed #e8c547;border-radius:8px;display:grid;place-items:center;color:#e8c547;font-size:12px">конверт</div>
          ${pieces
            .map(
              (p) =>
                `<div class="scrap" data-id="${p.id}" style="position:absolute;left:${p.x}%;top:${p.y}%;width:72px;height:48px;background:#f3e6c8;color:#1a1008;border-radius:4px;display:grid;place-items:center;cursor:grab;font-size:12px">обрывок ${p.id + 1}</div>`
            )
            .join("")}
        </div>`;
        const field = document.getElementById("field");
        field.querySelectorAll(".scrap").forEach((el) => {
          el.onpointerdown = (e) => {
            drag = { id: Number(el.dataset.id), dx: e.clientX, dy: e.clientY };
            el.setPointerCapture(e.pointerId);
          };
          el.onpointermove = (e) => {
            if (!drag || drag.id !== Number(el.dataset.id)) return;
            const rect = field.getBoundingClientRect();
            const p = pieces.find((x) => x.id === drag.id);
            p.x = Math.max(0, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100 - 8));
            p.y = Math.max(0, Math.min(75, ((e.clientY - rect.top) / rect.height) * 100 - 6));
            el.style.left = p.x + "%";
            el.style.top = p.y + "%";
          };
          el.onpointerup = () => {
            drag = null;
            if (pieces.every((p) => p.x > 55 && p.y > 45)) celebrate();
          };
        });
      };
      app.innerHTML = shell(game.name, "Перетащи все обрывки в конверт справа внизу.", "");
      bindBack();
      paint();
    },

    platform() {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      canvas.className = "mg-board-canvas";
      app.innerHTML = shell(game.name, "Влево / вправо и прыжок. Дойди до золотой печати.", "");
      bindBack();
      document.getElementById("stage").appendChild(canvas);
      const keys = {};
      const onKey = (e) => {
        keys[e.key] = e.type === "keydown";
      };
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);
      let x = 20;
      let y = 120;
      let vy = 0;
      const ground = 140;
      const loop = () => {
        if (keys.ArrowLeft || keys.a) x -= 2.2;
        if (keys.ArrowRight || keys.d) x += 2.2;
        if ((keys.ArrowUp || keys.w || keys[" "]) && y >= ground - 1) vy = -7;
        vy += 0.35;
        y += vy;
        if (y > ground) {
          y = ground;
          vy = 0;
        }
        x = Math.max(0, Math.min(300, x));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#14110e";
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = "#3a3228";
        ctx.fillRect(0, 156, 320, 24);
        ctx.fillStyle = "#c9a227";
        ctx.fillRect(270, 120, 22, 36);
        ctx.fillStyle = "#d7c4a3";
        ctx.fillRect(x, y, 16, 28);
        if (x > 260 && y > 100) {
          celebrate();
          return;
        }
        loopTimer = requestAnimationFrame(loop);
      };
      const bar = document.createElement("div");
      bar.className = "game-actions";
      bar.innerHTML = `<div class="mg-row"><button type="button" class="mg-chip" id="l">←</button><button type="button" class="mg-chip" id="j">прыжок</button><button type="button" class="mg-chip" id="r">→</button></div>`;
      document.getElementById("stage").appendChild(bar);
      const hold = (id, key) => {
        const b = document.getElementById(id);
        b.onpointerdown = () => {
          keys[key] = true;
        };
        b.onpointerup = b.onpointerleave = () => {
          keys[key] = false;
        };
      };
      hold("l", "ArrowLeft");
      hold("r", "ArrowRight");
      hold("j", "ArrowUp");
      loop();
    },

    hidden() {
      hotspots(8, true, "Найди 8 мест, где могла бы быть деталь: тап по кружкам.");
    },

    draw() {
      app.innerHTML = shell(game.name, "Обведи фигуру. Достаточно длинной линии внутри рамки.", `<canvas id="cv" class="mg-board-canvas" width="320" height="420"></canvas>`);
      bindBack();
      const cv = document.getElementById("cv");
      const ctx = cv.getContext("2d");
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 40, 20, 240, 360);
      img.src = "assets/contours/pushkin-sticker-preview.png";
      ctx.strokeStyle = "#e23b3b";
      ctx.lineWidth = 4;
      let drawing = false;
      let len = 0;
      let last = null;
      const pos = (e) => {
        const r = cv.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: ((src.clientX - r.left) / r.width) * cv.width, y: ((src.clientY - r.top) / r.height) * cv.height };
      };
      const start = (e) => {
        drawing = true;
        last = pos(e);
      };
      const move = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        len += Math.hypot(p.x - last.x, p.y - last.y);
        last = p;
        setHud("Длина линии: " + Math.round(len));
        if (len > 500) celebrate();
      };
      cv.onpointerdown = start;
      cv.onpointermove = move;
      cv.onpointerup = () => {
        drawing = false;
      };
    },

    voice() {
      app.innerHTML = shell(
        game.name,
        "Скажи или впиши: «Я памятник себе воздвиг»",
        `<div class="game-actions"><button type="button" class="btn primary" id="mic">Слушать</button>
         <input id="line" class="field" placeholder="или впиши строку" />
         <button type="button" class="btn ghost" id="ok">Сверить</button></div>`
      );
      bindBack();
      const check = (text) => {
        const n = text.toLowerCase().replace(/ё/g, "е");
        if (n.includes("памятник") && n.includes("воздвиг")) celebrate();
        else setHud("Нужны слова «памятник» и «воздвиг»");
      };
      document.getElementById("ok").onclick = () => check(document.getElementById("line").value);
      document.getElementById("mic").onclick = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          setHud("Браузер без распознавания — впиши строку");
          return;
        }
        const rec = new SR();
        rec.lang = "ru-RU";
        rec.onresult = (e) => check(e.results[0][0].transcript);
        rec.start();
      };
    },

    escape() {
      let room = "hall";
      let hasKey = false;
      let open = false;
      const paint = () => {
        const hall = `<p><b>Прихожая</b></p><p>На столе ключ, дверь в кабинет.</p>
          <div class="mg-row"><button type="button" class="mg-chip" data-a="key">взять ключ</button><button type="button" class="mg-chip" data-a="door">дверь</button></div>`;
        const study = `<p><b>Кабинет</b></p><p>Письмо на бюро. ${open ? "Оно открыто." : "Заперто."}</p>
          <div class="mg-row"><button type="button" class="mg-chip" data-a="letter">письмо</button><button type="button" class="mg-chip" data-a="back">назад</button></div>`;
        document.getElementById("stage").innerHTML = `<div class="mg-escape-room">${room === "hall" ? hall : study}<div class="mg-inv">${hasKey ? "<span>ключ</span>" : ""}</div></div>`;
        document.getElementById("stage").querySelectorAll("[data-a]").forEach((b) => {
          b.onclick = () => {
            const a = b.dataset.a;
            if (a === "key") hasKey = true;
            if (a === "door" && hasKey) room = "study";
            if (a === "door" && !hasKey) setHud("Нужен ключ");
            if (a === "back") room = "hall";
            if (a === "letter" && hasKey) {
              open = true;
              celebrate();
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    coopboard() {
      const roles = ["картограф", "хронист", "шифровальщик"];
      const got = new Set();
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-row" style="flex-direction:column;align-items:stretch">${roles
          .map(
            (r) =>
              `<button type="button" class="mg-chip ${got.has(r) ? "ok" : ""}" data-r="${r}">${got.has(r) ? "сдано · " : "роль · "}${r}</button>`
          )
          .join("")}</div><p class="mg-note">Локальный прототип комнаты: каждая роль сдаёт свою часть.</p>`;
        document.getElementById("stage").querySelectorAll("[data-r]").forEach((b) => {
          b.onclick = () => {
            got.add(b.dataset.r);
            if (got.size === roles.length) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Три QR-роли. Здесь они на одном экране, чтобы проверить сборку.", "");
      bindBack();
      paint();
    },

    orbit() {
      let rot = 20;
      const faces = ["грудь", "спина", "лира", "дуб"];
      const paint = () => {
        const face = faces[Math.abs(Math.round(rot / 90)) % 4];
        document.getElementById("stage").innerHTML = `<div class="mg-css3d"><div class="mg-css3d-inner" style="transform:rotateY(${rot}deg)"><div class="mg-face">${face}</div></div></div>
          <input id="rot" type="range" min="0" max="360" value="${rot}" style="width:100%" />
          <p class="mg-note">Поверни, пока не увидишь «лира».</p>`;
        document.getElementById("rot").oninput = (e) => {
          rot = Number(e.target.value);
          const f = faces[Math.abs(Math.round(rot / 90)) % 4];
          if (f === "лира") celebrate();
          paint();
        };
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    photohunt() {
      app.innerHTML = shell(
        game.name,
        "Нейросети пока нет. Прототип: подтверди, что стоишь у Пушкинского дуба (Тверской, напротив 14).",
        `<img src="${PHOTO_B}" alt="" style="width:100%;border-radius:8px;max-height:180px;object-fit:cover" />
         <div class="game-actions"><button type="button" class="btn primary" id="here">Я у дуба</button></div>`
      );
      bindBack();
      document.getElementById("here").onclick = () => celebrate();
    },

    chess() {
      const files = "abcdefgh";
      app.innerHTML = shell(
        game.name,
        "Белая ладья на a1. Чёрный король на h8, своих фигур нет. Поставь ладью на линию шаха — клетка h.",
        `<div class="mg-grid" style="grid-template-columns:repeat(8,1fr);max-width:320px">${[...Array(64).keys()]
          .map((i) => {
            const r = Math.floor(i / 8);
            const c = i % 8;
            const dark = (r + c) % 2;
            const label = r === 7 && c === 0 ? "♖" : r === 0 && c === 7 ? "♚" : "";
            return `<button type="button" class="mg-tile" data-c="${c}" data-r="${r}" style="background:${dark ? "#3a3228" : "#efe6d4"};color:#1a1008;font-size:18px">${label}</button>`;
          })
          .join("")}</div>`
      );
      bindBack();
      document.getElementById("stage").querySelectorAll("[data-c]").forEach((b) => {
        b.onclick = () => {
          if (Number(b.dataset.c) === 7 && Number(b.dataset.r) !== 7) celebrate();
          else setHud("Нужна вертикаль h — крайний правый столбец, не своя клетка");
        };
      });
      files;
    },

    branch() {
      let step = 0;
      const nodes = [
        {
          q: "Куда идти от площади?",
          opts: [
            ["К несуществующему циферблату", 9],
            ["Вниз по Тверскому, к дубу", 1],
          ],
        },
        {
          q: "Что на табличке у дуба?",
          opts: [
            ["Возраст 200 лет", 2],
            ["Слово ДОМ", 9],
          ],
        },
        {
          q: "Дальше?",
          opts: [["К Большому Вознесению", 3], ["На Арбат, 53", 9]],
        },
      ];
      const paint = () => {
        if (step === 3) {
          celebrate();
          return;
        }
        if (step === 9) {
          document.getElementById("stage").innerHTML = `<p>Тупик. Эта точка ни к чему не привязана.</p><button type="button" class="btn ghost" id="retry">Сначала</button>`;
          document.getElementById("retry").onclick = () => {
            step = 0;
            paint();
          };
          return;
        }
        const node = nodes[step];
        document.getElementById("stage").innerHTML = `<p>${esc(node.q)}</p><div class="mg-story-opt">${node.opts
          .map(([t, to], i) => `<button type="button" class="mg-chip" data-to="${to}">${esc(t)}</button>`)
          .join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-to]").forEach((b) => {
          b.onclick = () => {
            step = Number(b.dataset.to);
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    relay() {
      const pts = ["Пушкинская", "Дуб", "Никитские"];
      const got = new Set();
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-row" style="flex-direction:column">${pts
          .map((p) => `<button type="button" class="mg-chip ${got.has(p) ? "ok" : ""}" data-p="${p}">${got.has(p) ? "принято · " : "эстафета · "}${p}</button>`)
          .join("")}</div><p class="mg-note">Прототип без живого GPS: каждая точка — сдача палочки.</p>`;
        document.getElementById("stage").querySelectorAll("[data-p]").forEach((b) => {
          b.onclick = () => {
            got.add(b.dataset.p);
            if (got.size === pts.length) celebrate();
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, game.brief, "");
      bindBack();
      paint();
    },

    letter() {
      const parts = shuffle(["Любезный", "Александр", "Сергеевич"]);
      let built = [];
      const paint = () => {
        document.getElementById("stage").innerHTML = `<div class="mg-slot-row">${built.map((t) => `<span class="mg-chip">${esc(t)}</span>`).join(" ")}</div>
          <div class="mg-row">${parts.map((t, i) => `<button type="button" class="mg-chip" data-i="${i}">${esc(t)}</button>`).join("")}</div>`;
        document.getElementById("stage").querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            built.push(parts.splice(Number(b.dataset.i), 1)[0]);
            if (!parts.length) {
              if (built.join(" ") === "Любезный Александр Сергеевич") celebrate();
              else {
                parts.push(...built);
                built = [];
                setHud("Порядок обращения другой");
              }
            }
            paint();
          };
        });
      };
      app.innerHTML = shell(game.name, "Три ученика приносят по слову обращения.", "");
      bindBack();
      paint();
    },
  };

  function hotspots(count, single, customBrief) {
    const spots = [];
    for (let i = 0; i < count; i++) {
      spots.push({ x: 18 + ((i * 37) % 70), y: 20 + ((i * 23) % 60), found: false });
    }
    const frame = (src) => `<div class="mg-diff-frame"><img src="${src}" alt="" />${spots
      .map(
        (s, i) =>
          `<button type="button" class="mg-hotspot ${s.found ? "found" : ""}" data-i="${i}" style="left:${s.x}%;top:${s.y}%"></button>`
      )
      .join("")}</div>`;
    app.innerHTML = shell(
      game.name,
      customBrief || game.brief,
      `<div class="mg-diff-wrap ${single ? "single" : ""}">${single ? frame(PHOTO) : frame(PHOTO) + frame(PHOTO_B)}</div>`
    );
    bindBack();
    const stage = document.getElementById("stage");
    const leftOnly = !single;
    document.getElementById("stage").querySelectorAll(".mg-hotspot").forEach((b, idx) => {
      b.onclick = () => {
        if (leftOnly && idx < count) return;
        const i = Number(b.dataset.i);
        spots[i].found = true;
        setHud(spots.filter((s) => s.found).length + " / " + count);
        if (spots.every((s) => s.found)) celebrate();
        b.classList.add("found");
      };
    });
  }

  function drawMaze(rows, daily) {
    const grid = rows.map((r) => r.split(""));
    let y = 0;
    let x = 0;
    grid.forEach((row, yy) =>
      row.forEach((ch, xx) => {
        if (ch === "S") {
          y = yy;
          x = xx;
        }
      })
    );
    const paint = () => {
      document.getElementById("stage").innerHTML = `<div class="mg-maze" style="grid-template-columns:repeat(${grid[0].length},1fr)">${grid
        .map((row, yy) =>
          row
            .map((ch, xx) => {
              const you = yy === y && xx === x;
              const cls = ch === "#" ? "wall" : ch === "E" ? "end" : ch === "S" ? "start" : "path";
              return `<div class="mg-maze-cell ${cls} ${you ? "you" : ""}" data-y="${yy}" data-x="${xx}"></div>`;
            })
            .join("")
        )
        .join("")}</div><p class="mg-note">${daily ? "Сид на сегодня. " : ""}Тап по соседней клетке.</p>`;
      document.getElementById("stage").querySelectorAll("[data-y]").forEach((cell) => {
        cell.onclick = () => {
          const yy = Number(cell.dataset.y);
          const xx = Number(cell.dataset.x);
          if (Math.abs(yy - y) + Math.abs(xx - x) !== 1) return;
          if (grid[yy][xx] === "#") return;
          y = yy;
          x = xx;
          if (grid[yy][xx] === "E") celebrate();
          paint();
        };
      });
    };
    app.innerHTML = shell(game.name, game.brief, "");
    bindBack();
    paint();
  }

  function renderPlay() {
    const fn = PLAY[game.kind];
    if (!fn) {
      app.innerHTML = shell(game.name, "Нет обработчика", "");
      bindBack();
      return;
    }
    fn();
  }

  render();
})();
