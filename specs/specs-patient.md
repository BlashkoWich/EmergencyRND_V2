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
  state: string,           // см. Patient States ниже
  targetPos: Vector3|null,
  queueTarget: Vector3|null,
  destination: object|null,
  diagQueueSlot: object|null,  // { pos, occupied } слот очереди диагностики
  diagExamSlot: object|null,   // { pos, occupied } exam-slot внутри кабинета
  indicators: THREE.Sprite[],
  animating: boolean,
  severity: object,        // { key, label }
  treated: boolean,
  isHealthy: boolean,      // только у needsDiagnosis — 50% шанс быть здоровым
  homeSent: boolean,       // отпущен домой после диагностики без лечения
  procedureFee: number,    // стоимость приёма (= base[severity] ± variance) — вычисляется при спавне
  treatmentFee: number,    // +$15 если диагноз подтверждён, иначе 0
  paymentInfo: object|null,// { procedure, treatment, total, reason } — устанавливается перед оплатой
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
| Состояние                   | Описание |
|-----------------------------|----------|
| `queued`                    | В очереди (горизонтальный ряд), **только головной пациент (index 0)** доступен для взаимодействия |
| `interacting`               | Попап открыт для этого пациента |
| `walking`                   | Идёт к кровати или стулу |
| `walkingToDiagQueue`        | Идёт к стулу очереди диагностического кабинета |
| `inDiagQueue`               | Сидит на стуле очереди, ждёт освобождения exam-slot |
| `walkingToDiagExam`         | Идёт к кушетке диагностики внутри кабинета |
| `atDiagExam`                | Сидит на кушетке, готов к клику игрока для старта мини-игры |
| `inMinigame`                | Активна мини-игра диагностики |
| `awaitingDiagDecision`      | Попап результата диагностики открыт (или отложен). Пациент сидит на exam-slot. ЛКМ по нему переоткрывает попап |
| `atBed`                     | Лежит на кровати, доступен для лечения |
| `waiting`                   | Сидит в зоне ожидания, можно перевести на кровать |
| `recovering`                | Все препараты применены, идёт таймер восстановления (RECOVERY_DURATION=4с). Пациент лежит, индикатора нет, не кликается |
| `awaitingDischargeDecision` | Восстановление завершено — над пациентом индикатор «бланк выписки» (бумага с ручкой). ЛКМ — открывает попап выписки. После «Отложить» индикатор остаётся, ЛКМ снова открывает попап |
| `discharged`                | После подтверждения выписки / отправки домой — идёт к кассе |
| `atRegister`                | Стоит у кассы, таймер чекаута 10 сек, после — деньги в `registerBalance`, переход в `leaving` |
| `leaving`                   | После чекаута (или Reject/Home) идёт к выходу, fade-out при z>18 |

## Queue System
- **Вертикальная** очередь перед ресепшном: `getQueuePosition(index)` → `(0, 0, -7.5 + index * 1.2)` — пациенты стоят в колонну; index 0 ближе всего к стойке, следующие идут на юг
- **Строгая шеренга**: только головной пациент очереди (index 0) кликается, остальные не хайлайтятся и не реагируют на ЛКМ
- **Динамический QUEUE_CAP**: `getQueueCap() = beds + diagQueueSlots + diagExamSlot + waitingChairs` (все indoor слоты). Новый пациент не спавнится, если `queuedCount + interacting >= getQueueCap()`
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
- **Стартовый burst:** в `startWaveSystem()` массив инициализируется одним таймером `[0]` (первый пациент придёт сразу). После каждого успешного burst-спавна в массив добавляется следующий таймер с интервалом 1-3 с, пока `initialSpawnCount < initialBurstTarget`. **`initialBurstTarget = beds.length + diagQueueSlots.length`** (например, 3+3=6) — стартовая волна ровно заполняет кровати и очередь диагностики, и всем гарантированно хватает мест. Waiting-chairs не учитываются в burst. Параллельно формируется `initialPlan` — массив булевых значений `needsDiagnosis` (по одному на каждого patient в burst): `bedCount` штук `false` + `diagCount` штук `true`, после чего Fisher-Yates shuffle обеспечивает, что диагностические и не-диагностические пациенты приходят **вперемешку**.
- **Steady state** (после завершения burst): поддерживается заполнение **минимум 80% от `totalCap`** (`targetFill = ceil(totalCap * 0.8)`). Логика таймеров:
  - **(a) Реактивная:** когда пациент уходит из «считающихся» состояний (выписан, отпущен домой, отклонён и т.п.) — `totalInBuilding < prevTotalInBuilding`. На каждое такое освобождение пушится таймер. Если `totalInBuilding + pendingSpawns.length + 1 <= targetFill` (после спавна всё ещё будем ≤ 80%) → таймер быстрый (**0.5-2.5 с**). Иначе → нормальный (`STEADY_MIN-STEADY_MAX` = 10-20 с).
  - **(b) Safety-net:** каждый кадр, если `totalInBuilding + pendingSpawns.length < targetFill`, доталкиваются дополнительные быстрые таймеры (0.5-2.5 с) до заполнения целевой. Это гарантирует, что если разом освободилось несколько мест или заполнение вдруг ниже 80% — пациенты появятся быстро, а не ждать 10-20 с каждый.
  - Таймеры отрабатывают как обычно — всё ещё гейтятся `totalInBuilding < totalCap` и `queuedCount < getQueueCap()`.

Несколько таймеров могут сработать в одном кадре (если они истекли одновременно), ограничиваясь только двумя capами выше.

#### Тяжесть
Выбирается случайно в `spawnPatient()` по весам уровня:
- **Level 2:** 65% mild, 35% medium
- **Level 3+:** 60% mild, 25% medium, 15% severe

**Переменные:** `autoSpawnActive`, `initialSpawnCount`, `initialBurstTarget` (= beds+diagQueueSlots на момент старта), `initialPlan` (массив `needsDiagnosis`-флагов для burst-пациентов, шаффлится Fisher-Yates), `pendingSpawns` (массив таймеров), `prevTotalInBuilding`, `INITIAL_MIN=1`, `INITIAL_MAX=3`, `STEADY_MIN=10`, `STEADY_MAX=20`. `QUEUE_CAP` — динамический (`getQueueCap()`).
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

### Шанс диагностики (по уровню, `getDiagnosisChance()`)
- Level < 2: 0%
- Level ≥ 2: 30%

### Healthy ratio (среди `needsDiagnosis`)
- 50% окажутся здоровыми (болезнь не обнаружена) — `patient.isHealthy = true` устанавливается при спавне
- Остальные 50% — скрытая болезнь; диагноз/препарат раскрываются после мини-игры

### Ценовая модель (устанавливается в `spawnPatient`)
- `patient.procedureFee = BASE_PRICES[severity.key] + randomInt(-5, 5)` — базовая цена приёма (35/50/70 по severity)
- `patient.treatmentFee = 0` изначально; становится `15` после подтверждения диагноза (не-healthy)
- Итого для кассы формируется в `patient.paymentInfo.total`:
  - «Reject» из первичного попапа → `total = 0` (пациент идёт к выходу без кассы)
  - «Отпустить домой» из diag-попапа → `total = procedureFee`
  - Выписка после лечения → `total = procedureFee + treatmentFee`

### Мульти-препаратная система (по тяжести)
- **mild** → 1 препарат: `[primaryType]`
- **medium** → 2 препарата: `[primaryType, случайный_другой]`
- **severe** → 3 препарата: все три типа

`pendingConsumables` — рабочая копия, уменьшается по мере применения.
Для `needsDiagnosis` пациентов: списки = `null` до диагностики; для `isHealthy` после диагностики — пустой массив.

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
diagQueueSlots = [  // 3 стула вдоль восточной (боковой) стены кабинета (снаружи), колонной вдоль z
  { pos: Vector3(-2.5, 0, -15.3), occupied: bool },  // index 0 (ближе к двери)
  { pos: Vector3(-2.5, 0, -16.5), occupied: bool },
  { pos: Vector3(-2.5, 0, -17.7), occupied: bool }
]
diagExamSlot = { pos: Vector3(-5.5, 0, -16.5), occupied: bool }  // единственный стул внутри кабинета, у стола
```
- Позиции слотов: bed slotOffset +1.0 по X, chair slotOffset -1.0 по X
- Пациенты используют только indoor слоты
- Новая мебель через магазин; диагностические слоты фиксированы в `world.js` (не докупаются)

## Interaction (Raycasting)
- `interactRay`: Raycaster, far=5, от центра экрана
- Строгая очередь: меши пациентов в состоянии `queued` регистрируются **только для головы очереди** (index 0)
- Плюс все пациенты `atBed`/`waiting`/`atDiagExam` (кроме `animating`)
- Hover → зелёная обводка через `Game.Outline`

## Popup Flow

### Первичный попап (ЛКМ по головному пациенту очереди)
1. `openPopup(patient)` — медкарта: тяжесть (цветная полоса), имя, возраст, витальные, жалоба, диагноз, назначение (нет HP-бара)
2. Предупреждения: outdoor мебель, сломанные кровати
3. Единый набор кнопок вне зависимости от `needsDiagnosis`, в два ряда:
   - Ряд 1: «На кровать (X/N)», «В диагностику (X/4)»
   - Ряд 2: «В зону ожидания (X/N)» (если не `wasWaiting`), «Отпустить домой»
   - Неверное направление показывает ошибку в `#popup-error` и **не** отправляет пациента:
     - `needsDiagnosis === true` + «На кровать» → `popup.err.needsDiagnosis`
     - `needsDiagnosis === false` + «В диагностику» → `popup.err.noDiagnosisNeeded`
4. «Отпустить домой» (`#btn-reject`) → пациент идёт к выходу, **без оплаты**, не в `stat-served` и не в `stat-lost`
5. «В диагностику» (нужен `needsDiagnosis`) → если `diagExamSlot` свободен → `walkingToDiagExam`; иначе → `walkingToDiagQueue` (первый свободный `diagQueueSlots[i]`)
6. «На кровать» / «В зону ожидания» → `sendPatient()`: state → `walking`, slot.occupied = true
7. Красный крестик `#popup-close` в правом верхнем углу попапа → попап закрывается, state возвращается к `queued` (или `waiting`, если `_wasWaiting`). ЛКМ по пациенту снова открывает попап

### Мини-игра диагностики (запускается из кабинета)
ЛКМ по пациенту в `atDiagExam` → `Game.Diagnostics.startMinigame()`. state → `inMinigame`.
После успеха мини-игры → `Game.Patients.showDiagResultPopup(patient)`.

### Попап результата диагностики (`#diag-result-popup`)
Отображает:
- Имя пациента
- Результат: «Обнаружено: [diagnosis]» (зелёный) или «Пациент здоров, болезнь не обнаружена» (синий)
- Назначение (список препаратов) — только если болезнь найдена
- **Стоимость приёма: `procedureFee` (только плата за процедуру диагностики, без учёта будущего лечения)** — показывается для обоих случаев (здоров/болен)

Кнопки (разных цветов):
- Здоров: «Отпустить домой» (красная) + «Отложить» (серая) → платит `procedureFee`, идёт к кассе
- Болен:
  - «На лечение — кровать (X/N)» (зелёная) → освобождает exam-slot, идёт к кровати
  - «В зону ожидания (X/N)» (синяя) → освобождает exam-slot, идёт на стул ожидания
  - «Отпустить домой» (красная, без цены на кнопке — цена только в строке стоимости выше) → платит `procedureFee`, идёт к кассе
  - «Отложить» (серая) → закрывает попап, пациент остаётся в exam-slot со state=`awaitingDiagDecision`. Повторный ЛКМ по нему снова открывает попап

После освобождения exam-slot вызывается `advanceDiagQueue()` — первый `inDiagQueue` пациент идёт на освободившийся exam-slot.

CSS цвета кнопок: `#diag-send-bed { background: #1a6b42 }` (green), `#diag-send-wait { background: #2a6aaa }` (blue), `#diag-send-home { background: #b33232 }` (red), `.btn-defer { background: #4a4a4a }` (gray).

### Попап выписки (`#discharge-popup`)
**НЕ открывается автоматически.** После применения последнего препарата пациент входит в состояние `recovering` (таймер 4с — константа `RECOVERY_DURATION`). По истечении таймера над пациентом появляется 3D-индикатор «бланк выписки» (лист бумаги с ручкой) и state становится `awaitingDischargeDecision`. Игрок подходит, наводит прицел, делает ЛКМ → открывается попап. Показывает:
- Имя пациента
- Диагноз
- Список применённых препаратов («✓ strepsils, ✓ painkiller …»)
- **К оплате: $(procedureFee + treatmentFee)** (treatmentFee=15 если `wasDiagnosed`)
- Кнопки: «Выписать» (зелёная) → освобождает кровать, декрементит HP кровати, идёт к кассе; «Отложить» (серая) → закрывает попап, пациент остаётся в `awaitingDischargeDecision` лежа на кровати; повторный ЛКМ по нему снова открывает попап

## Health System
Удалена. Пациенты **не имеют HP**, не деградируют, не умирают, не теряются в очереди. Лечение завершается мгновенно после применения всех препаратов — открывается попап выписки.

## Patient Movement
- Базовая скорость: `PATIENT_SPEED = 3.5` ед/сек
- Все пациенты ходят с одинаковой скоростью (WALK_SPEED = 1.0)
- `recovered` устанавливается при «Отпустить домой» (healthy/home-after-diag) и при выписке после лечения

## Discharge Flow
1. Кнопка «Выписать» в попапе выписки → `confirmDischarge(patient)`
2. Устанавливает `patient.paymentInfo = { procedure, treatment, total, reason: 'discharged' }`
3. `dischargePatient()` освобождает кровать, декрементит её HP на 1, убирает визуалы болезни
4. Направляет к кассе → оплата → уход → fade-out при z>18

Для пути «Отпустить домой» (через diag-popup): `sendDiagPatientHome()` формирует `paymentInfo.total = procedureFee`, минует кровать и идёт сразу к кассе.

Для пути «Отказать» (первичный попап): `rejectPatient()` — не проходит кассу, сразу `leaving` → exit.

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
