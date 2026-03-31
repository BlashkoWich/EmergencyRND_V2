# EmergencyRND V2 — Игрок, управление, взаимодействие

## Player
- Стартовая позиция: `(0, 1.6, -10)` (за ресепшн-стойкой), лицом к улице (+Z)
- Камера: PerspectiveCamera, FOV 70, near 0.1, far 100
- `rotation.order = 'YXZ'` — совпадает с внутренним euler order PointerLockControls, предотвращает quaternion↔euler drift
- Начальный поворот: `camera.quaternion.setFromEuler(new Euler(0, PI, 0, 'YXZ'))` — лицом к входу/улице

## Controls
- **WASD** — движение (через `e.code`, работает на любой раскладке)
- **Мышь** — вращение камеры (Pointer Lock API, `pointerSpeed = 0.5`)
- **ЛКМ** — взаимодействие (пациент / лечение / подбор расходника / размещение на стеллаже)
- **Q (KeyQ)** — открыть/закрыть магазин расходников
- **G (KeyG)** — бросить предмет из активного слота инвентаря (вперёд по камере с физикой)
- **1-6 (Digit1-Digit6)** — выбор слота инвентаря
- **Shift (ShiftLeft)** — ускорение (спринт): скорость `7.0` ед/сек вместо `4.0`
- **Space** — прыжок (начальная скорость `5.0`, гравитация `-12.0`); горизонтальное движение сохраняется в воздухе
- **ESC** — пауза (разблокировка курсора, показ overlay)
- Скорость движения: `4.0` ед/сек (обычная), `7.0` ед/сек (спринт)
- Высота камеры: `1.6` (базовая, меняется при прыжке)

## Mouse Delta Filter
- Capture-phase `mousemove` listener на `document`, срабатывает ДО PointerLockControls
- Блокирует события с `|movementX|` или `|movementY|` > 150 через `stopImmediatePropagation()`
- Предотвращает резкие прыжки/перевороты камеры от аномальных дельт браузера (баг Pointer Lock API)

## Controls Internal State
```js
_keys { forward, backward, left, right, sprint, jump }  // состояние клавиш
_raycaster                // для коллизий
_collisionOrigin          // Vector3, точка начала рейкаста (y=0.5, центр тела)
_savedQuat                // Quaternion|null, сохраняется при lock, восстанавливается в первом update
_forward, _right, _moveDir, _moveX, _moveZ  // pre-allocated Vector3, переиспользуются каждый кадр (без GC-давления)
_moveSpeed = 4.0
_sprintSpeed = 7.0
_collisionDistance = 0.4
_velocityY = 0            // вертикальная скорость (прыжок/падение)
_jumpSpeed = 5.0           // начальная скорость прыжка
_gravity = -12.0           // гравитация
_groundY = 1.6             // базовая высота камеры
_isGrounded = true         // на земле ли игрок
```

## UI Elements

### Crosshair (`#crosshair`)
- Белый крестик в центре экрана (CSS pseudo-elements `::before`/`::after`)
- Размер 24x24px, z-index: 5
- Виден только при активном Pointer Lock

### Interaction Hint (`#interact-hint`)
- Динамический текст под прицелом, зависит от контекста:
  - "Нажмите ЛКМ для взаимодействия" — наведение на пациента в очереди
  - "ЛКМ — Применить [название расходника]" — наведение на пациента на кровати (с расходником в руках)
  - "Нужен расходник" — наведение на пациента на кровати (без расходника)
  - "Поднять на ЛКМ" — наведение на расходник на земле
  - "Положить на ЛКМ" — наведение на стеллаж (если в активном слоте есть предмет)
- Позиция: `top: calc(50% + 30px)`, z-index: 5
- Приоритет: пациенты > расходники > стеллажи

### Overlay (`#overlay`)
- Начальный экран с инструкциями, z-index: 10
- Показывает: WASD — движение | Мышь — камера | ESC — пауза | Q — магазин | 1-6 — инвентарь | ЛКМ — взаимодействие
- Клик → `controls.lock()`, скрывается при lock

## Inventory System

### Data Model
```js
slots = [null, null, null, null, null, null]  // 6 слотов, значение = тип расходника или null
activeSlot = 0  // индекс 0-5
```

### UI (`#inventory-container` > `#inventory-bar` + `#inventory-hints`)
- Контейнер `#inventory-container`: `fixed bottom: 16px`, по центру, z-index: 5, flex column
- `#inventory-bar`: 6 слотов (56x56px), rgba(0,0,0,0.5) фон, border
- Активный слот: золотая рамка (#ffcc00)
- Занятые слоты: цветной квадрат (цвет расходника)
- Подпись 1-6 под каждым слотом
- Клавиши Digit1-Digit6 переключают activeSlot
- `#inventory-hints`: строка подсказок под слотами
  - "Q — Магазин" — всегда видна
  - "G — Бросить" — видна только когда в активном слоте есть предмет

### Notification (`#notification`)
- z-index: 15, красный фон, по центру
- Появляется на 2 секунды, затем затухает (opacity transition)

### Inventory API
- `addItem(type)` → boolean (true если добавлено)
- `removeActive()` → type или null
- `getActive()` → type активного слота или null
- `isFull()` → boolean
- `countType(type)` → number — количество предметов данного типа в инвентаре
- `showNotification(text)` → показать временное уведомление

## Shop System

### Shop Popup (`#shop-popup`)
- z-index: 20, такой же стиль как `#patient-popup`
- Открывается на KeyQ, закрывается на KeyQ или кнопку ✕
- При открытии: `controls.unlock()`, обновляются счётчики предметов
- При закрытии: `controls.lock()` (кнопка закрытия — user gesture)
- 3 товара: Стрепсилс, Обезболивающее, Антигистаминное, у каждого цветная иконка-кружок (цвет из `CONSUMABLE_TYPES.color`) и кнопка "Купить"
- У каждого товара отображается счётчик "(есть: N)" — суммирует количество в инвентаре + на земле. Обновляется при открытии и после каждой покупки
- Покупка → `Game.Consumables.spawnInDeliveryZone(type)` + `updateCounts()`

## Shelf Interaction
- Raycaster пересекает все меши стеллажей
- Подсветка только если в активном слоте инвентаря есть расходник И на стеллаже есть свободный слот
- Зелёный emissive, подсказка "Положить на ЛКМ"
- ЛКМ → забирает из инвентаря, создаёт 3D модель расходника на полке

## Consumable Interaction

### Pickup
- Raycaster из центра экрана (far=5) пересекает grounded + !pickedUp предметы
- При наведении: зелёный emissive (0x00ff44, intensity 0.35), подсказка "Поднять на ЛКМ"
- ЛКМ → `Game.Inventory.addItem(type)`, удаление из сцены
- Если инвентарь полон → уведомление "Инвентарь полон"

### Drop (G / KeyG)
- Забирает предмет из активного слота инвентаря
- Создаёт mesh перед камерой (0.8 ед вперёд, -0.3 по Y)
- Бросает вперёд (скорость 4.0) и вверх (скорость 2.0)
- Предмет сталкивается со стенами, мебелью, полом через `collidables[]`
- Приземлившийся предмет можно снова подобрать

## Shelves Internal State
```js
shelves[]                // массив стеллажей {mesh, highlightParts[], slots[]}
hoveredShelf             // стеллаж под прицелом (или null)
allShelfParts[]          // все меши стеллажей для raycasting
```
