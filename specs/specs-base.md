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
- `Game.Shelves` — стеллажи (создание, размещение расходников)

Порядок загрузки: helpers → world → patients → controls → consumables → inventory → shop → shelves → inline module (оркестратор).

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
  shop.js               — магазин расходников (попап, покупка, доставка)
  shelves.js            — стеллажи (создание, размещение расходников)
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
3. `Game.Consumables.update(delta)` — физика расходников + interaction raycast
4. `Game.Shelves.update(delta)` — interaction raycast стеллажей
5. `renderer.render(scene, camera)`

## Оркестратор (`index.html` inline module)
Создаёт renderer, scene, camera, collidables[]. Вызывает `Game.World.setup()`, `Game.Controls.setup()`, `Game.Patients.setup()`, `Game.Consumables.setup()`, `Game.Inventory.setup()`, `Game.Shop.setup()`, `Game.Shelves.setup()`. Запускает animation loop.

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
| `patient-popup` | div | Попап информации о пациенте |
| `popup-name` | h2 | Имя + фамилия |
| `popup-symptom` | span | Симптом |
| `popup-diagnosis` | span | Диагноз |
| `popup-severity` | span | Тяжесть заболевания (цветной текст) |
| `popup-supply-icon` | span | Цветная иконка расходника (круг 14px) |
| `popup-supply` | span | Название расходника |
| `btn-bed` | button | Кнопка "На кровать" |
| `bed-count` | span | Счётчик свободных кроватей "(X/2)" внутри btn-bed |
| `btn-wait` | button | Кнопка "В зону ожидания" |
| `chair-count` | span | Счётчик свободных стульев "(X/3)" внутри btn-wait |
| `shop-popup` | div | Попап магазина расходников |
| `shop-close` | button | Кнопка закрытия магазина |
| `inventory-container` | div | Контейнер инвентаря + подсказки (создаётся динамически) |
| `inventory-bar` | div | Панель слотов инвентаря (внутри контейнера) |
| `inventory-hints` | div | Подсказки "Q — Магазин", "G — Бросить" (внутри контейнера) |
| `notification` | div | Временное уведомление (создаётся динамически) |

## CSS Z-Index Layers
| z-index | Элемент |
|---------|---------|
| 5 | `#crosshair`, `#interact-hint`, `#inventory-container` |
| 10 | `#overlay` |
| 15 | `#notification` |
| 20 | `#patient-popup`, `#shop-popup` |

## Interaction Priority Chain
Каждый кадр проверки выполняются по приоритету:
1. **Пациенты** — `Game.Patients.hasInteraction()` / `isPopupOpen()`
2. **Расходники** — `Game.Consumables.hasInteraction()`
3. **Стеллажи** — `Game.Shelves.hasInteraction()`

Каждая система показывает подсказку `#interact-hint` только если системы с более высоким приоритетом неактивны.

## Module API Reference

### `Game.Helpers` (`js/helpers.js`)
Утилиты для построения сцены. Все функции принимают `THREE`, `scene`, `collidables` первыми аргументами.
- `createWall(THREE, scene, collidables, x, z, w, d, opts)` — стена с коллизией
- `createSign(THREE, scene, text, x, y, z, rotY)` — табличка (Canvas texture на PlaneGeometry)
- `createTileTexture(THREE)` / `createAsphaltTexture(THREE)` / `createGrassTexture(THREE)` — процедурные текстуры

### `Game.World` (`js/world.js`)
Построение всей сцены. Использует `Game.Helpers` внутри.
- `setup(THREE, scene, collidables)` — строит здание, мебель, улицу, освещение. Возвращает `{ beds, waitingChairs }`
- Внутренние функции (не экспортируются): `createChair`, `createBed`, `createBench`, `createTree`, `addLight`

### `Game.Controls` (`js/controls.js`)
Управление игроком: WASD, коллизии, pointer lock.
- `setup(THREE, camera, collidables, PointerLockControls)` — инициализация, возвращает `PointerLockControls` instance
- `update(delta)` — обновление позиции камеры (вызывать только при `controls.isLocked`). Восстанавливает сохранённый quaternion после re-lock для предотвращения camera jump
- Внутренние: `_canMove(direction)`, `_keys`, `_moveSpeed=4.0`, `_collisionDistance=0.4`, `_collisionOrigin` (Vector3 для рейкаста от y=0.5), `_savedQuat` (сохранённый quaternion при re-lock)
- Unlock handler не показывает overlay если открыт магазин (`Game.Shop.isOpen()`) или попап пациента (`Game.Patients.isPopupOpen()`)

### `Game.Consumables` (`js/consumables.js`)
- `setup(THREE, scene, camera, controls, collidables)` — инициализация, создание зоны доставки
- `update(delta)` — 3D физика + interaction raycast
- `spawnInDeliveryZone(type)` — спавн расходника в зоне доставки
- `dropFromPlayer(type)` — бросить расходник вперёд от камеры
- `countGroundItems(type)` → number — количество предметов данного типа на земле (!pickedUp)
- `hasInteraction()` → boolean
- `TYPES` — объект с описанием типов расходников

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

### `Game.Shelves` (`js/shelves.js`)
- `setup(THREE, scene, camera, controls, collidables)` — создание стеллажей
- `update(delta)` — interaction raycast
- `hasInteraction()` → boolean

### `Game.Patients` (`js/patients.js`)
Система пациентов: спавн, очередь, движение, взаимодействие, лечение, UI попапа.
- `setup(THREE, scene, camera, controls, beds, waitingChairs)` — инициализация, привязка UI, спавн первого пациента
- `update(delta)` — обновление каждый кадр (спавн-таймер, движение, анимации, индикаторы, interaction raycast)
- `hasInteraction()` → boolean — есть ли наведённый пациент или открытый попап
- `isPopupOpen()` → boolean — открыт ли попап пациента
- `getHoveredPatient()` → patient|null — текущий пациент под прицелом
- Внутренние функции: `createPatientMesh`, `spawnPatient`, `getQueuePosition`, `updateQueueTargets`, `removeFromQueue`, `highlightPatient`/`unhighlightPatient`, `getPatientFromMesh`, `updateInteraction`, `openPopup`/`closePopup`, `sendPatient`, `updatePatients`, `moveToward`, `randomFrom`, `createBedIndicator`, `updateIndicators`, `treatPatient`, `wrongTreatment`, `removePatient`, `updateAnimations`, `createHealthBar`, `updateHealthBarTexture`, `getHealthColor`, `updateHealthTimers`, `spawnHealParticle`, `createParticleSprite`, `updateHealParticles`
