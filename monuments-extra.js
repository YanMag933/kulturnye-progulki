/**
 * +15 памятников Москвы с контурными заданиями.
 * Подключается после content-db.js и расширяет QUEST_DB.
 */
(function () {
  const db = window.QUEST_DB;
  if (!db) return;

  Object.assign(db.places, {
    dolgoruky: {
      name: "Памятник Юрию Долгорукому",
      address: "Тверская площадь",
      zone: "garden",
      lat: 55.7575,
      lon: 37.6178,
    },
    timiryazev: {
      name: "Памятник К. А. Тимирязеву",
      address: "начало Тверского бульвара",
      zone: "garden",
      lat: 55.7589,
      lon: 37.5978,
    },
    gogol: {
      name: "Памятник Н. В. Гоголю",
      address: "Никитский бульвар",
      zone: "garden",
      lat: 55.7574,
      lon: 37.5989,
    },
    tchaikovsky: {
      name: "Памятник П. И. Чайковскому",
      address: "у Московской консерватории",
      zone: "garden",
      lat: 55.7564,
      lon: 37.6048,
    },
    ostrovsky: {
      name: "Памятник А. Н. Островскому",
      address: "Театральная площадь",
      zone: "garden",
      lat: 55.7586,
      lon: 37.6187,
    },
    lermontov: {
      name: "Памятник М. Ю. Лермонтову",
      address: "Лермонтовская площадь",
      zone: "ttk",
      lat: 55.7694,
      lon: 37.6542,
    },
    dostoevsky: {
      name: "Памятник Ф. М. Достоевскому",
      address: "у Российской гос. библиотеки",
      zone: "garden",
      lat: 55.7518,
      lon: 37.6096,
    },
    abai: {
      name: "Памятник Абаю Кунанбаеву",
      address: "Чистопрудный бульвар",
      zone: "ttk",
      lat: 55.7598,
      lon: 37.6452,
    },
    yesenin: {
      name: "Памятник С. А. Есенину",
      address: "Тверской бульвар",
      zone: "garden",
      lat: 55.7612,
      lon: 37.6021,
    },
    gorky: {
      name: "Памятник М. Горькому",
      address: "площадь у Белорусского / парк Горького (кластер Садового)",
      zone: "garden",
      lat: 55.7736,
      lon: 37.5831,
    },
    herzen: {
      name: "Памятник А. И. Герцену",
      address: "Тверской бульвар",
      zone: "garden",
      lat: 55.7605,
      lon: 37.6012,
    },
    sholokhov: {
      name: "Памятник М. А. Шолохову",
      address: "Гоголевский бульвар",
      zone: "garden",
      lat: 55.7458,
      lon: 37.5989,
    },
    tretyakov: {
      name: "Памятник братьям Третьяковым",
      address: "Лаврушинский переулок",
      zone: "ttk",
      lat: 55.7414,
      lon: 37.6208,
    },
  });

  // align navoi / mayakovsky already exist; ensure mayakovsky coords ok
  if (db.places.mayakovsky) {
    db.places.mayakovsky.lat = 55.76972;
    db.places.mayakovsky.lon = 37.59583;
  }

  const MIN = 0.86; // max ~14% error

  const contours = [
    {
      id: "t_contour_mayakovsky",
      placeId: "mayakovsky",
      key: "mayakovsky",
      options: ["В. В. Маяковский", "А. С. Пушкин", "М. Горький", "С. Есенин"],
      hintPose: "Вытянутая рука / жест, высокий постамент.",
      fallQ: "Рука поднята в жесте?",
      fallA: "да",
      fact: "Памятник Маяковскому на Триумфальной — узнаваемый жест руки.",
    },
    {
      id: "t_contour_dolgoruky",
      placeId: "dolgoruky",
      key: "dolgoruky",
      options: ["Юрий Долгорукий", "Минин и Пожарский", "Жуков", "Суворов"],
      hintPose: "Князь на троне со щитом, широкий силуэт.",
      fallQ: "Сидит или стоит?",
      fallA: "сидит",
      fact: "Юрий Долгорукий на Тверской площади — основатель Москвы в городском мифе.",
    },
    {
      id: "t_contour_timiryazev",
      placeId: "timiryazev",
      key: "timiryazev",
      options: ["К. А. Тимирязев", "А. Н. Островский", "П. И. Чайковский", "М. Шолохов"],
      hintPose: "Сидящий учёный с книгой, широкий низ.",
      fallQ: "Сидячий памятник?",
      fallA: "да",
      fact: "Тимирязев у начала Тверского бульвара — классический сидячий силуэт.",
    },
    {
      id: "t_contour_gogol",
      placeId: "gogol",
      key: "gogol",
      options: ["Н. В. Гоголь", "Ф. М. Достоевский", "А. С. Грибоедов", "Абай"],
      hintPose: "Плащ с драпировкой, высокий постамент.",
      fallQ: "В плаще?",
      fallA: "да",
      fact: "Гоголь на Никитском бульваре — один из самых «плащевых» силуэтов Москвы.",
    },
    {
      id: "t_contour_tchaikovsky",
      placeId: "tchaikovsky",
      key: "tchaikovsky",
      options: ["П. И. Чайковский", "А. Н. Островский", "С. Рахманинов", "М. Глинка"],
      hintPose: "Сидящий композитор у пюпитра.",
      fallQ: "Сидит?",
      fallA: "да",
      fact: "Чайковский у консерватории — музыкальная точка Садового кольца.",
    },
    {
      id: "t_contour_ostrovsky",
      placeId: "ostrovsky",
      key: "ostrovsky",
      options: ["А. Н. Островский", "П. И. Чайковский", "К. Станиславский", "В. Немирович-Данченко"],
      hintPose: "Сидящий драматург в кресле.",
      fallQ: "Сидячий?",
      fallA: "да",
      fact: "Островский на Театральной площади смотрит на Малый театр.",
    },
    {
      id: "t_contour_lermontov",
      placeId: "lermontov",
      key: "lermontov",
      options: ["М. Ю. Лермонтов", "А. С. Пушкин", "С. Есенин", "А. Блок"],
      hintPose: "Стоящий романтический силуэт на постаменте.",
      fallQ: "Стоит?",
      fallA: "да",
      fact: "Лермонтов у Красных Ворот — якорь восточной дуги ТТК.",
    },
    {
      id: "t_contour_dostoevsky",
      placeId: "dostoevsky",
      key: "dostoevsky",
      options: ["Ф. М. Достоевский", "Н. В. Гоголь", "Л. Н. Толстой", "А. П. Чехов"],
      hintPose: "Стоящая фигура, напряжённый профиль.",
      fallQ: "Стоит?",
      fallA: "да",
      fact: "Достоевский у РГБ — один из самых узнаваемых литературных силуэтов центра.",
    },
    {
      id: "t_contour_abai",
      placeId: "abai",
      key: "abai",
      options: ["Абай Кунанбаев", "Алишер Навои", "А. С. Грибоедов", "М. Горький"],
      hintPose: "Стоящий поэт в длинном халате/плаще.",
      fallQ: "Стоит?",
      fallA: "да",
      fact: "Абай на Чистопрудном — сосед литературного кластера пруда.",
    },
    {
      id: "t_contour_yesenin",
      placeId: "yesenin",
      key: "yesenin",
      options: ["С. А. Есенин", "В. В. Маяковский", "А. Блок", "М. Цветаева"],
      hintPose: "Молодой стоящий поэт, стройный силуэт.",
      fallQ: "Стоит?",
      fallA: "да",
      fact: "Есенин на Тверском бульваре — лирическая точка маршрута.",
    },
    {
      id: "t_contour_gorky",
      placeId: "gorky",
      key: "gorky",
      options: ["М. Горький", "В. Маяковский", "А. Толстой", "И. Бунин"],
      hintPose: "Стоящий писатель на высоком постаменте.",
      fallQ: "Стоит?",
      fallA: "да",
      fact: "Горький — крупная фигура советского литературного пантеона в городе.",
    },
    {
      id: "t_contour_herzen",
      placeId: "herzen",
      key: "herzen",
      options: ["А. И. Герцен", "Н. Огарёв", "В. Белинский", "Н. Чернышевский"],
      hintPose: "Стоящий мыслитель на постаменте.",
      fallQ: "Стоит?",
      fallA: "да",
      fact: "Герцен на Тверском бульваре — точка свободомыслия XIX века.",
    },
    {
      id: "t_contour_sholokhov",
      placeId: "sholokhov",
      key: "sholokhov",
      options: ["М. А. Шолохов", "М. Горький", "Л. Толстой", "А. Чехов"],
      hintPose: "Широкий силуэт: писатель и кони.",
      fallQ: "Есть ли конь в композиции?",
      fallA: "да",
      fact: "Шолохов на Гоголевском — редкий «широкий» контур с конями.",
    },
    {
      id: "t_contour_tretyakov",
      placeId: "tretyakov",
      key: "tretyakov",
      options: ["Братья Третьяковы", "Пушкин и Гоголь", "Минин и Пожарский", "Маркс и Энгельс"],
      hintPose: "Две стоящие фигуры на общем постаменте.",
      fallQ: "Две фигуры?",
      fallA: "да",
      fact: "Братья Третьяковы у галереи — парный силуэт коллекционеров.",
    },
    {
      id: "t_contour_navoi2",
      placeId: "navoi",
      key: "navoi",
      options: ["Алишер Навои", "Абай", "Грибоедов", "Пушкин"],
      hintPose: "Восточный плащ, стоящая фигура на постаменте.",
      fallQ: "Стоит?",
      fallA: "да",
      fact: "Навои на Чистопрудном — ещё один восточный силуэт бульвара.",
    },
  ];

  const tasks = contours.map((c) => ({
    id: c.id,
    mechanicId: "contour_camera",
    placeId: c.placeId,
    difficulty: ["medium", "hard"],
    title: "Угадайте по контуру",
    hint: "Только тонкий внешний контур — без фото. Угадайте памятник, затем совместите контур в камере (погрешность ≤15%).",
    ui: "contour",
    silhouetteKey: c.key,
    hidePlaceUntilGuess: true,
    guessPrompt: "Кто это по силуэту?",
    guessOptions: c.options,
    guessCorrectIndex: 0,
    matchMinScore: MIN,
    contourHint: c.hintPose,
    fallbackQuestion: c.fallQ,
    fallbackAnswer: c.fallA,
    fact: c.fact,
  }));

  // tighten existing contour tasks
  db.tasks.forEach((t) => {
    if (t.mechanicId === "contour_camera") {
      t.matchMinScore = MIN;
      delete t.matchTolerance;
    }
  });

  db.tasks.push(...tasks);
  db.version = 3;
})();
