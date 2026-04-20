# EmergencyRND V2 — Пациенты, очередь, HP, состояния

## Patient Data Pools
```
NAMES:    20 имён (10 муж + 10 жен) — из Game.Lang.t('patients.names.male/female')
SURNAMES: 20 фамилий (10 муж + 10 жен) — из Game.Lang.t('patients.surnames.male/female')
MEDICAL_DATA: { painkiller, antihistamine, strepsils } — по 20 связных cases { diagnosis, complaint } каждый
CONSUMABLE_KEYS: ['painkiller', 'antihistamine', 'strepsils']
```

## Patient Object Structure
```js
{
  id, name, surname, age,
  diagnosis,           // null если needsDiagnosis
  complaint,           // всегда видна
  needsDiagnosis,      // 30% у всех пациентов
  requiredInstrument,  // для иконки-индикатора на exam-slot
  hiddenDiagnosis,     // скрытый диагноз до обследования
  hiddenConsumable,
  vitals: { temp, bpSys, bpDia, pulse },
  requiredConsumable,     // PRIMARY тип
  requiredConsumables[],  // полный список (1-3 шт)
  pendingConsumables[],   // оставшиеся неприменённые
  isHealthy,              // 50% шанс у needsDiagnosis — болезнь не обнаружена
  hp, maxHp, hpDecayRate, // HP-система
  lost,                   // true после hp ≤ 0
  hpBar, hpBarCanvas, hpBarTexture,
  mesh: THREE.Group,
  state: string,
  targetPos, queueTarget, destination,
  diagQueueSlot, diagExamSlot,
  indicators: [],
  animating, severity,
  treated, wasDiagnosed, homeSent,
  procedureFee, treatmentFee, paymentInfo,
  leavePhase, fadeTimer,
  staffProcessing, staffDiagnosing, staffTreating,
  anim: { walkPhase, walkBlend, pose, targetPose, poseTransition, poseFrom, recovered, injuryType }
}
```

## Patient States
| Состояние | Описание |
|-----------|----------|
| `queued` | В **горизонтальной** очереди (шеренга вдоль X), только head (index 0) кликается |
| `interacting` | Первичный попап открыт |
| `walking` | Идёт к кровати/стулу |
| `walkingToDiagQueue` | Идёт к стулу очереди диагностики |
| `inDiagQueue` | Сидит на стуле очереди, ждёт освобождения exam-slot |
| `walkingToDiagExam` | Идёт к кушетке диагностики |
| `atDiagExam` | Сидит на кушетке, диагност сам инициирует обследование |
| `atBed` | Лежит на кровати, медсестра сама применяет препараты (игрок НЕ кликается) |
| `waiting` | Сидит в зоне ожидания (диагностированный буфер). При освобождении кровати авто-перевод |
| `awaitingAutoRoute` | Диагностирован на exam-slot, но нет свободных кровати/стула — ждёт. Авто-перевод при освобождении |
| `discharged` | Идёт к кассе (оплата = procedureFee + treatmentFee для discharged/home-healthy/home-after-diag) |
| `atRegister` | У кассы, таймер 10с → деньги в registerBalance → leaving |
| `leaving` | Идёт к выходу, fade-out при z>18 |

**Потеря (HP ≤ 0):** patient.lost=true, `Game.Shift.trackPatientLost()`, красная вспышка, state→`leaving` (без кассы). Освобождает все слоты.

## HP System (3D sprite + decay)

### Инициализация (в `spawnPatient`)
```js
HP_CONFIG = {
  mild:   { max: 100, start: 100, decay: 0.7 },  // HP/sec
  medium: { max: 100, start: 85,  decay: 1.2 },
  severe: { max: 100, start: 70,  decay: 1.8 }
}
```

### Decay
- Активен во всех состояниях **кроме** `recovering`/`discharged`/`atRegister`/`leaving`
- **Пауза** пока `staffDiagnosing === true` или `staffTreating === true` (сотрудник уже работает с пациентом)
- `hp -= hpDecayRate * delta`
- При `hp ≤ 0` → `losePatient(patient)`

### HP-бар (3D Sprite)
- Canvas 128×18, `THREE.CanvasTexture`, `scale(0.85, 0.13, 1)`
- Позиция: `y = 1.6` (лёжа) / `2.25` (стоя/сидя)
- Цвета: зелёный >60%, жёлтый 30–60%, красный <30%
- Ре-рендер только при смене целочисленного процента
- Всегда видим пока `!lost && !discharged && !atRegister && !leaving`

## Horizontal Queue System
- `getQueuePosition(index)` → `new THREE.Vector3(-3.0 + index * 1.2, 0, -7.5)` — шеренга вдоль X
- Пациенты повёрнуты на север (rotY = 0) — лицом к стойке (desk at z=-9)
- **Строгая шеренга:** только head (index 0) кликабелен
- `getQueueCap() = beds + diagQueueSlots + diagExamSlot + waitingChairs`

## Spawning (Slot-based Auto-Spawn — единственный режим)
- **Стартовый burst:** `initialBurstTarget = bedCount + diagQueueSlots.length`. Planned flag `needsDiagnosis` для каждого — `bedCount` раз `false`, `diagCount` раз `true`, затем Fisher–Yates shuffle для перемешивания.
- **Steady state:** поддерживается 80% занятости от `totalCap = beds + chairs + diagSlots`. Реактивные (0.5–2.5с) и safety-net таймеры.
- Условия спавна: `totalInBuilding < totalCap` и `queuedCount < getQueueCap()`.
- Точка появления: `(0, 0, 1)`.
- **Severity distribution** (по уровню):
  - Level 2: 65% mild, 35% medium
  - Level 3+: 60% mild, 25% medium, 15% severe
- **Шанс диагностики:** 30% независимо от уровня (`getDiagnosisChance()`).
- **Healthy ratio (среди needsDiagnosis):** 50% — `patient.isHealthy = true`.
- `procedureFee = BASE_PRICES[severity] ± 5` в момент спавна.
- `treatmentFee = 0` → 15 после `revealDiagnosis()` (для не-healthy).

## Destination Slots (world.js)
```js
beds = [{ pos: Vector3(-4.5, 0, -9), occupied }, ...]           // 3 шт
waitingChairs = [{ pos: Vector3(5.5, 0, -2), occupied }, ...]   // 3 шт
diagQueueSlots = [{ pos: Vector3(-2.5, 0, -15.3), occupied }, ...]  // 3 стула снаружи
diagExamSlot = { pos: Vector3(-5.5, 0, -16.5), occupied }       // 1 кушетка
```
- Bed slot offset: +1.0 по X (пациент стоит справа от кровати)
- Chair slot offset: -1.0 по X

## Interaction (Raycasting)
- `Game.Interaction.register('patients', ...)` — регистрируется **только head of queue** в состоянии `queued`/`interacting`
- Пациенты на кровати, стуле, exam-slot — **не кликабельны игроком** (только HP-бар виден)
- Hover подсветка зелёным, подсказка `patient.hint.interact` = «ЛКМ — Осмотреть»

## Popup Flow

### Первичный попап (ЛКМ по head of queue)
Медкарта: тяжесть, имя, возраст, витальные, жалоба, диагноз, назначение. Кнопки:
- Ряд 1: **«На кровать (X/N)»** | **«В диагностику (X/4)»**
- Ряд 2: **«В зону ожидания (X/N)»** | **«Отпустить домой»**
- Ошибки:
  - `needsDiagnosis === true` + «На кровать» → `popup.err.needsDiagnosis`
  - `needsDiagnosis === false` + «В диагностику» → `popup.err.noDiagnosisNeeded`
- «Отпустить домой» → сразу `leaving` (без кассы). Не учитывается в served/lost.
- Крестик `#popup-close` — deferPatientPopup (возврат в `queued`).

### Diag-result popup — УДАЛЁН
После диагностики сотрудник автоматически маршрутизирует пациента:
- `isHealthy === true` → `paymentInfo.total = procedureFee`, `reason = 'home-healthy'`, сразу к кассе
- Не здоров → `revealDiagnosis()` → свободная кровать → идёт на неё; иначе → `waitingChair`; иначе → `awaitingAutoRoute` (стоит на exam-slot, ждёт)

### Discharge popup — УДАЛЁН
После применения последнего препарата (`pendingConsumables.length === 0`):
1. `patient.treated = true`
2. Зелёная heal-анимация (0.5с, emissive flash)
3. По завершении анимации callback:
   - `paymentInfo = { procedure: procedureFee, treatment: wasDiagnosed ? 15 : 0, total, reason: 'discharged' }`
   - `dischargePatient(patient)` освобождает кровать, декремент HP кровати, state → `discharged`

## Auto-Promote (waiting → bed)
Каждый кадр `autoPromoteWaitingToBed()` сканирует свободные кровати и переводит на них **диагностированного** пациента с минимальным HP из `waiting` или `awaitingAutoRoute`. Маршрутизация через дверной проём `diagDoorWaypoint()` если пациент в диагностической комнате.

## Auto-Route After Diag (`autoRouteAfterDiag(patient)`)
Вызывается `staff.js::updateDiagnostician` при завершении диагностики:
- Healthy → payment + cashier (через дверной waypoint)
- Sick → `revealDiagnosis()`, затем bed → waitingChair → awaitingAutoRoute fallback

## Injury Poses (при ходьбе)
- `painkiller` → `holdStomach` / `holdBack` / `limp`
- `antihistamine` → `holdHead`
- `strepsils` → `holdThroat`
- Масштабируется по severity: severe=1.0, medium=0.5, mild=0.15, recovered=0

## Illness Visual Indicators
- `applyIllnessVisuals(patient)` при спавне
- `removeIllnessVisuals(patient)` при уходе/потере

## Movement
- `PATIENT_SPEED = 3.5` ед/сек
- `WALK_SPEED` одинаков для всех severity
- `anim.recovered = true` — после диагностики здоров / после лечения / отпущен домой

## No Session Persistence
- Ничего не сохраняется между сессиями
- Кэш отключён (`Cache-Control: no-cache, no-store`)
- `localStorage` используется только для `gameLang` и `graphicsQuality`
