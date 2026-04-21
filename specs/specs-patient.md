# EmergencyRND V2 — Пациенты, очередь, состояния

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
  diagnosis,               // всегда виден (диагностика как фаза удалена)
  complaint,
  vitals: { temp, bpSys, bpDia, pulse },
  requiredConsumable,      // PRIMARY тип препарата
  requiredConsumables[],   // полный список (1-3 шт)
  pendingConsumables[],    // оставшиеся неприменённые
  severity,                // { key: 'mild'|'medium'|'severe', label }
  preferredTier,           // 'basic' | 'improved' | 'vip' — роли́т 60/30/10
  wardId,                  // id палаты после размещения
  procedureFee,            // оплата = Game.Wards.calcPayment(wardId, patient)
  paymentInfo,             // { procedure, total, reason }
  severitySprite,          // 3D-спрайт 🟢/🟡/🔴 над головой
  mesh: THREE.Group,
  state: string,
  targetPos, queueTarget, destination,
  indicators: [],
  animating, treated,
  staffProcessing, staffTreating,
  anim: { walkPhase, walkBlend, pose, targetPose, poseTransition, poseFrom, recovered, injuryType }
}
```

**Здоровья/HP-системы нет.** Пациенты не деградируют и не теряются по таймеру. Единственный путь ухода без оплаты — кнопка «Отпустить домой» в попапе.

## Severity & Preferred Tier
- `severity`: вероятности по уровню (см. «Spawning» ниже). Показывается игроку иконкой над головой (🟢 mild / 🟡 medium / 🔴 severe) и в попапе.
- `preferredTier`: генерируется на спавне с распределением **basic 60%, improved 30%, vip 10%**.

## Patient States
| Состояние | Описание |
|-----------|----------|
| `queued` | В вертикальной очереди перед ресепшном (шеренга вдоль Z). Любой пациент кликабелен |
| `interacting` | Попап открыт |
| `walking` | Идёт к кровати (ward slot) или к стулу ожидания |
| `atBed` | Лежит на кровати в палате, медсестра применяет препараты |
| `waiting` | Сидит в зоне ожидания. Авто-перевода нет — игрок направляет в палату через попап |
| `discharged` | Идёт к кассе после лечения (оплата = procedureFee) |
| `atRegister` | У кассы, таймер 10с → деньги → leaving |
| `leaving` | К выходу + fade-out при z>18 |

## Vertical Queue
- `getQueuePosition(index)` = `Vector3(0, 0, -7.5 + index * 1.2)` — колонна вдоль Z, index 0 ближе к стойке.
- `getQueueCap() = Game.Wards.getTotalCapacity() + waitingChairs.length` (= 14 + 3 = 17).

## Spawning
Слот-авто-спавн — единственный режим, запускается при открытии смены.

- **Стартовый burst:** `initialBurstTarget = ceil(totalWardCapacity * 0.75) = 11`.
  - `initialPlan[i] = { severity, preferredTier }`.
  - Severity-микс burst: ≈ 40% mild, 35% medium, 25% severe (перетасован Fisher–Yates).
  - `preferredTier` роли́тся 60/30/10 на каждого.
- **Steady state:** поддерживается 80% занятости от `totalWardCapacity + waitingChairs.length`. Реактивные (0.5–2.5с) и safety-net таймеры.
- Условия спавна: `totalInBuilding < totalCap` и `queuedCount < getQueueCap()`.
- Точка появления: `(0, 0, 1)`.
- **Severity distribution** (steady state, по уровню):
  - Level 2: 65% mild, 35% medium
  - Level 3+: 60% mild, 25% medium, 15% severe
- `procedureFee` устанавливается **в момент приёма в палату** через `Game.Wards.calcPayment(wardId, patient)`.

## Ward Admission Logic
- Игрок выбирает палату в попапе из 6 кнопок (см. `specs-wards.md`).
- Серверная валидация (`admitToWard` в patients.js):
  - Если `!Game.Wards.accepts(wardId, patient.severity.key)` → показ ошибки `popup.err.wardTypeMismatch`, посадка запрещена.
  - Если `getFreeCount(wardId) === 0` → ошибка `popup.err.wardFull`.
  - Иначе: `procedureFee = Game.Wards.calcPayment(wardId, patient)`, пациент → `walking` → `atBed`.

## Destination Slots (world.js / Game.Wards)
```js
wards: {
  easy:     3 slots,
  easyPlus: 2 slots,
  medium:   3 slots,
  hard:     3 slots,
  hardPlus: 2 slots,
  vip:      1 slot
}  // 14 beds total
waitingChairs: 3 slots
```
Bed slot offset: патиент стоит справа (для `rotY=0`) или слева (для `rotY=π`) от койки — задаётся в world.js.

## Interaction (Raycasting)
- `Game.Interaction.register('patients', ...)` — все `queued` / `interacting` + `waiting` (`!animating`). Пациенты на кровати не кликабельны.
- Hover подсветка зелёным, подсказка `patient.hint.interact`.

## Severity Display
Сложность пациента НЕ выводится на сцене 3D-спрайтом. Игрок видит её:
- цветная полоса-индикатор сверху попапа (`#popup-severity-band`, окрашенный по ключу severity);
- в строке `#popup-tier` прямо под заголовком: «Тяжесть: Среднее • Хочет в палату: Обычная»;
- на каждой ward-кнопке в виде цветных точек `.ward-sev-dot` (🟢/🟡/🔴), показывающих какие сложности палата принимает. Точка сложности текущего пациента подсвечивается (`.ward-sev-active`).

## Popup Flow
Первичный попап (ЛКМ по пациенту): медкарта (тяжесть, имя, возраст, витальные, жалоба, диагноз, назначение), строка «Хочет в палату: {tier}», затем сетка 3×2 из 6 кнопок палат + «В зону ожидания» + «Отпустить домой».
- Каждая ward-кнопка показывает название, цену (с перечёркнутой full price если `tier` не совпал и будет списана basic-по-severity), счётчик `(free/cap)`.
- Disabled при `!accepts(severity)` (ward-disabled) или `free === 0` (ward-full).
- Клик по disabled → показ ошибки в `#popup-error`.
- Крестик `#popup-close` — возврат в `queued` / `waiting`.

## Discharge (после последнего препарата)
1. `patient.treated = true`, `animating = true`.
2. Зелёный прогресс-бар восстановления (30–45с рандом, `autoDischarge: true`).
3. По завершении: `paymentInfo = { procedure: procedureFee, total: procedureFee, reason: 'discharged' }` → `dischargePatient(patient)` (освобождает ward-slot, state → `discharged`) → касса.

## Movement
- `PATIENT_SPEED = 3.5` ед/сек.
- `WALK_SPEED` одинаков для всех severity.
- `anim.recovered = true` после полного применения препаратов / отпуска домой.

## No Session Persistence
- Ничего не сохраняется между сессиями.
- `localStorage` используется только для `gameLang` и `graphicsQuality`.
