export const translations = {
  en: {
    // Top bar
    home: "Home",
    videoEditor: "Video Editor",
    parseText: "Parse Text",
    randomize: "Randomize",
    translate: "Translate",
    export: "Export",
    
    // Slides panel
    slides: "Slides",
    noSlidesYet: "No slides yet. Click 'Parse Text' to get started.",
    
    // Style controls
    styleControls: "Style Controls",
    selectSlide: "Select a slide to edit styles",
    
    // Tabs
    text: "Text",
    position: "Position",
    plate: "Plate",
    shadow: "Shadow",
    global: "Global",
    
    // Text tab
    fontFamily: "Font Family",
    titleFontSize: "Title Font Size",
    bodyFontSize: "Body Font Size",
    titleFontWeight: "Title Font Weight",
    bodyFontWeight: "Body Font Weight",
    color: "Color",
    alignment: "Alignment",
    left: "Left",
    center: "Center",
    right: "Right",
    applyTextStyle: "Apply Text Style to All Slides",
    
    // Position tab
    enableTextBox: "Enable Text Box Positioning",
    howToUse: "How to use:",
    dragBox: "Drag the blue box on the preview to move text",
    dragCorner: "Drag the corner handle to resize",
    clickApply: "Click 'Apply to All' to use same position everywhere",
    positionXY: "Position (X: {x}%, Y: {y}%)",
    sizeWH: "Size (W: {w}%, H: {h}%)",
    applyPosition: "Apply Position to All Slides",
    
    // Plate tab
    enablePlate: "Enable Background Plate",
    padding: "Padding",
    borderRadius: "Border Radius",
    opacity: "Opacity",
    backgroundColor: "Background Color",
    textOutline: "Text Outline Color",
    outlineWidth: "Outline Width",
    enhancedShadow: "Enhanced Text Shadow",
    glowColor: "Glow Color",
    glowEffect: "Soft glow effect around text",
    
    // Shadow tab
    textShadow: "Text Shadow",
    applyShadow: "Apply Shadow & Effects to All Slides",
    
    // Global tab
    backgroundMusic: "Background Music",
    musicUploaded: "Music uploaded",
    upload: "Upload",
    uploading: "Uploading...",
    uploadMusic: "Upload royalty-free music to add to your video exports",
    generateMusic: "Generate AI Music",
    generatingMusic: "Generating music...",
    generateMusicDesc: "AI will create custom background music for your video",
    videoDimming: "Video Overlay Dimming",
    slideDuration: "Slide Duration",
    applyDuration: "Apply Duration to All Slides",
    
    // Preview
    playTimeline: "Play Timeline",
    pause: "Pause",
    restart: "Restart",
    slideXofY: "Slide {current} of {total}",
  },
  ru: {
    // Top bar
    home: "Главная",
    videoEditor: "Видеоредактор",
    parseText: "Создать слайды",
    randomize: "Случайный фон",
    translate: "Перевести",
    export: "Экспорт",
    
    // Slides panel
    slides: "Слайды",
    noSlidesYet: "Слайдов пока нет. Нажмите 'Создать слайды' чтобы начать.",
    
    // Style controls
    styleControls: "Настройки стиля",
    selectSlide: "Выберите слайд для редактирования",
    
    // Tabs
    text: "Текст",
    position: "Позиция",
    plate: "Подложка",
    shadow: "Тени",
    global: "Общие",
    
    // Text tab
    fontFamily: "Шрифт",
    titleFontSize: "Размер заголовка",
    bodyFontSize: "Размер текста",
    titleFontWeight: "Жирность заголовка",
    bodyFontWeight: "Жирность текста",
    color: "Цвет",
    alignment: "Выравнивание",
    left: "Слева",
    center: "По центру",
    right: "Справа",
    applyTextStyle: "Применить к всем слайдам",
    
    // Position tab
    enableTextBox: "Включить перемещение текста",
    howToUse: "Как использовать:",
    dragBox: "Перетащите синюю рамку для перемещения текста",
    dragCorner: "Потяните за угол чтобы изменить размер",
    clickApply: "Нажмите 'Применить' чтобы использовать на всех слайдах",
    positionXY: "Позиция (X: {x}%, Y: {y}%)",
    sizeWH: "Размер (Ш: {w}%, В: {h}%)",
    applyPosition: "Применить позицию ко всем",
    
    // Plate tab
    enablePlate: "Включить фон под текстом",
    padding: "Отступ",
    borderRadius: "Скругление углов",
    opacity: "Прозрачность",
    backgroundColor: "Цвет фона",
    textOutline: "Цвет обводки",
    outlineWidth: "Ширина обводки",
    enhancedShadow: "Улучшенная тень",
    glowColor: "Цвет свечения",
    glowEffect: "Мягкое свечение вокруг текста",
    
    // Shadow tab
    textShadow: "Тень текста",
    applyShadow: "Применить тень ко всем",
    
    // Global tab
    backgroundMusic: "Фоновая музыка",
    musicUploaded: "Музыка загружена",
    upload: "Загрузить",
    uploading: "Загрузка...",
    uploadMusic: "Загрузите музыку без авторских прав для ваших видео",
    generateMusic: "Создать AI музыку",
    generatingMusic: "Создаю музыку...",
    generateMusicDesc: "AI создаст уникальную фоновую музыку для вашего видео",
    videoDimming: "Затемнение видео",
    slideDuration: "Длительность слайда",
    applyDuration: "Применить длительность ко всем",
    
    // Preview
    playTimeline: "Воспроизвести",
    pause: "Пауза",
    restart: "Сначала",
    slideXofY: "Слайд {current} из {total}",
  }
};

export type Language = keyof typeof translations;

export const t = (key: string, lang: Language = 'en', replacements?: Record<string, string | number>): string => {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  if (replacements) {
    return value.replace(/\{(\w+)\}/g, (_, k) => String(replacements[k] ?? ''));
  }
  
  return value;
};
