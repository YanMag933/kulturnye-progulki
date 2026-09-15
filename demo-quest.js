/** Default export recipe (your ttk-medium set) — content comes from QUEST_DB */
window.DEMO_EXPORT = {
  zone: "ttk",
  difficulty: "medium",
  enabledMechanics: [
    "contour_camera",
    "geo_safe",
    "find_detail",
    "plaque_scan",
    "count_elements",
    "year_key",
    "art_puzzle",
    "guess_role",
    "myth_or_fact",
    "finale_synthesis",
  ],
  disabledMechanics: [],
  questDraft: {
    taskCount: 10,
    mechanics: [
      { slot: 1, id: "contour_camera", name: "Контур на камере", uniqueFeature: true },
      { slot: 2, id: "geo_safe", name: "Гео-сейф", uniqueFeature: true },
      { slot: 3, id: "find_detail", name: "Найди деталь", uniqueFeature: false },
      { slot: 4, id: "plaque_scan", name: "Скан / ввод с таблички", uniqueFeature: false },
      { slot: 5, id: "count_elements", name: "Посчитай элементы", uniqueFeature: false },
      { slot: 6, id: "year_key", name: "Год-ключ", uniqueFeature: false },
      { slot: 7, id: "art_puzzle", name: "Пазл картины / панно", uniqueFeature: false },
      { slot: 8, id: "guess_role", name: "Угадай роль героя", uniqueFeature: false },
      { slot: 9, id: "myth_or_fact", name: "Миф или факт", uniqueFeature: false },
      { slot: 10, id: "finale_synthesis", name: "Финальный синтез", uniqueFeature: false },
    ],
  },
};
