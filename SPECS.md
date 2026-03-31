# EmergencyRND V2 — Project Specs

## IMPORTANT: No Testing
**НИКОГДА не тестировать при разработке — ни в браузере, ни иным способом.** Вся необходимая информация для реализации фичей содержится в этом файле: координаты, структуры данных, DOM-элементы, состояния, z-index слои. Любое тестирование запрещено — пиши код, опираясь исключительно на спецификацию.

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
- `Game.Patients` — система пациентов (спавн, очередь, движение, UI)
- `Game.Controls` — управление (WASD, коллизии, pointer lock)

Порядок загрузки: helpers → world → patients → controls → inline module (оркестратор).

## File Structure
```
index.html              — HTML + importmap + module-оркестратор (~100 строк)
styles.css              — вся CSS-стилизация UI
js/
  helpers.js            — createWall, createSign, процедурные текстуры
  world.js              — здание, мебель, уличная среда, освещение
  patients.js           — система пациентов (данные, спавн, движение, UI попапа)
  controls.js           — WASD, коллизии, pointer lock
serve.mjs               — вспомогательный Node.js HTTP-сервер для локальной разработки
SPECS.md                — этот файл
.claude/launch.json     — конфигурация для preview-сервера
```

## Controls
- **WASD** — движение (через `e.code`, работает на любой раскладке)
- **Мышь** — вращение камеры (Pointer Lock API, `pointerSpeed = 0.5`)
- **ЛКМ** — взаимодействие с пациентом (при наведении прицелом)
- **ESC** — пауза (разблокировка курсора, показ overlay)
- Скорость движения: `4.0` ед/сек
- Высота камеры: `1.6` (фиксирована, нет прыжков)

## Scene Layout

### Building (clinic interior)
- Размер: 16x12 (x: -8..8, z: -12..0)
- Стены толщиной 0.2, высота 3.0
- Вход: южная стена (z=0), проём шириной 2.4 (x: -1.2..1.2)
- Потолок только над зданием (y=3.05)
- Пол: процедурная плитка (Canvas texture)
- Освещение: сетка PointLight + fixture-боксы (флуоресцентный стиль)

### Furniture
- **Ресепшн-стойка** — у задней стенки (z=-10.5), составная: столешница + передняя панель (z=-10.0) + боковины (x: -1.5, 1.5)
- **3 стула** — вдоль восточной стены (x=6.5, z: -2, -3.2, -4.4), лицом к центру, rotY = -π/2
- **2 медицинские кровати** — у западной стены (x=-5.5, z: -7, -9), каркас + матрас + подушка + спинка, rotY = 0
- Все объекты добавлены в `collidables[]`

### Signs
- "ЧАСТНАЯ КЛИНИКА" — над входом (z=0.15)
- "ЗОНА ОЖИДАНИЯ" — на восточной стене (x=7.88) у стульев
- "СМОТРОВАЯ" — на западной стене (x=-7.88) у кроватей

### Outdoor
- Асфальт (процедурная текстура, 60x60, z=24)
- Газоны по бокам (x=-20 и x=20)
- 6 деревьев (CylinderGeometry ствол + SphereGeometry крона)
- 2 скамейки у входа (x=-4 и x=4, z=2)
- Небо: `scene.background = 0x87ceeb`
- HemisphereLight (небо/земля) + DirectionalLight (солнце, тени 2048x2048)
- Fog: `(0x87ceeb, 25, 60)`

### Lighting
- **Indoor**: AmbientLight(0.3) + сетка PointLight (x: -6..6 шаг 4, z: -10..-2 шаг 4)
- **Outdoor**: HemisphereLight(0.6) + DirectionalLight(1.2)

## Collision System
- Raycasting по 2 осям (X, Z) независимо — скольжение вдоль стен
- `collisionDistance = 0.4`
- Массив `collidables[]` содержит стены, мебель, невидимые collision-боксы
- Деревья имеют collision-цилиндры
- Пациенты **не** добавлены в `collidables[]` (игрок проходит сквозь них)

## Player
- Стартовая позиция: `(0, 1.6, -11)` (за ресепшн-стойкой)
- Камера: PerspectiveCamera, FOV 70, near 0.1, far 100

## Renderer
- WebGLRenderer, antialias
- Тени: PCFSoftShadowMap
- Tone mapping: ACESFilmicToneMapping, exposure 1.0

## UI Elements (HTML/CSS overlay)

### Crosshair (`#crosshair`)
- Белый крестик в центре экрана (CSS pseudo-elements `::before`/`::after`)
- Размер 24x24px, z-index: 5
- Виден только при активном Pointer Lock

### Interaction Hint (`#interact-hint`)
- Текст "Нажмите ЛКМ для взаимодействия" под прицелом
- Позиция: `top: calc(50% + 30px)`, z-index: 5
- Виден при наведении прицела на пациента в очереди

### Patient Popup (`#patient-popup`)
- Модальное окно по центру экрана, z-index: 20
- Фон: `#1a2a3a`, текст: `#e0e8f0`, border-radius: 12px
- Содержит: имя (`h2`), симптом, причина, расходник (`.info-row` с `span` для значений)
- Две кнопки с количеством свободных мест:
  - **"На кровать (X/2)"** (`#btn-bed`) — зелёная (#2a8a5a), отправляет к кровати. `#bed-count` span показывает `(свободно/всего)`
  - **"В зону ожидания (X/3)"** (`#btn-wait`) — серо-синяя (#5a7a9a), отправляет к стулу. `#chair-count` span показывает `(свободно/всего)`
- Кнопки блокируются (disabled + opacity 0.4) если мест нет

### Overlay (`#overlay`)
- Начальный экран с инструкциями, z-index: 10
- Клик → `controls.lock()`, скрывается при lock

## Patient System

### Patient Data Pools
```
NAMES:    20 русских имён (10 муж + 10 жен)
SURNAMES: 20 русских фамилий (10 муж + 10 жен)
SYMPTOMS: 10 вариантов (головная боль, кашель, температура, тошнота и т.д.)
CAUSES:   10 вариантов (переохлаждение, инфекция, стресс, отравление и т.д.)
SUPPLIES: 10 вариантов (бинт, антисептик, шприц, капельница и т.д.)
```

### Patient Object Structure
```js
{
  id: number,              // автоинкремент
  name: string,            // из NAMES
  surname: string,         // из SURNAMES
  symptom: string,         // из SYMPTOMS
  cause: string,           // из CAUSES
  supply: string,          // из SUPPLIES
  mesh: THREE.Group,       // 3D-модель
  state: string,           // 'queued' | 'interacting' | 'walking' | 'atBed' | 'waiting'
  targetPos: Vector3|null, // целевая позиция при walking
  queueTarget: Vector3|null, // позиция в очереди
  destination: object|null // ссылка на слот beds[] или waitingChairs[]
}
```

### Patient States
| Состояние     | Описание |
|---------------|----------|
| `queued`      | В очереди, движется к `queueTarget`, доступен для взаимодействия |
| `interacting` | Попап открыт для этого пациента |
| `walking`     | Идёт к кровати или стулу (`targetPos`) |
| `atBed`       | Лежит на кровати |
| `waiting`     | Сидит в зоне ожидания |

### Patient 3D Model
- `THREE.Group` с дочерними мешами:
  - **Body**: BoxGeometry(0.4, 0.7, 0.25), случайный цвет из `BODY_COLORS` (7 вариантов), y=0.85
  - **Head**: SphereGeometry(0.15), skin color (#f0c8a0), y=1.35
  - **Legs** (×2): BoxGeometry(0.14, 0.5, 0.18), тёмные (#334455), dx=±0.1, y=0.25
- `group.userData.bodyParts = [body, head]` — для подсветки

### Body Colors
```
0x4477aa, 0x44aa77, 0xaa7744, 0x7744aa, 0xaa4466, 0x5599bb, 0x88aa44
```

### Queue System
- Очередь перед ресепшном по оси Z
- Позиция в очереди: `getQueuePosition(index)` → `(0, 0, -9 + index)`
  - index 0 → z=-9 (ближе к стойке)
  - index 1 → z=-8
  - index 2 → z=-7, и т.д. (к входу)
- При удалении пациента из очереди → `updateQueueTargets()` сдвигает всех вперёд
- Пациенты в очереди повёрнуты на `Math.PI` (лицом к стойке)

### Spawning
- Первый пациент появляется сразу при загрузке, телепортируется на позицию очереди `(0, 0, -9)` (параметр `instant=true`)
- Далее каждые `SPAWN_INTERVAL = 10` секунд (таймер в animation loop)
- Точка появления обычных пациентов: `(0, 0, 1)` — у входа
- `spawnPatient(instant)` — если `instant=true`, пациент сразу ставится на queueTarget

### Destination Slots
```js
beds = [
  { pos: Vector3(-4.5, 0, -9), occupied: bool },
  { pos: Vector3(-4.5, 0, -7), occupied: bool }
]
waitingChairs = [
  { pos: Vector3(5.5, 0, -2),   occupied: bool },
  { pos: Vector3(5.5, 0, -3.2), occupied: bool },
  { pos: Vector3(5.5, 0, -4.4), occupied: bool }
]
```
- Позиции слотов смещены от мебели (x=-4.5 для кроватей, x=5.5 для стульев) чтобы пациент стоял рядом

### Interaction (Raycasting)
- `interactRay`: Raycaster, far=5, направление из центра экрана (`screenCenter = Vector2(0,0)`)
- Каждый кадр: `setFromCamera(screenCenter, camera)` → пересечение со всеми мешами пациентов в состоянии `queued`/`interacting`
- `getPatientFromMesh(object)`: обход вверх по parent до группы с `userData.bodyParts`
- При наведении: emissive = `0x00ff44`, intensity = 0.35 (зелёная подсветка)
- При уходе: emissive сбрасывается в `0x000000`

### Popup Flow
1. ЛКМ на подсвеченного пациента → `openPopup(patient)`
2. Состояние → `interacting`, pointer unlock, попап показан
3. Кнопки проверяют `beds.find(b => !b.occupied)` / `waitingChairs.find(c => !c.occupied)`
4. Клик по кнопке → `sendPatient(patient, dest, slot)`:
   - state → `walking`, targetPos установлен, slot.occupied = true
   - Пациент удалён из queue, очередь сдвинута
5. Попап закрыт

### Patient Movement
- Скорость: `PATIENT_SPEED = 2.0` ед/сек
- Функция `moveToward(pos, target, maxDist)`: линейное перемещение по XZ
- В состоянии `queued`: движение к `queueTarget`
- В состоянии `walking`: движение к `targetPos`, поворот лицом к цели
- При достижении цели: state → `atBed` или `waiting`

## Helper Functions
- `createWall(x, z, w, d, opts)` — стена с коллизией
- `createSign(text, x, y, z, rotY)` — табличка (Canvas texture на PlaneGeometry)
- `createChair(x, z, rotY)` — стул с коллизией
- `createBed(x, z, rotY)` — кровать с коллизией
- `createBench(x, z, rotY)` — скамейка с коллизией
- `createTree(x, z)` — дерево с коллизией
- `addLight(x, z, intensity, castShadow)` — потолочный светильник
- `createTileTexture()` / `createAsphaltTexture()` / `createGrassTexture()` — процедурные текстуры
- `createPatientMesh()` — 3D-модель пациента (Group: body + head + legs)
- `spawnPatient()` — создание нового пациента с рандомными данными
- `getQueuePosition(index)` — позиция в очереди по индексу
- `updateQueueTargets()` — пересчёт целевых позиций всей очереди
- `removeFromQueue(patient)` — удаление из очереди + сдвиг
- `highlightPatient(patient)` / `unhighlightPatient(patient)` — зелёная подсветка
- `getPatientFromMesh(object)` — поиск пациента по дочернему мешу
- `updateInteraction()` — raycast от прицела, hover-логика
- `openPopup(patient)` / `closePopup()` — управление попапом
- `sendPatient(patient, dest, slot)` — отправка пациента к месту назначения
- `updatePatients(delta)` — обновление позиций всех пациентов
- `moveToward(pos, target, maxDist)` — линейное перемещение к цели
- `randomFrom(arr)` — случайный элемент массива

## Global State Variables
```js
// Scene & rendering
scene, camera, renderer, controls, clock
collidables[]            // массив объектов для коллизий

// Movement
keys { forward, backward, left, right }  // состояние клавиш
raycaster                // для коллизий
moveSpeed = 4.0
collisionDistance = 0.4

// Patient system
patients[]               // все пациенты (все состояния)
queue[]                  // пациенты в очереди (подмножество patients)
patientIdCounter         // автоинкремент ID
hoveredPatient           // текущий пациент под прицелом (или null)
popupPatient             // пациент в открытом попапе (или null)
spawnTimer               // таймер спавна (сбрасывается каждые SPAWN_INTERVAL)
beds[]                   // 2 слота кроватей { pos, occupied }
waitingChairs[]          // 3 слота стульев { pos, occupied }

// Constants
SPAWN_INTERVAL = 10      // секунды между спавнами
PATIENT_SPEED = 2.0      // ед/сек
BODY_COLORS[]            // 7 цветов одежды
NAMES[], SURNAMES[], SYMPTOMS[], CAUSES[], SUPPLIES[]  // пулы данных
```

## Animation Loop (`animate()`)
Каждый кадр:
1. `updateMovement(delta)` — движение игрока (если pointer locked)
2. `spawnTimer += delta` → спавн нового пациента каждые 10 сек
3. `updatePatients(delta)` — движение пациентов к целям
4. `updateInteraction()` — raycast от прицела, hover-подсветка
5. `renderer.render(scene, camera)`

## DOM Element IDs
| ID | Тип | Назначение |
|----|-----|------------|
| `overlay` | div | Стартовый экран / пауза |
| `crosshair` | div | Прицел (CSS-крестик) |
| `interact-hint` | div | Подсказка "Нажмите ЛКМ..." |
| `patient-popup` | div | Попап информации о пациенте |
| `popup-name` | h2 | Имя + фамилия |
| `popup-symptom` | span | Симптом |
| `popup-cause` | span | Причина |
| `popup-supply` | span | Расходник |
| `btn-bed` | button | Кнопка "На кровать" |
| `bed-count` | span | Счётчик свободных кроватей "(X/2)" внутри btn-bed |
| `btn-wait` | button | Кнопка "В зону ожидания" |
| `chair-count` | span | Счётчик свободных стульев "(X/3)" внутри btn-wait |

## CSS Z-Index Layers
| z-index | Элемент |
|---------|---------|
| 5 | `#crosshair`, `#interact-hint` |
| 10 | `#overlay` |
| 20 | `#patient-popup` |

## Key Coordinates Reference
| Объект | Позиция |
|--------|---------|
| Здание (пол) | x: -8..8, z: -12..0 |
| Вход | x: -1.2..1.2, z=0 |
| Ресепшн (столешница) | (0, 1.0, -10.5) |
| Ресепшн (фронт) | (0, 0.5, -10.0) |
| Стул 1 | (6.5, 0, -2) |
| Стул 2 | (6.5, 0, -3.2) |
| Стул 3 | (6.5, 0, -4.4) |
| Кровать 1 | (-5.5, 0, -9) |
| Кровать 2 | (-5.5, 0, -7) |
| Скамейка 1 | (4, 0, 2) |
| Скамейка 2 | (-4, 0, 2) |
| Деревья | (-5,4), (5,4), (-12,8), (12,8), (-8,15), (8,15) |
| Спавн пациента | (0, 0, 1) |
| Очередь [0] | (0, 0, -9) |
| Очередь [n] | (0, 0, -9+n) |
| Слот кровати 1 | (-4.5, 0, -9) |
| Слот кровати 2 | (-4.5, 0, -7) |
| Слот стула 1 | (5.5, 0, -2) |
| Слот стула 2 | (5.5, 0, -3.2) |
| Слот стула 3 | (5.5, 0, -4.4) |
| Камера (старт) | (0, 1.6, -11) |
