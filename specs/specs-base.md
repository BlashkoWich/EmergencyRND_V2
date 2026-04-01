# EmergencyRND V2 — Техническая база

## IMPORTANT: No Testing
**НИКОГДА не тестировать при разработке — ни в браузере, ни иным способом.** Вся необходимая информация для реализации фичей содержится в spec-файлах: координаты, структуры данных, DOM-элементы, состояния, z-index слои. Любое тестирование запрещено — пиши код, опираясь исключительно на спецификацию.

## Overview
3D веб-игра от первого лица в стилистике частной клиники. Открывается напрямую в браузере (`file://`) без сборки и сервера.

## Tech Stack
- **Three.js r0.164.1** — через CDN (import map, jsDelivr)
- **PointerLockControls** — из Three.js addons
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
- `Game.Furniture` — система мебели (покупка, перемещение, indoor/outdoor, динамические слоты)
- `Game.Shelves` — стеллажи (создание, размещение расходников)
- `Game.Diagnostics` — мини-игры диагностики (фонендоскоп, рефлекс-молоток, риноскоп)

Порядок загрузки: helpers → world → patients → controls → consumables → inventory → shop → furniture → shelves → diagnostics → cashier → inline module (оркестратор).

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
  furniture.js          — система мебели (покупка, перемещение, indoor/outdoor, динамические слоты)
  shelves.js            — стеллажи (создание, размещение расходников)
  diagnostics.js        — диагностика (мини-игры: фонендоскоп, рефлекс-молоток, риноскоп)
serve.mjs               — вспомогательный Node.js HTTP-сервер для локальной разработки
specs/
  specs-base.md         — этот файл (техническая база)
  specs-scene.md        — сцена, 3D модели, освещение
  specs-player.md       — игрок, управление, взаимодействие
  specs-patient.md      — пациенты, очереди, расходники, лечение
.claude/launch.json     — конфигурация для preview-сервера
```

## Renderer
- WebGLRenderer, antialias
- Тени: PCFSoftShadowMap
- Tone mapping: ACESFilmicToneMapping, exposure 1.0

## Animation Loop (`animate()` в index.html)
- **Delta clamped**: `Math.min(clock.getDelta(), 0.05)` — ограничение 50ms предотвращает телепортацию через стены при фризах/переключении вкладок
- **PixelRatio capped**: `Math.min(window.devicePixelRatio, 2)` — снижает нагрузку GPU на высоких DPI

Каждый кадр:
1. `Game.Controls.update(delta)` — движение игрока (если pointer locked)
2. `Game.Patients.update(delta)` — спавн-таймер, движение пациентов, HP decay/recovery, анимации, лечебные частицы, индикаторы/хелсбары, interaction raycast
3. `Game.Furniture.update(delta)` — перемещение мебели, interaction raycast, outline валидации размещения
4. `Game.Consumables.update(delta)` — физика расходников + interaction raycast
5. `Game.Shelves.update(delta)` — interaction raycast стеллажей
6. `Game.Cashier.update(delta)` — касса, терминал, очередь оплаты
6. `renderer.render(scene, camera)`

## Оркестратор (`index.html` inline module)
Создаёт renderer, scene, camera, collidables[]. Вызывает `Game.World.setup()`, `Game.Controls.setup()`, `Game.Furniture.setup()` + `registerExisting()`, `Game.Patients.setup()`, `Game.Consumables.setup()`, `Game.Inventory.setup()`, `Game.Shop.setup()`, `Game.Shelves.setup()`. Запускает animation loop.

## Global State

### Оркестратор (index.html)
```js
scene, camera, renderer, clock   // Three.js core
collidables[]                    // массив объектов для коллизий
```

## DOM Element IDs
| ID | Тип | Назначение |
|----|-----|------------|
| `overlay` | div | Стартовый экран / пауза |
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

## CSS Z-Index Layers
| z-index | Элемент |
|---------|---------|
| 5 | `#crosshair`, `#interact-hint`, `#inventory-container` |
| 10 | `#overlay` |
| 15 | `#notification` |
| 20 | `#patient-popup`, `#shop-popup`, `#cashier-popup` |
| 25 | `#diagnostics-overlay` |

## Interaction Priority Chain
Каждый кадр проверки выполняются по приоритету:
1. **Пациенты** — `Game.Patients.hasInteraction()` / `isPopupOpen()`
2. **Мебель** — `Game.Furniture.hasInteraction()` / `isCarrying()` (E для подъёма/размещения)
3. **Коробки** — `Game.Consumables.hasBoxInteraction()` (E для подбора)
4. **Расходники** — `Game.Consumables.hasInteraction()` (ЛКМ для подбора)
5. **Стеллажи** — `Game.Shelves.hasInteraction()`
6. **Касса** — `Game.Cashier.hasInteraction()`

Когда игрок держит коробку (`isHoldingBox()`), ЛКМ берёт из коробки, а не взаимодействует с другими системами.
Каждая система показывает подсказку `#interact-hint` только если системы с более высоким приоритетом неактивны.

## Module API Reference

### `Game.Helpers` (`js/helpers.js`)
Утилиты для построения сцены. Все функции принимают `THREE`, `scene`, `collidables` первыми аргументами.
- `createWall(THREE, scene, collidables, x, z, w, d, opts)` — стена с коллизией
- `createSign(THREE, scene, text, x, y, z, rotY)` — табличка (Canvas texture на PlaneGeometry)
- `createTileTexture(THREE)` / `createAsphaltTexture(THREE)` / `createGrassTexture(THREE)` — процедурные текстуры

### `Game.World` (`js/world.js`)
Построение всей сцены. Использует `Game.Helpers` внутри.
- `setup(THREE, scene, collidables)` — строит здание, мебель, улицу, освещение. Возвращает `{ beds, waitingChairs, cashierDesk, bedMeshes, chairMeshes }`
- Внутренние функции (не экспортируются): `createChair`, `createBed`, `createBench`, `createTree`, `addLight`

### `Game.Controls` (`js/controls.js`)
Управление игроком: WASD, коллизии, pointer lock.
- `setup(THREE, camera, collidables, PointerLockControls)` — инициализация, возвращает `PointerLockControls` instance
- `update(delta)` — обновление позиции камеры (вызывать только при `controls.isLocked`). Восстанавливает сохранённый quaternion после re-lock для предотвращения camera jump
- Внутренние: `_canMove(direction)`, `_keys`, `_moveSpeed=4.0`, `_collisionDistance=0.4`, `_collisionOrigin` (Vector3 для рейкаста от y=0.5), `_savedQuat` (сохранённый quaternion при re-lock)
- Unlock handler не показывает overlay если открыт магазин (`Game.Shop.isOpen()`), попап пациента (`Game.Patients.isPopupOpen()`) или диагностика (`Game.Diagnostics.isActive()`)

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
- `spawnInstrumentInDeliveryZone(type)` — спавн инструмента в зоне доставки
- `TYPES` — объект с описанием типов расходников
- `INSTRUMENT_TYPES` — объект с описанием типов инструментов

### `Game.Inventory` (`js/inventory.js`)
- `setup()` — создание UI (контейнер + бар + подсказки), привязка клавиш
- `addItem(type)` → boolean
- `removeActive()` → type|null
- `getActive()` → type|null
- `getActiveIndex()` → number
- `isFull()` → boolean
- `countType(type)` → number — количество предметов типа в инвентаре
- `showNotification(text)` — временное уведомление

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
- `hasInteraction()` → boolean — наведён на мебель
- `isCarrying()` → boolean — переносит мебель
- `TYPES` — описание типов мебели `{ bed: {name, price, slotOffset}, chair: {...} }`

### `Game.Shelves` (`js/shelves.js`)
- `setup(THREE, scene, camera, controls, collidables)` — создание стеллажей
- `update(delta)` — interaction raycast
- `hasInteraction()` → boolean

### `Game.Diagnostics` (`js/diagnostics.js`)
Мини-игры диагностики: фонендоскоп, рефлекс-молоток, риноскоп.
- `setup(controls)` — инициализация overlay, привязка событий
- `startMinigame(patient, instrumentType)` — запуск мини-игры, unlock controls, показ overlay
- `isActive()` → boolean — активна ли мини-игра
- `update(delta)` — обновление (мини-игра использует свой RAF loop)

### `Game.Patients` (`js/patients.js`)
Система пациентов: спавн, очередь, движение, взаимодействие, лечение, UI попапа.
- `setup(THREE, scene, camera, controls, beds, waitingChairs)` — инициализация, привязка UI, спавн первого пациента
- `update(delta)` — обновление каждый кадр (спавн-таймер, движение, анимации, индикаторы, interaction raycast)
- `hasInteraction()` → boolean — есть ли наведённый пациент или открытый попап
- `isPopupOpen()` → boolean — открыт ли попап пациента
- `getHoveredPatient()` → patient|null — текущий пациент под прицелом
- `revealDiagnosis(patient)` — раскрытие диагноза после успешной мини-игры
- Внутренние функции: `createPatientMesh`, `spawnPatient`, `getQueuePosition`, `updateQueueTargets`, `removeFromQueue`, `highlightPatient`/`unhighlightPatient`, `getPatientFromMesh`, `updateInteraction`, `openPopup`/`closePopup`, `sendPatient`, `updatePatients`, `moveToward`, `randomFrom`, `createBedIndicator`, `updateIndicators`, `treatPatient`, `wrongTreatment`, `removePatient`, `updateAnimations`, `createHealthBar`, `updateHealthBarTexture`, `getHealthColor`, `updateHealthTimers`, `spawnHealParticle`, `createParticleSprite`, `updateHealParticles`
