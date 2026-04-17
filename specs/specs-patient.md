# EmergencyRND V2 — Пациенты, очереди, состояния, волны

## Patient Data Pools
```
NAMES:    20 имён (10 муж + 10 жен) — из Game.Lang.t('patients.names.male/female')
SURNAMES: 20 фамилий (10 муж + 10 жен) — из Game.Lang.t('patients.surnames.male/female')
MEDICAL_DATA: структурированный объект по типам препаратов — из Game.Lang.t('patients.medical.*')
  Каждый тип содержит массив cases[]:
  Каждый case = { diagnosis, complaint } — связный медицинский кейс
  painkiller:     20 кейсов (боли, нервы, суставы, мышцы — диагностика рефлекс-молотком)
  antihistamine:  20 кейсов (нос, пазухи, заложенность, аллергический ринит — диагностика риноскопом)
  strepsils:      20 кейсов (горло, кашель, хрипы, дыхание — диагностика фонендоскопом)
CONSUMABLE_KEYS: ['painkiller', 'antihistamine', 'strepsils']
```

## Patient Object Structure
```js
{
  id: number,
  name: string,
  surname: string,
  age: number,             // 18-75
  symptom: null,           // не используется
  diagnosis: string,       // из MEDICAL_DATA (null если needsDiagnosis)
  complaint: string,       // жалоба от первого лица (всегда видна)
  needsDiagnosis: boolean, // true у 20-30% пациентов (зависит от уровня)
  requiredInstrument: string|null,
  hiddenDiagnosis: string|null,
  hiddenConsumable: string|null,
  vitals: { temp, bpSys, bpDia, pulse },
  requiredConsumable: string,      // PRIMARY тип
  requiredConsumables: string[],   // полный список (1-3 шт)
  pendingConsumables: string[],    // оставшиеся неприменённые
  mesh: THREE.Group,
  state: string,           // 'queued'|'interacting'|'walking'|'atBed'|'waiting'|'discharged'|'atRegister'|'leaving'
  targetPos: Vector3|null,
  queueTarget: Vector3|null,
  destination: object|null,
  indicators: THREE.Sprite[],
  animating: boolean,
  hp: number,
  maxHp: number,           // 100
  severity: object,        // { key, label, startHp }
  treated: boolean,
  hpDecayTimer: number,
  healthBar: THREE.Sprite|null,
  healthBarCanvas: HTMLCanvasElement,
  healthBarTexture: THREE.CanvasTexture,
  lastDrawnHp: number,
  particleTimer: number,
  leavePhase: string|null,
  fadeTimer: number|null,
  _wasWaiting: boolean,
  staffProcessing: boolean,
  staffDiagnosing: boolean,
  staffTreating: boolean,
  anim: {
    walkPhase, walkBlend, pose, targetPose,
    poseTransition, poseFrom, recovered, injuryType
  }
}
```

## Patient States
| Состояние     | Описание |
|---------------|----------|
| `queued`      | В очереди (горизонтальный ряд), доступен для взаимодействия |
| `interacting` | Попап открыт для этого пациента |
| `walking`     | Идёт к кровати или стулу |
| `atBed`       | Лежит на кровати, доступен для лечения |
| `waiting`     | Сидит в зоне ожидания, можно перевести на кровать |
| `discharged`  | Выписан (HP=100), идёт к кассе самообслуживания |
| `atRegister`  | Стоит у кассы, таймер чекаута 10 сек, после — деньги в `registerBalance`, переход в `leaving` |
| `leaving`     | После чекаута идёт к выходу, fade-out при z>18 |

## Queue System
- Горизонтальная очередь перед ресепшном (вдоль оси X)
- Позиция: `getQueuePosition(index)` → `(-2 + index * 1.2, 0, -7.5)` — пациенты стоят в ряд
- **Level 2+ (auto-spawn):** очередь жёстко ограничена **2 пациентами** (`QUEUE_CAP = 2`, учитываются состояния `queued` + `interacting`). Система спавна сама не создаёт нового пациента, пока в очереди уже 2
- **Level 1 (tutorial):** `maxQueue = min(totalSlots + 2, 12)`, минимум 2
- Пациенты в очереди повёрнуты на `Math.PI` (лицом к стойке)

## Spawning

### Режимы спавна (зависит от уровня)
- **Level 1 (tutorial):** sequential — один пациент, ручное управление
- **Level 2+:** slot-based auto-spawn — пациенты заходят поочередно по мере освобождения мест

### Slot-based Auto-Spawn (Level 2+)
Пациенты заходят **по одному**, а планирование спавна **per-slot**: каждое освободившееся место в больнице добавляет свой независимый таймер в массив `pendingSpawns`. Это значит, что если игрок вылечит несколько пациентов одновременно, несколько таймеров 10-20 с стартуют параллельно и новые пациенты придут с естественным разбросом в пределах этого окна, а не строго по одному каждые 10-20 с.

#### Условия фактического спавна (проверяются при срабатывании таймера)
1. `totalInBuilding < beds.length + chairs.length` — всего человек в больнице меньше суммарной вместимости. Учитываются все состояния КРОМЕ `discharged`, `atRegister`, `leaving` (эти уже освободили кровать/стул).
2. `queuedCount < 2` — в очереди не более двух (состояния `queued` + `interacting`).

Если таймер истёк, но условие не выполнено — он остаётся в `pendingSpawns` с временем ≤ 0 и сработает на ближайшем кадре, когда каполностьются соблюдены. Если таймер ещё положителен к моменту освобождения — выдерживается полный 10-20 с интервал.

#### Логика наполнения `pendingSpawns`
- **Стартовый burst:** в `startWaveSystem()` массив инициализируется одним таймером `[0]` (первый пациент придёт сразу). После каждого успешного burst-спавна в массив добавляется следующий таймер с интервалом 1-3 с, пока `initialSpawnCount < initialBurstTarget`. `initialBurstTarget = beds.length + chairs.length` захватывается в момент старта смены.
- **Steady state** (после завершения burst): каждый кадр сравнивается текущий `totalInBuilding` с `prevTotalInBuilding`. Если количество уменьшилось на `N`, в `pendingSpawns` пушится `N` таймеров по 10-20 с (каждому освобождённому месту — свой таймер). `STEADY_MIN=10`, `STEADY_MAX=20`.

Несколько таймеров могут сработать в одном кадре (если они истекли одновременно), ограничиваясь только двумя capами выше.

#### Тяжесть
Выбирается случайно в `spawnPatient()` по весам уровня:
- **Level 2:** 65% mild, 35% medium
- **Level 3+:** 60% mild, 25% medium, 15% severe

**Переменные:** `autoSpawnActive`, `initialSpawnCount`, `initialBurstTarget` (= beds+chairs на момент старта), `pendingSpawns` (массив таймеров), `prevTotalInBuilding`, `INITIAL_MIN=1`, `INITIAL_MAX=3`, `STEADY_MIN=10`, `STEADY_MAX=20`, `QUEUE_CAP=2`
**Функции:** `startWaveSystem()` (сохранено как внешнее API; инициализирует auto-spawn)
**Файлы:** `patients.js` (auto-spawn logic), `levels.js` (`getSpawnMode()`), `shift.js` (вызов `startWaveSystem()`)

### Level 2 сразу после туториала
- XP threshold L1->L2 снижен до 10 (ровно столько даёт первый пациент)
- После оплаты первого пациента — попап "Level 2!" -> та же смена продолжается с auto-spawn

### Общие правила спавна
- Пациенты спавнятся ТОЛЬКО когда смена открыта (`Game.Shift.isOpen() === true`)
- Точка появления: `(0, 0, 1)` — у входа, пациент идёт пешком к очереди
- Тип болезни: случайный из `CONSUMABLE_KEYS`, случайный case из `MEDICAL_DATA[type].cases[]`
- Тяжесть: случайная по весам уровня (см. выше)
- Витальные показатели через `generateVitals(severity.key)` — коррелируют с тяжестью
- Случайный возраст 18-75

## Severity Distribution
Тяжесть выбирается случайно в момент спавна по весам уровня (см. Slot-based Auto-Spawn выше).
В sequential режиме (Level 1) все пациенты mild.

Стартовые значения HP по тяжести:
- `mild` (Лёгкое): startHp=80
- `medium` (Среднее): startHp=50
- `severe` (Тяжёлое): startHp=29

### Шанс диагностики (по уровню, `getDiagnosisChance()`)
- Level 2: 20%
- Level 3: 25%
- Level 4: 30%

### Мульти-препаратная система (по тяжести)
- **mild** → 1 препарат: `[primaryType]`
- **medium** → 2 препарата: `[primaryType, случайный_другой]`
- **severe** → 3 препарата: все три типа

`pendingConsumables` — рабочая копия, уменьшается по мере применения.
Для `needsDiagnosis` пациентов: списки = `null` до диагностики.

## Destination Slots
- Начальные слоты (от world.js):
```js
beds = [
  { pos: Vector3(-4.5, 0, -9), occupied: bool },
  { pos: Vector3(-4.5, 0, -7), occupied: bool },
  { pos: Vector3(-4.5, 0, -5), occupied: bool }
]
waitingChairs = [
  { pos: Vector3(5.5, 0, -2),   occupied: bool },
  { pos: Vector3(5.5, 0, -3.2), occupied: bool },
  { pos: Vector3(5.5, 0, -4.4), occupied: bool }
]
```
- Позиции слотов: bed slotOffset +1.0 по X, chair slotOffset -1.0 по X
- Пациенты используют только indoor слоты
- Новая мебель через магазин

## Interaction (Raycasting)
- `interactRay`: Raycaster, far=5, от центра экрана
- Пересечение с мешами пациентов в состоянии `queued`/`interacting`/`atBed`/`waiting` (кроме `animating`)
- Hover → зелёная обводка через `Game.Outline`

## Popup Flow
1. ЛКМ на пациента в `queued` или `waiting` → `openPopup(patient)`
2. Медицинская карта: тяжесть (цветная полоса), имя, возраст, витальные, HP-бар, жалоба, диагноз, назначение
3. Предупреждения: outdoor мебель, сломанные кровати
4. Кнопки: "На кровать (X/N)", "В зону ожидания (X/N)", "Подождать"
5. Размещение → `sendPatient()`: state → walking, slot.occupied = true

## Health System
- `severe` → HP=29, `medium` → HP=50, `mild` → HP=80, max=100
- **Деградация HP** (каждые 3 сек, `HP_DECAY_INTERVAL = 3.0`):
  - На кровати: 1 HP за тик
  - В очереди/ожидании: 0.5 HP за тик
  - НЕ падает при ходьбе и во время мини-игры диагностики
  - HP ≤ 0 → пациент удаляется, HP кровати уменьшается на 1
- **Восстановление HP**: после применения всех препаратов (`treated = true`) пациент полностью вылечивается за случайное время **4-7 секунд** независимо от тяжести. При переходе в `treated` вычисляется `patient.recoveryRate = (MAX_HP - hp) / (4 + random()*3)`, в `updateHealthTimers` HP увеличивается на `recoveryRate * delta` каждый кадр.
  - HP ≥ 100 → выписка (`dischargePatient()`)

### Хелсбар (3D спрайт над пациентом)
- Canvas 128×16, `THREE.Sprite`, масштаб `0.6 × 0.08`
- **5 сегментов** (24px шириной, 1px промежутки), без текста HP
- Цвет и количество заполненных сегментов по HP%:

| Сегментов | Условие | Цвет |
|-----------|---------|------|
| 5 | HP ≥ 99% | Ярко-зелёный `#00e800` |
| 4 | HP ≥ 60% | Зелёный `#32cd32` |
| 3 | HP ≥ 30% | Жёлтый `#f0c800` |
| 2 | HP ≥ 15% | Красный `#dc2828` |
| 1 | HP < 15% | Бордовый `#800020` |

- Незаполненные сегменты: `rgba(255, 255, 255, 0.08)`
- Попап пациента: аналогичная логика (ширина = `count × 20%`, CSS-разделители через `repeating-linear-gradient`), без текста процентов

## Patient Movement
- Базовая скорость: `PATIENT_SPEED = 3.5` ед/сек
- **Все пациенты ходят с одинаковой скоростью** (WALK_SPEED = 1.0 для всех тяжестей)
- `recovered` после выписки — нормальная скорость

## Discharge Flow (HP = 100)
1. Освобождает кровать, уменьшает её HP на 1
2. Удаляет индикаторы и healthBar
3. `recovered = true`, убирает визуалы болезни
4. Направляет к кассе → оплата → уход → fade-out при z>18

## Injury Poses (при ходьбе)
- `painkiller` → `holdStomach`, `holdBack`, или `limp`
- `antihistamine` → `holdHead`
- `strepsils` → `holdThroat`
- Масштабируется по severity: severe=1.0, medium=0.5, mild=0.15, recovered=0

## Illness Visual Indicators
- При спавне: `applyIllnessVisuals(patient)`
- При выписке/удалении: `removeIllnessVisuals(patient)`

## No Session Persistence
- Никаких данных не сохраняется между сессиями
- Каждый запуск — абсолютно новая игра
- Сервер отдаёт все файлы с `Cache-Control: no-cache, no-store, must-revalidate`
- `localStorage` используется только для выбора языка
