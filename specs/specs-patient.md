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
  state: string,           // 'queued'|'interacting'|'walking'|'atBed'|'waiting'|'discharged'|'atCashier'|'leaving'
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
  waveNumber: number,      // номер волны, к которой принадлежит пациент
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
| `discharged`  | Выписан (HP=100), идёт к кассе |
| `atCashier`   | Стоит у кассы, ждёт оплаты |
| `leaving`     | После оплаты идёт к выходу, fade-out при z>18 |

## Queue System
- Горизонтальная очередь перед ресепшном (вдоль оси X)
- Позиция: `getQueuePosition(index)` → `(-2 + index * 1.2, 0, -7.5)` — пациенты стоят в ряд
- **Динамический максимум очереди**: `maxQueue = min(totalSlots + 2, 12)`, минимум 4
  - Начальное состояние: 3 кровати + 3 стула = 6 → maxQueue = 8
- Если очередь полна — пациент пропускается, нотификация
- Пациенты в очереди повёрнуты на `Math.PI` (лицом к стойке)

## Spawning

### Режимы спавна (зависит от уровня)
- **Level 1 (tutorial):** sequential — один пациент, ручное управление
- **Level 2+:** wave — скриптованные волны с гарантированным разнообразием тяжести

### Волновой спавн (Level 2+)
Пациенты приходят волнами. Каждая волна имеет заданный состав по тяжести.
Все пациенты волны спавнятся **одновременно** (в один кадр).

#### Условия триггера волны:
1. `gameTime >= wave.time` (время смены достигло порога)
2. Первая волна — всегда сразу. Последующие — только когда **хотя бы один пациент из предыдущей волны ушёл** (вылечен, оплатил, потерян)

#### Порядок спавна внутри волны:
severe → medium → mild (самые критичные первыми)

#### Общий таймер волны (60 сек):
- При спавне волны появляется HUD-баннер (`#wave-banner`)
- Текст: "Скорая привезла пациентов! Определите каждого — решите, кого спасать первым." — виден всё время
- **Полоска таймера и текст с секундами скрыты** первые 45 секунд
- **За 15 секунд до конца** (`waveQueueTimer <= 15`): появляются `#wave-timer-bar` и `#wave-timer-text`, fill отсчитывает от 100% до 0% в рамках этих 15 секунд
- Класс `.urgent` при <25% общего времени — красное свечение
- Таймер тикает пока есть пациенты волны в состоянии `queued` или `interacting`
- Когда таймер истекает — все оставшиеся в очереди пациенты этой волны уходят (потеряны)
- Баннер скрывается когда все пациенты волны распределены или ушли

**Переменные:** `QUEUE_PATIENCE = 60`, `waveQueueTimer`, `waveQueueTimerActive`, `activeWaveNumber`

#### Отслеживание волн:
- Каждый пациент при спавне получает `waveNumber = currentSpawnWaveNumber`
- `lastWaveSize` — сколько пациентов было в предыдущей волне
- `currentSpawnWaveNumber` — номер текущей спавнящейся волны

### Конфигурация волн (`WAVE_CONFIG`)
Composition: `[mild_count, medium_count, severe_count]`

**Level 2** (4 волны, ~14 пациентов):
| Волна | Время | Состав | Всего |
|-------|-------|--------|-------|
| W1 | 0s | 2 mild, 2 medium | 4 |
| W2 | 55s | 1 mild, 2 medium | 3 |
| W3 | 120s | 2 mild, 2 medium | 4 |
| W4 | 200s | 1 mild, 2 medium | 3 |

**Level 3** (5 волн, ~18 пациентов):
| Волна | Время | Состав | Всего |
|-------|-------|--------|-------|
| W1 | 0s | 1 mild, 2 medium, 1 severe | 4 |
| W2 | 45s | 1 mild, 1 medium, 1 severe | 3 |
| W3 | 100s | 2 mild, 1 medium, 1 severe | 4 |
| W4 | 160s | 1 mild, 2 medium, 1 severe | 4 |
| W5 | 230s | 1 mild, 1 medium, 1 severe | 3 |

**Level 4** (6 волн, ~22 пациента):
| Волна | Время | Состав | Всего |
|-------|-------|--------|-------|
| W1 | 0s | 1 mild, 2 medium, 1 severe | 4 |
| W2 | 35s | 1 mild, 1 medium, 2 severe | 4 |
| W3 | 80s | 2 mild, 1 medium | 3 |
| W4 | 130s | 1 mild, 2 medium, 1 severe | 4 |
| W5 | 185s | 1 mild, 1 medium, 2 severe | 4 |
| W6 | 245s | 1 mild, 1 medium, 1 severe | 3 |

**Переменные:** `currentWaveIndex`, `waveSpawnQueue`, `waveStarted`, `lastWaveSize`, `currentSpawnWaveNumber`
**Функции:** `startWaveSystem()`
**Файлы:** `patients.js` (`WAVE_CONFIG`, wave logic), `levels.js` (`getSpawnMode()`), `shift.js` (вызов `startWaveSystem()`)

### Level 2 сразу после туториала
- XP threshold L1->L2 снижен до 10 (ровно столько даёт первый пациент)
- После оплаты первого пациента — попап "Level 2!" -> та же смена продолжается с волновым спавном

### Общие правила спавна
- Пациенты спавнятся ТОЛЬКО когда смена открыта (`Game.Shift.isOpen() === true`)
- Точка появления: `(0, 0, 1)` — у входа, пациент идёт пешком к очереди
- Тип болезни: случайный из `CONSUMABLE_KEYS`, случайный case из `MEDICAL_DATA[type].cases[]`
- Тяжесть: задаётся конфигурацией волны (параметр `explicitSeverityKey` в `spawnPatient`)
- Витальные показатели через `generateVitals(severity.key)` — коррелируют с тяжестью
- Случайный возраст 18-75

## Severity Distribution
В волновом режиме (Level 2+) тяжесть задаётся конфигурацией волны (`WAVE_CONFIG`), не случайным броском.
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
3. Предупреждения: outdoor мебель, грязное бельё
4. Кнопки: "На кровать (X/N)", "В зону ожидания (X/N)", "Подождать"
5. Размещение → `sendPatient()`: state → walking, slot.occupied = true

## Health System
- `severe` → HP=29, `medium` → HP=50, `mild` → HP=80, max=100
- **Деградация HP** (каждые 3 сек, `HP_DECAY_INTERVAL = 3.0`):
  - На кровати: 1 HP за тик
  - В очереди/ожидании: 0.5 HP за тик
  - НЕ падает при ходьбе и во время мини-игры диагностики
  - HP ≤ 0 → пациент удаляется, кровать грязная
- **Восстановление HP**: после всех препаратов (`treated = true`), +3 HP/сек (`HP_RECOVERY_RATE = 3.0`)
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
1. Освобождает кровать, помечает бельё грязным
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
