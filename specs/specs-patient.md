# EmergencyRND V2 — Пациенты, очереди, состояния

## Patient Data Pools
```
NAMES:    20 имён (10 муж + 10 жен) — из Game.Lang.t('patients.names.male/female')
SURNAMES: 20 фамилий (10 муж + 10 жен) — из Game.Lang.t('patients.surnames.male/female')
MEDICAL_DATA: структурированный объект по типам препаратов — из Game.Lang.t('patients.medical.*')
  Каждый тип содержит массив cases[]:
  Каждый case = { diagnosis, complaint } — связный медицинский кейс (поле symptom удалено)
  Жалобы (локализованные) тематически связаны с инструментом диагностики для данного типа:
  painkiller:     20 кейсов (боли, нервы, суставы, мышцы — диагностика рефлекс-молотком)
  antihistamine:  20 кейсов (нос, пазухи, зал��женность, аллергический ринит — диагностика риноскопом)
  strepsils:      20 кейсов (горло, кашель, хрипы, дыхание — диагностика фонендоскопом)
CONSUMABLE_KEYS: ['painkiller', 'antihistamine', 'strepsils']
```

## Patient Object Structure
```js
{
  id: number,              // автоинкремент
  name: string,            // из NAMES
  surname: string,         // из SURNAMES
  age: number,             // случайный возраст 18-75
  symptom: null,           // не используется (удалено)
  diagnosis: string,       // из MEDICAL_DATA[type].cases[].diagnosis (null если needsDiagnosis)
  complaint: string,       // из MEDICAL_DATA[type].cases[].complaint — жалоба от первого лица (всегда видна)
  needsDiagnosis: boolean, // true у 20% пациентов — требуется диагностика инструментом
  requiredInstrument: string|null, // 'instrument_hammer'|'instrument_rhinoscope'|'instrument_stethoscope'
  hiddenDiagnosis: string|null,    // скрытый диагноз (до диагностики)
  hiddenConsumable: string|null,   // скрытый тип препарата (до диагностики)
  vitals: {                // витальные показатели, зависят от тяжести
    temp: number,          // температура (°C), 1 знак после запятой
    bpSys: number,         // систолическое давление
    bpDia: number,         // диастолическое давление
    pulse: number           // пульс (уд/мин)
  },
  requiredConsumable: string,      // PRIMARY ключ типа ('painkiller'|'antihistamine'|'strepsils') — для MEDICAL_DATA, визуалов болезни
  requiredConsumables: string[],   // полный список нужных препаратов (1-3 шт, зависит от severity)
  pendingConsumables: string[],    // оставшиеся неприменённые (рабочая копия, shrinks при лечении)
  mesh: THREE.Group,       // 3D-модель (иерархия с суставами, см. Patient 3D Model)
  state: string,           // 'queued' | 'interacting' | 'walking' | 'atBed' | 'waiting' | 'discharged' | 'atCashier' | 'leaving'
  targetPos: Vector3|null, // целевая позиция при walking/discharged/leaving
  queueTarget: Vector3|null, // позиция в очереди
  destination: object|null,// ссылка на слот beds[] или waitingChairs[]
  indicators: THREE.Sprite[], // массив индикаторов преп��ратов над головой (по одному на pendingConsumable)
  animating: boolean,      // флаг блокиро��ки взаимодействия во время анимации
  hp: number,              // текущее здоровье
  maxHp: number,           // максимальное здоровье (100)
  severity: object,        // { key, label, startHp } — label из Game.Lang.t('severity.*') — тяжесть заболевания
  treated: boolean,        // true после применения ВСЕХ требуемых препаратов (pendingConsumables пуст)
  hpDecayTimer: number,    // таймер деградации HP (сбрасывается каждые 3 сек)
  healthBar: THREE.Sprite|null, // 3D хелсбар над головой
  healthBarCanvas: HTMLCanvasElement,
  healthBarTexture: THREE.CanvasTexture,
  lastDrawnHp: number,     // кеш для оптим��зации перерисовки
  particleTimer: number,   // таймер спавна лечебных частиц
  leavePhase: string|null, // 'toExit' | 'toStreet' — фаза ухода (только для leaving)
  fadeTimer: number|null,  // таймер fade-out при уходе
  _wasWaiting: boolean,    // флаг: пациент был в зоне ожидания перед открытием попапа
  staffProcessing: boolean,  // администратор оформляет
  staffDiagnosing: boolean,  // диагност работает
  staffTreating: boolean,    // медсестра лечит
  anim: {                  // состояние анимации
    walkPhase: number,     // фаза шагового цикла (distance-based, рад)
    walkBlend: number,     // 0..1, blend in/out анимации ходьбы
    pose: string,          // 'standing' | 'sitting' | 'lying' — текущая поза
    targetPose: string,    // целевая поза (для плавного перехода)
    poseTransition: number,// 0..1, прогресс перехода между позами
    poseFrom: string,      // предыдущая поза (для интерполяции)
    recovered: boolean,    // true после выписки (HP=100) — пациент ходит нормально
    injuryType: string     // тип травмы: 'holdStomach'|'holdBack'|'holdHead'|'holdThroat'|'limp'
  }
}
```

## Patient States
| Состояние     | Описание |
|---------------|----------|
| `queued`      | В очереди, движется к `queueTarget`, доступен для взаимодействия |
| `interacting` | Попап открыт для этого пациента |
| `walking`     | Идёт к кровати или стулу (`targetPos`) |
| `atBed`       | Лежит на кровати, доступен для лечения. Над головой индикаторы препаратов |
| `waiting`     | Сидит в зоне ожидания. Доступен для взаимодействия — можно перевести на кровать |
| `discharged`  | Выписан (HP=100), идёт к кассе на оплату |
| `atCashier`   | Стоит у кассы, ждёт оплаты через терминал |
| `leaving`     | После оплаты идёт к выходу и на улицу, fade-out при z>18 |

## Queue System
- Очередь перед ресепшном по оси Z
- **Динамический максимум очереди**: базовый лимит 2, увеличивается на 1 за каждый купленный предмет мебели (сверх начальных 5), максимум 10
  - Формула: `maxQueue = min(2 + totalFurniture - 5, 10)`, минимум 2
  - Начальное состояние: 2 кровати + 3 сту��а = 5 → maxQueue = 2
- Если очередь полна, новый пациент не появляется, уведомление "Пациент не смог зайти из-за того, что очередь переполнена"
- Позиция в очереди: `getQueuePosition(index)` → `(0, 0, -7.5 + index)`
  - index 0 → z=-7.5 (ближе к стойке)
  - index 1 → z=-6.5
- При удалении пациента из очереди → `updateQueueTargets()` сдвигает всех вперёд
- Пациенты в очереди повёрнуты на `Math.PI` (лицом к стойке)

## Spawning
- ��ациенты спавнятся ТОЛЬКО когда смена открыта (`Game.Shift.isOpen() === true`)
- Первый пациент спавнится при открытии смены через `Game.Patients.spawnFirstPatient()` — заходит пешком (НЕ телепорт)
- Далее каждые `SPAWN_INTERVAL = 10` секунд (таймер в animation loop, только при открытой смене)
- Если `queue.length >= maxQueue` → спавн не происходит, уведомление о переполнении (maxQueue = min(2 + totalFurniture - 5, 10), min 2)
- Точка появления: `(0, 0, 1)` — у входа, пациент идёт пешком к очереди
- При создании выбирается случайный тип из `CONSUMABLE_KEYS`, затем случайный case из `MEDICAL_DATA[type].cases[]` (symptom, diagnosis, complaint — связный кейс)
- Генерируются витальные показатели через `generateVitals(severity.key)` — значения коррелируют с тяжестью
- Случайный возраст 18-75 через `randomInt(18, 75)`

## Severity Distribution (при спавне)
- 60% — `mild` (Лёгкое, startHp=80)
- 25% — `medium` (Среднее, startHp=50)
- 15% — `severe` (Тяжёлое, startHp=30)

### Мульти-препаратная система (по тяжести)
При спавне на основе severity формируется список `requiredConsumables`:
- **mild** → 1 препарат: `[primaryType]`
- **medium** → 2 препарата: `[primaryType, случайный_другой]` (из оставшихся двух типов)
- **severe** → 3 препарата: все три типа `CONSUMABLE_KEYS.slice()`

`pendingConsumables` — рабочая копия `requiredConsumables`, уменьшается по мере применения.
`requiredConsumable` (singular) сохраняется для MEDICAL_DATA, жалобы, визуалов болезни.

Для `needsDiagnosis` пациентов: `requiredConsumables` и `pendingConsumables` = `null` до диагностики.
После `revealDiagnosis()` — строится список по тому же алгоритму (mild/medium/severe).

## Destination Slots
- Слоты мебели управляются системой `Game.Furniture` (динамические, не статические)
- Начальные слоты (от world.js):
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
- Позиции слотов смещены от мебели: bed slotOffset +1.0 по X, chair slotOffset -1.0 по X
- При перемещении мебели слоты авто��атически пересчитываются
- Пациенты используют только indoor слоты (`Game.Furniture.getIndoorBeds()` / `getIndoorChairs()`)
- Новая мебель доба��ляется через покупку в магазине и перенос внутрь здания

## Interaction (Raycasting)
- `interactRay`: Raycaster, far=5, направление из центра экрана (`screenCenter = Vector2(0,0)`)
- Каждый кадр: `setFromCamera(screenCenter, camera)` → пересечение со всеми мешами пациентов в состоянии `queued`/`interacting`/`atBed`/`waiting` (кроме `animating`)
- `getPatientFromMesh(object)`: обход вверх по parent до группы с `userData.bodyParts`
- При наведении: зелёная обводка через `Game.Outline.setHover([patient.mesh])`
- При уходе: обводка убирается через `Game.Outline.clearHover()`

## Popup Flow
1. ЛКМ на подсвеченного пациента �� состоянии `queued` или `waiting` → `openPopup(patient)`
2. Состояние → `interacting`, pointer unlock, попап показан
3. Попап — медицинская карта со структурой:
   - **Цветная полоса тяжести** (4px сверху): красная (severe), жёлтая (medium), зелёная (mild)
   - **Шапка**: имя + фамилия, возраст, тяжесть (цветной текст)
   - **Витальные показатели** (3 ячейки): температура °C, пульс уд/м, АД sys/dia
     - Цветовая кодировка: норма (голубой), повышенные (жёлтый `.vital-warning`), критические (красный `.vital-critical`)
     - Пороги: температура ≥39.0 = critical, ≥37.5 = warning; пульс ≥110 = critical, ≥90 = warning; АД sys ≥160 = critical, ≥140 = warning
   - **HP-бар**: горизонтальная полоса с процентом, цвет: зелёный >60%, жёлтый 30-60%, красный ≤30%
   - **Клинический бло��** (с левой акцентной линией 2px):
     - Жалоба (курсивом в «кавычках» — от первого лица пациента)
     - Диагноз (или "????" красным если needsDiagnosis)
     - **Назначение**: для мульти-препаратных (medium/severe) — список всех `requiredConsumables` через запятую; уже применённые отмечены галочкой (✓). Для mild — одно название препарата. При needsDiagnosis — "????" красным.
     - При needsDiagnosis: подсказка "Н��обходим: [инструмент]" (оранжевым)
4. **Предупреждение об outdoor мебели** (`#outdoor-warning`):
   - Если есть хотя бы одна кровать или стул на улице → показывается: "Пока кровать/стул на улице — их нельзя использовать"
   - Скрыто если вся мебель внутри здания
5. **Предупреждение о грязном белье** (`#dirty-linen-warning`):
   - Если есть хотя бы одна кровать с грязным бельём → показывается: "Грязное бельё на N кроватях — замените бельё"
   - Оба предупреждения (outdoor + dirty) могут отображаться одновременно
   - Грязные кровати НЕ считаются свободными при подсчёте: `freeBeds = indoorBeds.filter(b => !b.occupied && !isBedDirty(b))`
6. Кнопки:
   - "На кровать (X/N)" — проверяет `Game.Furniture.getIndoorBeds()`, фильтрует грязные и занятые, disabled если нет свободных
   - "В зону ожидания (X/N)" — проверяет `Game.Furniture.getIndoorChairs()`, **скрыта если пациент уже в зоне ожидания**
   - "Подождать" — закрывает попап, возвращает пациента в прежнее состояние (queued или waiting)
5. Клик по кнопке размещения → `sendPatient(patient, dest, slot)`:
   - state → `walking`, targetPos установлен, slot.occupied = true
   - Если пациент был в зоне ожидания (`_wasWaiting`), старый стул освобождается
   - Пациент удалён из queue (если был), очередь сдвинута
6. Попап закрыт, `controls.lock()` — управление возвращ��ется

## Health System
- Каждый пациент при спавне получает тяжесть заболевания (по весам 60/25/15%):
  - `severe` (Тяжёлое) → стартовое HP = 30
  - `medium` (Среднее) → стартовое HP = 50
  - `mild` (Лёгкое) → стартовое HP = 80
- Максимальное HP = 100
- **Деградация HP**: каждые 3 секунды, пока `treated === false`, пациент теряет 1 HP
  - **HP НЕ падает** пока пациент идёт к зоне ожидания (state=`walking`), идёт к кровати (state=`walking`), или во время активной мини-игры диагностики
  - Заморозка при ходьбе: state=`walking` или (state=`queued` и ещё не дошёл до позиции в очереди)
  - Заморозка при мини-игре: `Game.Diagnostics.isActive()` и `Game.Diagnostics.getPatient() === patient`
  - При HP ≤ 0 → пациент удаляется (`removePatient()`), кровать помечается грязной (`markBedDirty`), уведомление "Пациент ушел, не дождавшись помощи"
- **Восстановление HP**: после применения ВСЕХ требуемых препаратов (`treated = true`, `pendingConsumables` пуст), HP растёт на 3 ед/сек
  - При HP ≥ 100 → пациент выписывается, направляется к кассе (`dischargePatient()`), уведомление "Пациент выписан! Направлен на оплату." (зелёное)
- Логика в `updateHealthTimers(delta)`, вызывается из `update()` каждый кадр

## Discharge Flow (HP = 100)
1. `dischargePatient(patient)`:
   - Освобождает кровать (`destination.occupied = false`)
   - Если кровать → помечает бельё грязным (`Game.Furniture.markBedDirty(destination)`)
   - Удаляет все indicators (`removeAllIndicators`) и healthBar
   - `patient.treated = false` (остановка логики восстановления)
   - `patient.anim.recovered = true` — скорость и походка становятся нормальными
   - `removeIllnessVisuals(patient)` — убирает все визуальные индикаторы болезни (тинты, масштаб, доп. меши)
   - `patient.anim.targetPose = 'standing'` — пациент встаёт с кровати (плавный переход из lying), сдвигается на standing position
   - Вызывает `Game.Cashier.addPatientToQueue(patient)`
2. Пациент получает `state = 'discharged'`, `targetPos` к кассе, идёт нормальной походкой
3. Подход к кассе → `state = 'atCashier'`
4. Оплата через терминал → `state = 'leaving'`
5. Уход: к выходу (0,0,1), затем на улицу (0,0,25)
6. При z > 18: fade-out opacity за 0.8 сек → `removePatient()`

## Patient Movement
- Базовая скорость: `PATIENT_SPEED = 3.5` ед/сек
- Скорость зависит от тяжести: `getPatientSpeed(patient)` = `PATIENT_SPEED * WALK_SPEED[severity]`
  - severe: ×0.35, medium: ×0.65, mild: ×0.9, normal (после выздоровления): ×1.0
- Функция `moveToward(pos, target, maxDist)`: линейное перемещение по XZ
- В состоянии `queued`: движение к `queueTarget`
- В состоянии `walking`: движение к `targetPos`, поворот лицом к цели
- ��ри достижении цели: state → `atBed` (+ создание индикаторов `createBedIndicators`, поза → lying) или `waiting` (поза → sitting)
- В состоянии `discharged`: движение к кассе, `recovered=true`, нормальная скорость
- В состоянии `leaving`: движение к выходу (phase toExit → toStreet), fade-out при z>18

## Walk Animation System
- Фаза шагового цикла привязана к пройденному расстоянию: `walkPhase += (dist / STRIDE_LEN) * 2PI`
- `STRIDE_LEN = 1.1` — мировых единиц на полный цикл (2 шага)
- Плавный blend in/out при начале/остановке движения (walkBlend 0..1)
- Ноги: `sin(phase)` / `sin(phase + PI)` — противофазное качание вокруг X на тазобедренных суставах
  - Амплитуда: `LEG_SWING = 0.4` рад
  - При хромоте (limp): правая нога с задержкой фазы и уменьшенной амплитудой
- Руки: плечо качается в противофазе ногам, локоть слегка сгибается на заднем махе
  - `ARM_SWING = 0.35`, `ELBOW_SWING = 0.25`

## Injury Poses (при ходьбе)
- Каждый пациент при спавне получает `injuryType` из `INJURY_MAP[requiredConsumable]`:
  - **painkiller** → случайно: `holdStomach`, `holdBack`, или `limp`
  - **antihistamine** → `holdHead`
  - **strepsils** → `holdThroat`
- Эффект травмы масштабируется по `getSeverityFactor()`:
  - severe=1.0, medium=0.5, mild=0.15, recovered=0
- Каждая поза задаёт: наклон торса (hunch), опускание головы (headDroop), углы плеча и локтя для каждой руки, хромоту
- При ходьбе руки плавно интерполируются между нормальным махом и позой травмы по severity factor
- Позы:
  - `holdStomach`: hunch=0.3, обе руки согнуты к животу (shoulder=-0.8, elbow=-1.6)
  - `holdBack`: hunch=0.25, одна рука за спину (shoulder=0.4, elbow=-1.2), хромота
  - `holdHead`: hunch=0.1, обе руки п��дняты к лицу (shoulder=-1.8, elbow=-2.0)
  - `holdThroat`: hunch=0.15, од��а рука у горл�� (shoulder=-1.4, elbow=-2.2), вторая свободна
  - `limp`: hunch=0.12, руки свободны, хромота

## Illness Visual Indicators
- При спавне пациента вызывается `applyIllnessVisuals(patient)` — добавляет визуальные отличия на 3D-модель в зависимости от типа болезни
- При выписке (`dischargePatient`) вызывается `removeIllnessVisuals(patient)` — убирает все визуалы, пациент выглядит нормально
- Также вызывается в `removePatient()` и `clearAll()` для корректной очистки памяти
