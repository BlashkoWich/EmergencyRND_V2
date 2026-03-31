# EmergencyRND V2 — Пациенты, очереди, расходники, лечение

## Patient Data Pools
```
NAMES:    20 русских имён (10 муж + 10 жен)
SURNAMES: 20 русских фамилий (10 муж + 10 жен)
MEDICAL_DATA: структурированный объект по типам расходников:
  painkiller:     5 симптомов (головная боль, боль в спине, суставах, мигрень, зубная боль)
                  5 диагнозов (мышечный спазм, остеохондроз, невралгия и т.д.)
  antihistamine:  5 симптомов (сыпь, отёк, зуд, слезоточивость, чихание)
                  5 диагнозов (аллергическая реакция, крапивница, поллиноз и т.д.)
  strepsils:      5 симптомов (боль в горле, кашель, першение, осиплость, глотание)
                  5 диагнозов (фарингит, ларингит, тонзиллит, простуда, ОРВИ)
CONSUMABLE_KEYS: ['painkiller', 'antihistamine', 'strepsils']
```

## Patient Object Structure
```js
{
  id: number,              // автоинкремент
  name: string,            // из NAMES
  surname: string,         // из SURNAMES
  symptom: string,         // из MEDICAL_DATA[type].symptoms
  diagnosis: string,       // из MEDICAL_DATA[type].diagnoses
  requiredConsumable: string, // ключ типа расходника ('painkiller'|'antihistamine'|'strepsils')
  mesh: THREE.Group,       // 3D-модель
  state: string,           // 'queued' | 'interacting' | 'walking' | 'atBed' | 'waiting'
  targetPos: Vector3|null, // целевая позиция при walking
  queueTarget: Vector3|null, // позиция в очереди
  destination: object|null,// ссылка на слот beds[] или waitingChairs[]
  indicator: THREE.Sprite|null, // индикатор расходника над головой (создаётся при atBed)
  animating: boolean,      // флаг блокировки взаимодействия во время анимации
  hp: number,              // текущее здоровье
  maxHp: number,           // максимальное здоровье (100)
  severity: object,        // { key, label, startHp } — тяжесть заболевания
  treated: boolean,        // true после применения правильного расходника
  hpDecayTimer: number,    // таймер деградации HP (сбрасывается каждые 3 сек)
  healthBar: THREE.Sprite|null, // 3D хелсбар над головой (статичный, y=1.7)
  healthBarCanvas: HTMLCanvasElement, // канвас для перерисовки хелсбара
  healthBarTexture: THREE.CanvasTexture, // текстура хелсбара
  lastDrawnHp: number,     // кеш для оптимизации перерисовки
  particleTimer: number    // таймер спавна лечебных частиц
}
```

## Patient States
| Состояние     | Описание |
|---------------|----------|
| `queued`      | В очереди, движется к `queueTarget`, доступен для взаимодействия |
| `interacting` | Попап открыт для этого пациента |
| `walking`     | Идёт к кровати или стулу (`targetPos`) |
| `atBed`       | Лежит на кровати, доступен для лечения. Над головой индикатор расходника |
| `waiting`     | Сидит в зоне ожидания |

## Queue System
- Очередь перед ресепшном по оси Z
- Позиция в очереди: `getQueuePosition(index)` → `(0, 0, -7.5 + index)`
  - index 0 → z=-7.5 (ближе к стойке)
  - index 1 → z=-6.5
  - index 2 → z=-5.5, и т.д. (к входу)
- При удалении пациента из очереди → `updateQueueTargets()` сдвигает всех вперёд
- Пациенты в очереди повёрнуты на `Math.PI` (лицом к стойке)

## Spawning
- Первый пациент появляется сразу при загрузке, телепортируется на позицию очереди `(0, 0, -7.5)` (параметр `instant=true`)
- Далее каждые `SPAWN_INTERVAL = 10` секунд (таймер в animation loop)
- Точка появления обычных пациентов: `(0, 0, 1)` — у входа
- `spawnPatient(instant)` — если `instant=true`, пациент сразу ставится на queueTarget
- При создании выбирается случайный тип из `CONSUMABLE_KEYS`, затем случайный symptom и diagnosis из `MEDICAL_DATA[type]`

## Destination Slots
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

## Interaction (Raycasting)
- `interactRay`: Raycaster, far=5, направление из центра экрана (`screenCenter = Vector2(0,0)`)
- Каждый кадр: `setFromCamera(screenCenter, camera)` → пересечение со всеми мешами пациентов в состоянии `queued`/`interacting`/`atBed` (кроме `animating`)
- `getPatientFromMesh(object)`: обход вверх по parent до группы с `userData.bodyParts`
- При наведении: emissive = `0x00ff44`, intensity = 0.35 (зелёная подсветка)
- При уходе: emissive сбрасывается в `0x000000`

## Popup Flow
1. ЛКМ на подсвеченного пациента в состоянии `queued` → `openPopup(patient)`
2. Состояние → `interacting`, pointer unlock, попап показан
3. Попап содержит: имя, симптом, диагноз, тяжесть заболевания (цветной текст: красный/жёлтый/зелёный), цветная иконка расходника + название расходника
4. Кнопки проверяют `beds.find(b => !b.occupied)` / `waitingChairs.find(c => !c.occupied)`
5. Клик по кнопке → `sendPatient(patient, dest, slot)`:
   - state → `walking`, targetPos установлен, slot.occupied = true
   - Пациент удалён из queue, очередь сдвинута
6. Попап закрыт, `controls.lock()` — управление возвращается

## Health System
- Каждый пациент при спавне получает случайную тяжесть заболевания:
  - `severe` (Тяжёлое) → стартовое HP = 30
  - `medium` (Среднее) → стартовое HP = 50
  - `mild` (Лёгкое) → стартовое HP = 80
- Максимальное HP = 100
- **Деградация HP**: каждые 3 секунды, пока `treated === false`, пациент теряет 1 HP
  - При HP ≤ 0 → пациент удаляется, уведомление "Пациент потерян!"
- **Восстановление HP**: после применения правильного расходника (`treated = true`), HP растёт на 3 ед/сек
  - При HP ≥ 100 → пациент выписывается (`removePatient()`), уведомление "Пациент выписан!"
- Логика в `updateHealthTimers(delta)`, вызывается из `update()` каждый кадр

## Health Bar (3D Sprite)
- Создаётся при спавне пациента (`createHealthBar()`)
- Canvas 128×16 → `THREE.CanvasTexture` → `THREE.Sprite`
- Статичная позиция `y=1.7` над головой (без покачивания)
- Scale: `(0.6, 0.08, 1)`, `depthTest: false`
- Цветовая индикация по текущему HP:
  - Зелёный (`rgb(50, 205, 50)`) при HP > 60%
  - Жёлтый (`rgb(255, 200, 0)`) при HP 30–60%
  - Красный (`rgb(220, 40, 40)`) при HP ≤ 30%
- Текст "HP/100" по центру бара
- Оптимизация: перерисовка только при изменении `Math.floor(hp)` (`lastDrawnHp` кеш)
- Обновление позиции в `updateIndicators()` каждый кадр

## Healing Particle System
- Когда пациент восстанавливается (`treated === true`, `animating === false`), спавнятся зелёные частицы-крестики
- `PARTICLE_SPAWN_INTERVAL = 0.15` сек — частота спавна
- `PARTICLE_LIFETIME = 1.2` сек — время жизни частицы
- `PARTICLE_SPEED = 0.6` ед/сек — скорость подъёма вверх
- Частицы: `THREE.Sprite` 32×32, зелёный крестик с радиальным свечением
- Текстура кешируется (`healParticleTexture`) — одна на все частицы
- Спавн: случайное смещение по X (±0.25) и Z (±0.15) от центра пациента, Y от 0.4 до 1.0
- Каждый кадр: движение вверх + затухание opacity + уменьшение scale
- Массив `healParticles[]` обновляется в `updateHealParticles(delta)` из `update()`
- При удалении пациента частицы дотухают естественно (не привязаны к пациенту)

## Treatment System
- Наведение на `atBed` пациента показывает подсказку:
  - Пациент лечится (`treated === true`) → "Пациент лечится..."
  - Есть активный расходник → "ЛКМ — Применить [название]"
  - Нет расходника → "Нужен расходник"
- ЛКМ на `atBed` пациента:
  - Пациент уже лечится (`treated === true`) → клик игнорируется
  - Нет расходника → уведомление "Выберите расходник в инвентаре"
  - Правильный расходник (`activeType === requiredConsumable`):
    1. `Game.Inventory.removeActive()` — расходник убирается из инвентаря
    2. `patient.treated = true` — запуск восстановления HP
    3. Зелёная вспышка (emissive 0x00ff44, intensity 0.8→0, 0.5с)
    4. Уведомление "Лечение начато!"
    5. По завершении анимации: сброс emissive, удаление индикатора расходника, `animating = false`
    6. Пациент остаётся на кровати, HP восстанавливается 3 ед/сек, лечебные частицы спавнятся
    7. При HP = 100 → выписка (`removePatient()`)
  - Неправильный расходник:
    1. Расходник НЕ расходуется
    2. Красная вспышка (emissive 0xff2222, intensity 0.5→0, 0.3с)
    3. Тряска меша (sin-осцилляция x ±0.05, 0.3с)
    4. Уведомление "Неправильный расходник!"
- Во время анимации (`patient.animating=true`) повторное взаимодействие блокировано
- `removePatient()`: удаляет indicator, healthBar и mesh из сцены, `destination.occupied=false`, убирает из patients[]

## Animation System
- Массив `animations[]` с объектами `{ patient, type, timer, maxTime, ... }`
- `updateAnimations(delta)` вызывается из `update()` каждый кадр
- Типы анимаций:
  - `'heal'` — зелёная вспышка (emissiveIntensity 0.8→0 за 0.5с), по завершении: сброс emissive, удаление индикатора расходника, `animating=false` (пациент остаётся для восстановления HP)
  - `'shake'` — тряска (sin-осцилляция x ±0.05, 8 колебаний за 0.3с) + красная вспышка, по завершении сброс позиции и `animating=false`

## Patient Movement
- Скорость: `PATIENT_SPEED = 2.0` ед/сек
- Функция `moveToward(pos, target, maxDist)`: линейное перемещение по XZ
- В состоянии `queued`: движение к `queueTarget`
- В состоянии `walking`: движение к `targetPos`, поворот лицом к цели
- При достижении цели: state → `atBed` (+ создание индикатора) или `waiting`

## Consumable System

### Consumable Types
```js
CONSUMABLE_TYPES = {
  strepsils:     { name: 'Стрепсилс',        color: 0xcc3333, size: {x:0.15, y:0.08, z:0.10} },
  painkiller:    { name: 'Обезболивающее',    color: 0x3366cc, size: {x:0.18, y:0.06, z:0.12} },
  antihistamine: { name: 'Антигистаминное',   color: 0x33aa55, size: {x:0.14, y:0.07, z:0.10} }
}
```

### Physics
- Полная 3D физика: `velocity = Vector3(x, y, z)`, гравитация `GRAVITY = -9.8` по Y
- Столкновения через raycasting по каждой оси (X, Y, Z) против `collidables[]`
- При столкновении с поверхностью: трение (velocity *= 0.3), при малой скорости → `grounded = true`
- Fallback: ground plane при `y <= 0`
- Бросок (G): `DROP_FORWARD_SPEED = 4.0`, `DROP_UP_SPEED = 2.0` — предмет летит вперёд от камеры с дугой

### Ground Item Structure
```js
{ type, mesh, velocity: Vector3(x, y, z), grounded, pickedUp }
```

## Internal State (Game.Patients)
```js
patients[]               // все пациенты (все состояния)
queue[]                  // пациенты в очереди (подмножество patients)
patientIdCounter         // автоинкремент ID
hoveredPatient           // текущий пациент под прицелом (или null)
popupPatient             // пациент в открытом попапе (или null)
spawnTimer               // таймер спавна (сбрасывается каждые SPAWN_INTERVAL)
beds[]                   // 2 слота кроватей { pos, occupied } — получены из World.setup()
waitingChairs[]          // 3 слота стульев { pos, occupied } — получены из World.setup()
animations[]             // активные анимации лечения/ошибки
healParticles[]          // активные лечебные частицы [{sprite, life, maxLife, vx, vy, vz}]
healParticleTexture      // кешированная текстура частиц (одна на все)
```

## Constants (Game.Patients)
```js
SPAWN_INTERVAL = 10      // секунды между спавнами
PATIENT_SPEED = 2.0      // ед/сек
BODY_COLORS[]            // 7 цветов одежды
NAMES[], SURNAMES[]      // пулы имён
MEDICAL_DATA{}           // симптомы/диагнозы по типам расходников
CONSUMABLE_KEYS[]        // ключи типов расходников
SEVERITIES[]             // [{key, label, startHp}] — тяжесть: severe(30), medium(50), mild(80)
MAX_HP = 100             // максимальное здоровье
HP_DECAY_INTERVAL = 3.0  // секунды между потерей 1 HP
HP_RECOVERY_RATE = 3.0   // HP/сек при восстановлении
PARTICLE_SPAWN_INTERVAL = 0.15 // секунды между спавном лечебных частиц
PARTICLE_LIFETIME = 1.2  // время жизни частицы
PARTICLE_SPEED = 0.6     // скорость подъёма частицы
```

## Internal State (Game.Consumables)
```js
groundItems[]            // все расходники на земле {type, mesh, velocity, grounded, pickedUp}
hoveredItem              // расходник под прицелом (или null)
GRAVITY = -9.8           // ускорение свободного падения
DROP_FORWARD_SPEED = 4.0 // скорость броска вперёд
DROP_UP_SPEED = 2.0      // скорость броска вверх
```
