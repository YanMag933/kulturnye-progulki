/* Shared storage + quest builder from QUEST_DB */
window.KP = (() => {
  const KEYS = {
    enabled: "kultprogulki.mechanics.enabled.v2",
    draft: "kultprogulki.quest.draft.v1",
    active: "kultprogulki.quest.active.v1",
    progress: "kultprogulki.quest.progress.v1",
    usedTasks: "kultprogulki.used.tasks.v1",
    savedQuests: "kultprogulki.saved.quests.v1",
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadActiveQuest() {
    return loadJson(KEYS.active, null);
  }

  function saveActiveQuest(quest) {
    saveJson(KEYS.active, quest);
    saveJson(KEYS.progress, {
      questId: quest.id,
      stepIndex: -1,
      answers: [],
      startedAt: Date.now(),
      mapReady: false,
    });
    const saved = loadJson(KEYS.savedQuests, []);
    const without = saved.filter((q) => q.id !== quest.id);
    without.unshift({
      id: quest.id,
      title: quest.title,
      zone: quest.zone,
      difficulty: quest.difficulty,
      steps: quest.steps.length,
      createdAt: quest.createdAt,
    });
    saveJson(KEYS.savedQuests, without.slice(0, 20));
  }

  function loadProgress() {
    return loadJson(KEYS.progress, null);
  }

  function saveProgress(progress) {
    saveJson(KEYS.progress, progress);
  }

  function loadDraft() {
    return loadJson(KEYS.draft, null);
  }

  function getUsedTaskIds() {
    return new Set(loadJson(KEYS.usedTasks, []));
  }

  function markTasksUsed(taskIds) {
    const used = getUsedTaskIds();
    taskIds.forEach((id) => used.add(id));
    // keep last 80 to allow eventual reuse
    saveJson(KEYS.usedTasks, [...used].slice(-80));
  }

  function clearUsedTasks() {
    saveJson(KEYS.usedTasks, []);
  }

  function placeOf(task) {
    return window.QUEST_DB.places[task.placeId] || {
      name: "Место",
      address: "",
      zone: "ttk",
    };
  }

  function hydrateTask(task) {
    const place = placeOf(task);
    return {
      taskId: task.id,
      mechanicId: task.mechanicId,
      placeId: task.placeId,
      placeName: place.name,
      address: place.address,
      lat: place.lat,
      lon: place.lon,
      title: task.title,
      hint: task.hint,
      ui: task.ui,
      fact: task.fact || "",
      uniqueFeature: task.mechanicId === "contour_camera" || task.mechanicId === "geo_safe",
      silhouetteKey: task.silhouetteKey,
      hidePlaceUntilGuess: task.hidePlaceUntilGuess,
      guessPrompt: task.guessPrompt,
      guessOptions: task.guessOptions,
      guessCorrectIndex: task.guessCorrectIndex,
      matchTolerance: task.matchTolerance,
      matchMinScore: task.matchMinScore,
      contourAsset: task.contourAsset,
      photoAsset: task.photoAsset,
      photoKey: task.photoKey,
      contourHint: task.contourHint,
      fallbackQuestion: task.fallbackQuestion,
      fallbackAnswer: task.fallbackAnswer,
      cropAsset: task.cropAsset,
      cropCaption: task.cropCaption,
      options: task.options,
      correctIndex: task.correctIndex,
      question: task.question,
      prompt: task.prompt,
      expected: task.expected,
      alternatives: task.alternatives,
      correctNumber: task.correctNumber,
      tolerance: task.tolerance,
      radiusM: task.radiusM,
      revealM: task.revealM,
      lockedTeaser: task.lockedTeaser,
      unlockedText: task.unlockedText,
      safeType: task.safeType,
      safeCode: task.safeCode,
      safePrompt: task.safePrompt,
      puzzleTiles: task.puzzleTiles,
      statements: task.statements,
      checkpoints: task.checkpoints,
      pairs: task.pairs,
      shuffleTargets: task.shuffleTargets,
    };
  }

  /**
   * Pick one task for mechanic, preferring unused + matching zone/difficulty.
   */
  function pickTask(mechanicId, zone, difficulty, usedPlaces, usedTaskIds, usedSafeTypes) {
    const db = window.QUEST_DB;
    const all = db.tasks.filter((t) => t.mechanicId === mechanicId);
    if (!all.length) return null;
    const usedSafes = usedSafeTypes || new Set();

    const scored = all.map((t) => {
      const place = db.places[t.placeId];
      let score = 0;
      if (place && place.zone === zone) score += 5;
      else if (zone === "ttk" && place && place.zone === "garden") score += 1; // garden inside ttk ok-ish
      if (!t.difficulty || t.difficulty.includes(difficulty)) score += 3;
      if (!usedTaskIds.has(t.id)) score += 10;
      if (!usedPlaces.has(t.placeId)) score += 4;
      // Раскидывать типы сейфов по маршруту: один тип — на одно задание, без повтора пока есть выбор.
      if (t.safeType) {
        if (!usedSafes.has(t.safeType)) score += 6;
        else score -= 4;
      }
      return { t, score };
    });

    scored.sort((a, b) => b.score - a.score);
    // among top scores, shuffle a bit
    const topScore = scored[0].score;
    const top = scored.filter((x) => x.score >= topScore - 2);
    const choice = top[Math.floor(Math.random() * top.length)].t;
    return choice;
  }

  function buildQuestFromMechanics(mechanicSlots, opts = {}) {
    const zone = opts.zone || "ttk";
    const difficulty = opts.difficulty || "medium";
    const zoneMeta = window.QUEST_DB.zones[zone] || { label: zone, tasks: mechanicSlots.length };
    const usedTaskIds = getUsedTaskIds();
    const usedPlaces = new Set();
    const usedSafeTypes = new Set();
    const pickedIds = [];

    const steps = mechanicSlots.map((slot, i) => {
      const mechanicId = typeof slot === "string" ? slot : slot.id;
      const mechanicName = typeof slot === "string" ? slot : slot.name;
      let task = pickTask(mechanicId, zone, difficulty, usedPlaces, usedTaskIds, usedSafeTypes);
      if (!task) {
        return {
          slot: i + 1,
          mechanicId,
          mechanicName,
          placeName: "Точка",
          title: mechanicName,
          hint: "В базе пока нет контента для этой механики.",
          ui: "generic",
          fact: "",
        };
      }
      // if place collision, try once more ignoring place soft preference
      if (usedPlaces.has(task.placeId)) {
        const alt = window.QUEST_DB.tasks.find(
          (t) =>
            t.mechanicId === mechanicId &&
            !usedPlaces.has(t.placeId) &&
            (!t.difficulty || t.difficulty.includes(difficulty)) &&
            (!t.safeType || !usedSafeTypes.has(t.safeType))
        );
        if (alt) task = alt;
      }
      usedPlaces.add(task.placeId);
      usedTaskIds.add(task.id);
      if (task.safeType) usedSafeTypes.add(task.safeType);
      pickedIds.push(task.id);
      const hydrated = hydrateTask(task);
      return {
        slot: i + 1,
        mechanicName: mechanicName || mechanicId,
        ...hydrated,
      };
    });

    markTasksUsed(pickedIds);

    const titleByZone =
      zone === "garden" ? "Кольцо литературы" : "Чистые пруды и Покровка";

    return {
      id: `quest-${zone}-${difficulty}-${Date.now()}`,
      title: opts.title || titleByZone,
      subtitle: opts.subtitle || `Собрано из базы · без повтора недавних заданий`,
      zone,
      zoneLabel: zoneMeta.label,
      difficulty,
      difficultyLabel: { easy: "Лёгкий", medium: "Средний", hard: "Сложный" }[difficulty],
      durationHint: zone === "garden" ? "~45–75 мин · 5 точек" : "~90–110 мин · 10 точек",
      steps,
      source: "db",
      contourVersion: 6,
      createdAt: new Date().toISOString(),
    };
  }

  function materializeFromExport(exportObj) {
    const mechanics = (exportObj.questDraft && exportObj.questDraft.mechanics) || [];
    return buildQuestFromMechanics(mechanics, {
      zone: exportObj.zone || "ttk",
      difficulty: exportObj.difficulty || "medium",
    });
  }

  function enrichQuestSafes(quest) {
    if (!quest?.steps?.length || !window.QUEST_DB?.tasks) return quest;
    let changed = false;
    quest.steps = quest.steps.map((step) => {
      const dbTask = step.id ? window.QUEST_DB.tasks.find((t) => t.id === step.id) : null;
      if (!dbTask) return step;
      const next = { ...step };
      if (dbTask.safeType && !next.safeType) {
        next.safeType = dbTask.safeType;
        changed = true;
      }
      if (dbTask.safeCode != null && (next.safeCode == null || next.safeCode === "")) {
        next.safeCode = dbTask.safeCode;
        changed = true;
      }
      if (dbTask.safePrompt && !next.safePrompt) {
        next.safePrompt = dbTask.safePrompt;
        changed = true;
      }
      return next;
    });
    if (changed) saveJson(KEYS.active, quest);
    return quest;
  }

  function ensureDemoQuest() {
    let q = loadActiveQuest();
    if (q && q.steps && q.steps.length && q.contourVersion === 6) {
      return enrichQuestSafes(q);
    }
    const exportObj = window.DEMO_EXPORT || {
      zone: "ttk",
      difficulty: "medium",
      questDraft: {
        mechanics: [
          { id: "contour_camera", name: "Контур на камере" },
          { id: "geo_safe", name: "Гео-сейф" },
          { id: "find_detail", name: "Найди деталь" },
          { id: "plaque_scan", name: "Табличка" },
          { id: "count_elements", name: "Посчитай" },
          { id: "year_key", name: "Год-ключ" },
          { id: "art_puzzle", name: "Пазл" },
          { id: "guess_role", name: "Роль героя" },
          { id: "myth_or_fact", name: "Миф или факт" },
          { id: "finale_synthesis", name: "Финал" },
        ],
      },
    };
    q = materializeFromExport(exportObj);
    q.id = "active-auto-v6";
    q.contourVersion = 6;
    saveActiveQuest(q);
    return q;
  }

  function materializeStoryRoute(storyId) {
    const story = window.STORY_ROUTES && window.STORY_ROUTES[storyId];
    if (!story) throw new Error("Неизвестный сюжетный маршрут: " + storyId);
    const steps = (story.chapters || []).map((ch, i) => ({
      slot: ch.slot || i + 1,
      taskId: `story_${storyId}_${ch.slot || i + 1}`,
      mechanicId: ch.mechanicId || "year_key",
      mechanicName: ch.mechanicName || ch.chapterTitle || "Глава",
      placeId: `story_${storyId}_${ch.slot || i + 1}`,
      placeName: ch.placeName,
      address: ch.address || "",
      lat: ch.lat,
      lon: ch.lon,
      title: ch.title,
      hint: ch.hint,
      hintL1: ch.hintL1,
      hintL2: ch.hintL2,
      hintL3: ch.hintL3,
      storyBeat: ch.storyBeat,
      chapterTitle: ch.chapterTitle,
      ui: ch.ui || "safe",
      fact: ch.fact || "",
      uniqueFeature: ch.ui === "geo" || ch.ui === "contour",
      options: ch.options,
      correctIndex: ch.correctIndex,
      expected: ch.expected,
      alternatives: ch.alternatives,
      radiusM: ch.radiusM || 40,
      revealM: ch.revealM || 150,
      lockedTeaser: ch.hintL1 || ch.brief || ch.hint,
      unlockedText: ch.unlockedText || "",
      safeType: ch.safeType,
      safeCode: ch.safeCode,
      safePrompt: ch.safePrompt,
      photoTile: ch.photoTile,
      photoHint: ch.photoHint,
      clueImage: ch.clueImage,
      hideClueOnTask: !!ch.hideClueOnTask,
      atmosphere: ch.atmosphere,
      brief: ch.brief,
      letterScrap: ch.letterScrap || null,
      silhouetteKey: ch.silhouetteKey,
      skipGuess: !!ch.skipGuess,
      hidePlaceUntilGuess: ch.hidePlaceUntilGuess,
      guessPrompt: ch.guessPrompt,
      guessOptions: ch.guessOptions,
      guessCorrectIndex: ch.guessCorrectIndex,
      matchMinScore: ch.matchMinScore,
      contourHint: ch.contourHint,
      fallbackQuestion: ch.fallbackQuestion,
      fallbackAnswer: ch.fallbackAnswer,
    }));
    return {
      id: story.id || `story-${storyId}-${Date.now()}`,
      title: story.title,
      subtitle: story.subtitle || "",
      zone: story.zone || "garden",
      zoneLabel: story.zoneLabel || "Сюжет",
      difficulty: story.difficulty || "story",
      difficultyLabel: story.difficultyLabel || "Сюжет",
      durationHint: story.durationHint || "~90 мин",
      createdAt: new Date().toISOString(),
      storyId,
      isStory: true,
      characterId: story.characterId || null,
      letterEra: !!story.letterEra,
      mapBounds: story.mapBounds || null,
      contourVersion: 8,
      steps,
    };
  }

  function assetSvg(key) {
    return (window.KP_ASSETS && window.KP_ASSETS[key]) || "";
  }

  return {
    KEYS,
    loadJson,
    saveJson,
    loadActiveQuest,
    saveActiveQuest,
    loadProgress,
    saveProgress,
    loadDraft,
    materializeFromExport,
    materializeStoryRoute,
    buildQuestFromMechanics,
    ensureDemoQuest,
    clearUsedTasks,
    getUsedTaskIds,
    assetSvg,
  };
})();
