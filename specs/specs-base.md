# EmergencyRND V2 — Техническая база

## IMPORTANT: No Testing
**НИКОГДА не тестировать при разработке — ни в браузере, ни иным способом.** Вся необходимая информация для реализации фичей содержится в spec-файлах: координаты, структуры данных, DOM-элементы, состояния, z-index слои. Любое тестирование запрещено — пиши код, опираясь исключительно на спецификацию.

## Overview
3D веб-игра от первого лица в стилистике частной клиники. Открывается напрямую в браузере (`file://`) без сборки и сервера.

## Tech Stack
- **Three.js r0.164.1** — через CDN (import map, jsDelivr)
- **PointerLockControls** — из Three.js addons
- **Post-processing** — EffectComposer + OutlinePass + OutputPass (из Three.js addons) для обводки объектов
- **Без npm/bundler** — открываем `index.html` напрямую

## Architecture
Модульная структура с глобальным namespace `window.Game`. JS-файлы подключаются обычными `<script src>` (совместимо с `file://`). Three.js импортируется через `<script type="module">` + importmap (CDN).

Каждый JS-модуль — IIFE, регистрирующий себя в `window.Game`:
- `Game.Helpers` — утилиты (createWall, createSign, процедурные текстуры)
- `Game.World` — построение сцены (здание, мебель, улица, освещение)
- `Game.Patients` — система пациентов (спавн, очередь, движение, лечение, UI)
- `Game.Controls` — управление (WASD, коллизии, pointer lock)
- `Game.Consumables` — расходники (типы, физика, подбор, бросок)
- `Game.Inventory` — инвентарь (6 слотов, UI, выбор слота)
- `Game.Shop` — магазин расходников (попап, покупка)
- `Game.Furniture` — система мебели (покупка, перемещение, indoor/outdoor, динамические слоты, грязное бельё)
- `Game.WashingMachine` — стиральная машина (загрузка грязного белья, стирка, выдача чистого)
- `Game.Shelves` — стеллажи (создание, размещение расходников; инструменты отклоняются)
- `Game.ToolPanel` — настенная панель для инструментов (3 типизированных слота)
- `Game.Diagnostics` — мини-игры диагностики (фонендоскоп, рефлекс-молоток, риноскоп)
- `Game.Staff` — система найма сотрудников (NPC-помощники, корзины для белья, зарплата)
- `Game.Trash` — система мусора (спавн внутри больницы с уровня 3, модели, партиклы вони, мухи, уборка)
- `Game.Shift` — система смен и дней (время, табличка Open/Closed, задачи, итоги дня)
- `Game.Cashier` — касса и система оплаты
- `Game.Tutorial` — пошаговый туториал (state machine, 3D-стрелки, spotlight, блокировка действий)

Порядок загрузки: helpers → world → patients → controls → consumables → inventory → shop → furniture → washing-machine → shelves → tool-panel → diagnostics → staff → trash → shift → cashier → tutorial → inline module (оркестратор).

## File Structure
```
index.html              — HTML + importmap + module-оркестратор (~100 строк)
styles.css              — вся CSS-стилизация UI
js/
  helpers.js            — createWall, createSign, процедурные текстуры
  world.js              — здание, мебель, уличная среда, освещение
  patients.js           — система пациентов (данные, спавн, движение, лечение, UI попапа)
  controls.js           — WASD, коллизии, pointer lock
  consumables.js        — расходники (типы, 3D модели, физика гравитации, подбор)
  inventory.js          — инвентарь (6 слотов, UI-бар, выбор слота, уведомления)
  shop.js               — магазин расходников (попап с табами: препараты + инструменты + мебель)
  furniture.js          — система мебели (покупка, перемещение, indoor/outdoor, динамические слоты, грязное бельё)
  washing-machine.js    — стиральная машина (загрузка, стирка, выдача)
  shelves.js            — стеллажи (создание, размещение расходников; инструменты отклоняются)
  tool-panel.js         — настенная панель для инструментов (3 типизированных слота, крюки)
  diagnostics.js        — диагностика (мини-игры: фонендоскоп, рефлекс-молоток, риноскоп)
  staff.js              — система найма сотрудников (NPC, корзины для белья, зарплата)
  trash.js              — система мусора (спавн, модели, партиклы вони, мухи, уборка игроком/уборщиком)
  shift.js              — система смен (время, табличка, задачи, маскот, итоги дня)
  cashier.js            — касса и оплата
  tutorial.js           — пошаговый туториал (state machine, 25 шагов, 3D-стрелки, spotlight)
serve.mjs               — вспомогательный Node.js HTTP-сервер для локальной разработки
specs/
  specs-base.md         — этот файл (техническая база)
  specs-scene.md        — сцена, 3D модели, освещение
  specs-player.md       — игрок, управление, взаимодействие
  specs-patient.md      — пациенты, очереди, расходники, лечение
  specs-shift.md        — система смен, дней, итоги дня
.claude/launch.json     — конфигурация для preview-сервера
```

## Renderer
- WebGLRenderer, antialias
- Тени: PCFSoftShadowMap (зависит от настройки качества, см. Quality Settings)
- Tone mapping: ACESFilmicToneMapping, exposure 1.0
- **Все материалы** — `MeshLambertMaterial` (кроме эмиссивных: светильники, индикатор стиральной машины, прогресс-бар). Свойства `roughness`/`metalness` не используются

## Quality Settings (переключатель на стартовом экране)
Три уровня: Low / Medium / High. Сохраняется в `localStorage('graphicsQuality')`.

| Параметр | Low | Medium | High (default) |
|----------|-----|--------|----------------|
| pixelRatio | 1 | 1 | min(dpr, 2) |
| Post-processing | OFF (`renderer.render`) | ON (`composer.render`) | ON |
| Тени | OFF | DirectionalLight 512x512, BasicShadowMap | DirectionalLight 1024x1024, PCFSoftShadowMap |
| Fog far | 35 | 50 | 60 |

Переменная `useComposer` (boolean) переключает между `composer.render()` и `renderer.render()`.

## FPS Counter
Зелёный счётчик в правом верхнем углу (`#fps-counter`). Обновляется раз в секунду через `setInterval`. Использует `Game.FPS.frames` (инкрементируется в animate loop).

## Animation Loop (`animate(now)` в index.html)
- **FPS Lock**: 60 FPS. Пропускает кадры через timestamp-based лимитер: `if (now - lastFrameTime < 1000/60) return`
- **Delta clamped**: `Math.min(clock.getDelta(), 0.05)` — ограничение 50ms предотвращает телепортацию через стены при фризах/переключении вкладок

Каждый кадр (60fps):
1. `Game.Controls.update(delta)` — движение игрока (если pointer locked)
2. `Game.Interaction.update()` — централизованный рейкаст по всем модулям, определяет ближайший объект, кеширует hit-результаты
3. `Game.Patients.update(delta)` — спавн-таймер, движение пациентов, HP decay/recovery, анимации, лечебные частицы (пул 30 спрайтов), индикаторы/хелсбары, interaction
4. `Game.Consumables.update(delta)` — физика расходников + interaction
5. `Game.Staff.update(delta)` — NPC-сотрудники
6. `Game.Cashier.update(delta)` — касса, терминал, очередь оплаты

Каждый 2-й кадр (30fps, `delta * 2`):
7. `Game.Furniture.update(delta)` — перемещение мебели, interaction
8. `Game.WashingMachine.update(delta)` — стиральная машина
9. `Game.Shelves.update(delta)` — interaction стеллажей
10. `Game.ToolPanel.update(delta)` — interaction панели инструментов
11. `Game.Trash.update(delta)` — мусор
12. `Game.Shift.update(delta)` — время смены, hover таблички, задачи

Условно:
13. `Game.Tutorial.update(delta)` — только если `Game.Tutorial.isActive()`

Рендер: `composer.render()` или `renderer.render(scene, camera)` (зависит от `useComposer`)

## Оркестратор (`index.html` inline module)
Создаёт renderer, scene, camera, collidables[], composer (EffectComposer с RenderPass + OutlinePass + OutputPass). Вызывает `Game.World.setup()` (возвращает `sunLight`), `Game.Controls.setup()`, `Game.Furniture.setup()` + `registerExisting()`, `Game.WashingMachine.setup()`, `Game.Patients.setup()`, `Game.Consumables.setup()`, `Game.Inventory.setup()`, `Game.Shop.setup()`, `Game.Shelves.setup()`, `Game.ToolPanel.setup()`, `Game.Diagnostics.setup()`, `Game.Cashier.setup()`, `Game.Shift.setup()`, `Game.Tutorial.setup()`. Экспортирует `Game.Outline`, `Game.FPS`. Настраивает Quality Settings и FPS counter. Запускает animation loop с 60fps лимитом.

## Global State

### Оркестратор (index.html)
```js
scene, camera, renderer, clock   // Three.js core
composer                         // EffectComposer (RenderPass + OutlinePass + OutputPass)
collidables[]                    // массив объектов для коллизий
sunLight                         // DirectionalLight (для Quality Settings)
useComposer                      // boolean — рендер через composer или напрямую
Game.FPS = { frames: 0 }         // счётчик кадров для FPS counter
```

## DOM Element IDs
| ID | Тип | Назначение |
|----|-----|------------|
| `fps-counter` | div | Счётчик FPS (top-right, зелёный monospace) |
| `overlay` | div | Стартовый экран / пауза (+ кнопки качества графики) |
| `crosshair` | div | Прицел (CSS-крестик) |
| `interact-hint` | div | Динамическая подсказка под прицелом |
| `held-box-hint` | div | Подсказка при удержании коробки (ЛКМ/G) |
| `patient-popup` | div | Попап информации о пациенте |
| `popup-name` | h2 | Имя + фамилия |
| `popup-diagnosis` | span | Диагноз (или "????" при needsDiagnosis) |
| `popup-severity` | span | Тяжесть заболевания (цветной текст) |
| `popup-supply-icon` | span | Цветная иконка расходника (круг 14px) |
| `popup-supply` | span | Название расходника |
| `btn-bed` | button | Кнопка "На кровать" |
| `bed-count` | span | Счётчик свободных кроватей "(X/2)" внутри btn-bed |
| `btn-wait` | button | Кнопка "В зону ожидания" |
| `chair-count` | span | Счётчик свободных стульев "(X/3)" внутри btn-wait |
| `popup-instrument-hint` | div | Подсказка инструмента в попапе (при needsDiagnosis) |
| `outdoor-warning` | div | Предупреждение о мебели на улице (в попапе пациента) |
| `dirty-linen-warning` | div | Предупреждение о грязном белье на кроватях (в попапе пациента) |
| `shop-popup` | div | Попап магазина (табы: препараты + инструменты + мебель) |
| `shop-tabs` | div | Контейнер табов магазина |
| `shop-tab-consumables` | div | Секция препаратов |
| `shop-tab-instruments` | div | Секция инструментов |
| `shop-tab-furniture` | div | Секция мебели (кровать, стул) |
| `shop-close` | button | Кнопка закрытия магазина |
| `inventory-container` | div | Контейнер инвентаря + подсказки (создаётся динамически) |
| `inventory-active-name` | div | Название активного предмета над баром |
| `inventory-bar` | div | Панель слотов инвентаря (внутри контейнера) |
| `inventory-hints` | div | Подсказки "Q — Магазин", "G — Бросить" (внутри контейнера) |
| `notification` | div | Временное уведомление (создаётся динамически) |
| `diagnostics-overlay` | div | Overlay мини-игры диагностики |
| `diagnostics-canvas` | canvas | Игровой canvas (600×500) |
| `diagnostics-title` | div | Заголовок мини-игры |
| `diagnostics-controls` | div | Кнопки управления мини-игрой |
| `diagnostics-status` | div | Статус/инструкции мини-игры |
| `diagnostics-close` | button | Закрытие мини-игры |
| `time-hud` | div | HUD времени и дня (top center) |
| `day-value` | span | "День N" |
| `time-value` | span | "HH:MM" |
| `task-container` | div | Контейнер задачи с маскотом (bottom-left) |
| `task-mascot` | div | Портрет медсестры |
| `task-bubble` | div | Speech bubble |
| `task-text` | div | Текст задачи |
| `day-end-popup` | div | Попап итогов дня |
| `day-end-number` | span | Номер дня |
| `stat-served` | span | Вылечено |
| `stat-lost` | span | Потеряно |
| `stat-earned` | span | Заработано |
| `stat-spent` | span | Потрачено |
| `day-end-next` | button | Кнопка следующего дня |

## CSS Z-Index Layers
| z-index | Элемент |
|---------|---------|
| 5 | `#crosshair`, `#interact-hint`, `#inventory-container` |
| 10 | `#overlay` |
| 15 | `#notification` |
| 20 | `#patient-popup`, `#shop-popup`, `#cashier-popup`, `#day-end-popup` |
| 25 | `#diagnostics-overlay` |

## Centralized Interaction System (`Game.Interaction`, `js/interaction.js`)

Единый координатор рейкастов. Каждый кадр определяет **ближайший** интерактивный объект под прицелом, независимо от модуля.

### Архитектура
- Каждый модуль регистрирует свои меши через `Game.Interaction.register(name, getMeshesFn, recursive, maxDist)` в своём `setup()`
- Каждый кадр `Game.Interaction.update()` вызывается **до** всех модулей
- Для каждого зарегистрированного модуля вызывает `getMeshesFn()`, рейкастит, находит ближайший хит
- **Кеширование хитов**: результаты `intersectObjects` сохраняются в `hitResults[name]`. Модули используют `Game.Interaction.getHits(name)` вместо собственных рейкастов
- Модуль с ближайшим объектом побеждает → `Game.Interaction.isActive(name)` возвращает `true`
- **Приоритет furniture**: модуль `'furniture'` имеет пониженный приоритет. Если furniture победил по дистанции, но другой модуль тоже имеет хит — побеждает другой модуль. Это позволяет использовать объекты (кассу, стиралку, стеллажи), зарегистрированные одновременно как мебель и как свой модуль
- **Гистерезис**: при потере хита активный модуль удерживается ещё 4 кадра (`HOLD_MIN=4`) для предотвращения мерцания подсказок. Дополнительно: переключение с специализированного модуля на furniture тоже удерживается 4 кадра (предотвращает мерцание на границе maxDist)
- **Центральный сброс подсказки**: когда ни один модуль не активен, `Game.Interaction.update()` скрывает `#interact-hint`. Модули НЕ должны скрывать подсказку в своих early-return при `!isActive('myName')` — это вызывает мерцание из-за throttled-обновлений
- Каждый модуль проверяет `Game.Interaction.isActive('myName')` перед подсветкой/хинтом

### Зарегистрированные модули
| name | Модуль | recursive | maxDist |
|------|--------|-----------|---------|
| `'patients'` | Пациенты (отфильтрованные по state/animating) | true | 5 |
| `'washingMachine'` | Стиральная машина | true | 5 |
| `'furniture'` | Мебель (кроме carriedFurniture) | true | 5 |
| `'boxes'` | Коробки (grounded, !pickedUp) | true | 5 |
| `'consumables'` | Расходники на земле (grounded, !pickedUp) | true | 5 |
| `'cashier'` | Терминал кассы + пациент atCashier | false | 3 |
| `'shelvesItems'` | Предметы на стеллажах | false | 5 |
| `'shelvesPlace'` | Структура стеллажей (для размещения) | false | 5 |
| `'toolPanelItems'` | Инструменты на панели | false | 5 |
| `'toolPanelPlace'` | Структура панели (для размещения) | false | 5 |
| `'staff'` | Корзины с бельём | true | 5 |
| `'trash'` | Мусор | true | 5 |
| `'shift'` | Табличка смены | false | 5 |

### API
- `setup(THREE, camera, controls)` — инициализация
- `register(name, getMeshesFn, recursive, maxDist)` — регистрация модуля
- `update()` — центральный рейкаст (вызывается каждый кадр перед модулями), кеширует hit-результаты
- `isActive(name)` → boolean — этот модуль победил?
- `getActive()` → string|null — имя модуля-победителя
- `hasAny()` → boolean — есть ли хоть один объект под прицелом
- `getHits(name)` → hits[]|null — кешированные hit-результаты для модуля (модули используют вместо собственных рейкастов)
- `getRay()` → Raycaster — общий рейкастер (для модулей, которым нужен дополнительный рейкаст, напр. furniture placement)

### Принцип
Побеждает **ближайший к камере объект**, кроме furniture — он уступает любому другому модулю с хитом. `hasInteraction()` методы модулей остаются для click-блокировки.

Когда игрок держит коробку (`isHoldingBox()`), ЛКМ берёт из коробки, а не взаимодействует с другими системами.
Каждая система показывает подсказку `#interact-hint` только если `Game.Interaction.isActive('moduleName')` вернул `true`.

## Module API Reference

### `Game.Outline` (определён в оркестраторе `index.html`)
Централизованная система обводки объектов через OutlinePass (постпроцессинг). Все модули используют `Game.Outline` вместо прямого изменения emissive у материалов.
- `setHover(objects, color?)` — устанавливает обводку на массив объектов. `color` — опциональный hex (по умолчанию 0x00ff44 зелёный). Для красной обводки: 0xff2222
- `clearHover()` — убирает обводку со всех объектов

Параметры OutlinePass: `edgeStrength=5`, `edgeThickness=2`, `edgeGlow=0.5`.

### `Game.Interaction` (`js/interaction.js`)
Централизованный координатор рейкастов с кешированием и гистерезисом. Подробное описание — см. секцию "Centralized Interaction System" выше.
- `setup(THREE, camera, controls)` — инициализация
- `register(name, getMeshesFn, recursive, maxDist)` — регистрация модуля
- `update()` — центральный рейкаст каждый кадр, кеширует hit-результаты
- `isActive(name)` → boolean — модуль с ближайшим объектом?
- `getActive()` → string|null — имя модуля-победителя
- `hasAny()` → boolean — есть объект под прицелом?
- `getHits(name)` → hits[]|null — кешированные hit-результаты
- `getRay()` → Raycaster — общий рейкастер

### `Game.Helpers` (`js/helpers.js`)
Утилиты для построения сцены. Все функции принимают `THREE`, `scene`, `collidables` первыми аргументами.
- `createWall(THREE, scene, collidables, x, z, w, d, opts)` — стена с коллизией
- `createSign(THREE, scene, text, x, y, z, rotY)` — табличка (Canvas texture на PlaneGeometry)
- `createTileTexture(THREE)` / `createAsphaltTexture(THREE)` / `createGrassTexture(THREE)` — процедурные текстуры

### `Game.World` (`js/world.js`)
Построение всей сцены. Использует `Game.Helpers` внутри.
- `setup(THREE, scene, collidables)` — строит здание, мебель, улицу, освещение. Возвращает `{ beds, waitingChairs, cashierDesk, bedMeshes, chairMeshes, sunLight }`
- Внутренние функции (не экспортируются): `createChair`, `createBed`, `createBench`, `createTree`, `addLight`

### `Game.Controls` (`js/controls.js`)
Управление игроком: WASD, коллизии, pointer lock.
- `setup(THREE, camera, collidables, PointerLockControls)` — инициализация, возвращает `PointerLockControls` instance
- `update(delta)` — обновление позиции камеры (вызывать только при `controls.isLocked`). Восстанавливает сохранённый quaternion после re-lock для предотвращения camera jump
- **Камера**: PointerLockControls обрабатывает мышь напрямую (без сглаживания). Фильтр больших delta (>150px) для защиты от бага Pointer Lock API
- **Перемещение**: velocity-based с экспоненциальным затуханием (`_moveDamping=12.0`). Плавные разгон и торможение вместо мгновенной установки позиции. При столкновении velocity обнуляется
- Внутренние: `_canMove(direction)`, `_keys`, `_moveSpeed=4.0`, `_sprintSpeed=7.0`, `_collisionDistance=0.4`, `_velocityX/Z` (текущая скорость), `_moveDamping=12.0`, `_collisionOrigin` (Vector3 для рейкаста от y=0.5), `_savedQuat` (сохранённый quaternion при re-lock)
- Unlock handler не показывает overlay если открыт магазин (`Game.Shop.isOpen()`), попап пациента (`Game.Patients.isPopupOpen()`), диагностика (`Game.Diagnostics.isActive()`) или попап итогов дня (`Game.Shift.isPopupOpen()`)

### `Game.Consumables` (`js/consumables.js`)
- `setup(THREE, scene, camera, controls, collidables)` — инициализация, создание зоны доставки
- `update(delta)` — 3D физика + interaction raycast (препараты и коробки)
- `createMesh(type)` — создать 3D модель препарата (Group)
- `spawnInDeliveryZone(type)` — спавн расходника в зоне доставки
- `spawnBoxInDeliveryZone(type)` — спавн коробки (10 штук) в зоне доставки
- `dropFromPlayer(type)` — бросить расходник вперёд от камеры
- `countGroundItems(type)` → number — количество предметов данного типа на земле (!pickedUp)
- `countBoxItems(type)` → number — количество предметов в коробках (ground + held)
- `hasInteraction()` → boolean — наведён на препарат
- `hasBoxInteraction()` → boolean — наведён на коробку
- `isHoldingBox()` → boolean — держит коробку в руках
- `isInstrument(type)` → boolean — тип начинается с `instrument_`
- `isLinen(type)` → boolean — тип `linen_clean` или `linen_dirty`
- `spawnInstrumentInDeliveryZone(type)` — спавн инструмента в зоне доставки
- `spawnAtPosition(type, position)` — спавн расходника в конкретной позиции
- `TYPES` — объект с описанием типов расходников
- `INSTRUMENT_TYPES` — объект с описанием типов инструментов

### `Game.Inventory` (`js/inventory.js`)
- `setup()` — создание UI (контейнер + бар + подсказки), привязка клавиш
- `addItem(type)` → boolean — стакает препараты в существующий слот, инструменты не стакаются
- `removeActive()` → type|null — уменьшает count на 1, обнуляет слот при 0
- `getActive()` → type|null
- `getActiveIndex()` → number
- `isFull()` → boolean
- `countType(type)` → number — суммарное количество предметов типа (сумма count по слотам)
- `setMaxStack(n)` — установить макс. размер стака
- `getMaxStack()` → number — текущий макс. размер стака
- `showNotification(text, color)` — временное уведомление

### `Game.Shop` (`js/shop.js`)
- `setup(controls)` — привязка UI, клавиша Q
- `isOpen()` → boolean

### `Game.Furniture` (`js/furniture.js`)
Система мебели: покупка, перемещение, размещение, indoor/outdoor статус, динамические слоты пациентов.
- `setup(THREE, scene, camera, controls, collidables)` — инициализация, raycaster, E key binding
- `registerExisting(bedMeshes, chairMeshes)` — регистрация начальной мебели из World.setup()
- `update(delta)` — обновление каждый кадр (перенос, interaction raycast, outline валидации)
- `spawnFurniture(type)` — создание мебели в зоне доставки ('bed' | 'chair')
- `getIndoorBeds()` → slot[] — слоты indoor кроватей `{ pos, occupied }`
- `getIndoorChairs()` → slot[] — слоты indoor стульев
- `getAllBeds()` / `getAllChairs()` → slot[] — все слоты (для подсчёта maxQueue)
- `getOutdoorBedCount()` / `getOutdoorChairCount()` → number — количество outdoor мебели
- `isBedSlot(slot)` → boolean — проверка: слот принадлежит кровати
- `markBedDirty(slot)` — пометить кровать как грязную (создать overlay)
- `markBedClean(slot)` — пометить кровать как чистую (удалить overlay)
- `isBedDirty(slot)` → boolean — грязная ли кровать
- `getDirtyBedCount()` → number — количество грязных indoor кроватей
- `tryLinenReplace()` → boolean — попытка замены белья (вызывается при ЛКМ)
- `hasInteraction()` → boolean — наведён на мебель
- `isCarrying()` → boolean — переносит мебель
- `TYPES` — описание типов мебели `{ bed: {name, price, slotOffset}, chair: {...} }`

### `Game.WashingMachine` (`js/washing-machine.js`)
Стиральная машина: загрузка грязного белья, стирка, выдача чистого в корзину.
- `setup(THREE, scene, camera, controls, collidables)` — инициализация, создание 3D модели, raycaster, event listeners
- `update(delta)` — interaction raycast, обновление таймера стирки, анимация барабана
- `hasInteraction()` → boolean — наведён на машину
- `isWashing()` → boolean — идёт стирка
- `getLoadedCount()` → number — количество загруженного грязного белья
- По завершении стирки чистое бельё добавляется в корзину "ЧИСТОЕ" через `Game.Staff.addToBasket()`

### `Game.Shelves` (`js/shelves.js`)
- `setup(THREE, scene, camera, controls, collidables)` — создание стеллажей
- `update(delta)` — interaction raycast
- `hasInteraction()` → boolean
- `getShelves()` → shelf[] — массив стеллажей
- `findSlotWithItem(type)` → slot|null — найти слот с предметом данного типа
- `takeFromSlot(slot)` → type|null — забрать предмет из слота
- `placeOnAnyShelf(type)` → boolean — положить на первый свободный стеллаж (**инструменты отклоняются**, возвращает false)
- При попытке положить инструмент (E) — уведомление "Инструменты вешайте на панель"

### `Game.ToolPanel` (`js/tool-panel.js`)
Настенная панель для инструментов. Деревянная доска с рамкой и металлическими крюками, висит на стене рядом со стеллажами (x=-3.0, z=-11.85). 3 типизированных слота — каждый под конкретный инструмент. Табличка "ИНСТРУМЕНТЫ" на стене.
- `setup(THREE, scene, camera, controls, collidables)` — создание панели, крюков, подписей
- `update(delta)` — interaction raycast
- `hasInteraction()` → boolean
- `findSlot(type)` → slot|null — найти слот с инструментом данного типа
- `takeFromSlot(slot)` → type|null — снять инструмент с крюка
- `placeItem(type)` → boolean — повесить инструмент на его крюк
- `getPosition()` → {x, z} — координаты панели (для навигации персонала)
- `getSlots()` → slot[] — массив слотов

### `Game.Diagnostics` (`js/diagnostics.js`)
Мини-игры диагностики: фонендоскоп, рефлекс-молоток, риноскоп.
- `setup(controls)` — инициализация overlay, привязка событий
- `startMinigame(patient, instrumentType)` — запуск мини-игры, unlock controls, показ overlay
- `isActive()` → boolean — активна ли мини-игра
- `update(delta)` — обновление (мини-игра использует свой RAF loop)

### `Game.Staff` (`js/staff.js`)
Система найма сотрудников: NPC-помощники, корзины для белья, зарплата.
- `setup(THREE, scene, camera, controls, collidables)` — инициализация, создание корзин
- `update(delta)` — обновление всех сотрудников, прогресс-бары, корзины
- `hire(type)` — нанять (max 1 на тип)
- `fire(staffId)` — уволить (выплата зарплаты за день)
- `getHiredStaff()` → массив нанятых
- `getDailySalary()` → число (сумма зарплат)
- `isStaffCashierHired()` → boolean
- `isTypeHired(type)` → boolean
- `isPatientBeingDiagnosed(patient)` → boolean
- `isPatientBeingTreated(patient)` → boolean
- `hasBasketInteraction()` → boolean

### `Game.Trash` (`js/trash.js`)
Система мусора: спавн внутри больницы, 3D-модели, партиклы вони, мухи, уборка.
- `setup(THREE, scene, camera, controls, collidables)` — инициализация, привязка ЛКМ-обработчика
- `update(delta)` — спавн мусора, обновление взаимодействия, партиклов, мух
- `hasInteraction()` → boolean — курсор на мусоре
- `getTrashItems()` → массив мешей мусора
- `getCount()` → число мусора на полу
- `removeTrash(mesh)` → boolean — удалить конкретный мусор (для уборщика)
- `findNearest(fromPos)` → mesh|null — ближайший мусор (для уборщика)

### `Game.Shift` (`js/shift.js`)
Система смен и дней: время, табличка Open/Closed, задачи с маскотом, попап итогов дня.
- `setup(THREE, scene, camera, controls, collidables)` — инициализация, создание 3D таблички, рисование маскота
- `update(delta)` — обновление времени, hover-детекция, задачи
- `isOpen()` → boolean — смена активна (пациенты могут приходить)
- `isPopupOpen()` → boolean — попап итогов дня открыт
- `hasInteraction()` → boolean — hover на табличке
- `trackEarning(amount)` / `trackSpending(amount)` — статистика дохода/расхода
- `trackPatientServed()` / `trackPatientLost()` — статистика пациентов

### `Game.Cashier` (`js/cashier.js`)
Касса и оплата.
- `setup(THREE, scene, camera, controls, cashierDesk)` — инициализация
- `update(delta)` — hover-детекция, очередь
- `isPopupOpen()` → boolean
- `hasInteraction()` → boolean
- `hasPatients()` → boolean — есть ли пациенты на кассе/в очереди
- `getBalance()` → number
- `spend(amount)` — списание
- `addPatientToQueue(patient)` — добавить в очередь
- `clearQueue()` — очистка очереди (при переходе между днями)

### `Game.Patients` (`js/patients.js`)
Система пациентов: спавн, очередь, движение, взаимодействие, лечение, UI попапа.
- `setup(THREE, scene, camera, controls, beds, waitingChairs)` — инициализация, привязка UI
- `update(delta)` — обновление каждый кадр (спавн-таймер, движение, анимации, индикаторы, interaction raycast)
- `hasInteraction()` → boolean — есть ли наведённый пациент или открытый попап
- `isPopupOpen()` → boolean — открыт ли попап пациента
- `getPatientCount()` → number — общее количество пациентов
- `getActivePatientCount()` → number — пациенты кроме state='leaving'
- `spawnFirstPatient()` — спавн первого пациента (заходит пешком)
- `clearAll()` — удаление всех пациентов и частиц со сцены
- `getHoveredPatient()` → patient|null — текущий пациент под прицелом
- `revealDiagnosis(patient)` — раскрытие диагноза после успешной мини-игры
- Внутренние функции: `createPatientMesh`, `spawnPatient`, `getQueuePosition`, `updateQueueTargets`, `removeFromQueue`, `highlightPatient`/`unhighlightPatient`, `getPatientFromMesh`, `updateInteraction`, `openPopup`/`closePopup`, `sendPatient`, `updatePatients`, `moveToward`, `randomFrom`, `createBedIndicator`, `updateIndicators`, `treatPatient`, `wrongTreatment`, `removePatient`, `updateAnimations`, `createHealthBar`, `updateHealthBarTexture`, `getHealthColor`, `updateHealthTimers`, `initParticlePool`, `spawnHealParticle`, `updateHealParticles`
- **Частицы лечения**: пул из 30 спрайтов (`PARTICLE_POOL_SIZE=30`), пре-аллоцируются в `initParticlePool()`. Swap-with-last removal (O(1)). Спрайты скрываются (`visible=false`) вместо удаления из сцены
- **Анимации**: emissive меняется напрямую на материале (без `.clone()`), сбрасывается после завершения анимации
