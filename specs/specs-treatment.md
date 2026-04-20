# EmergencyRND V2 — Лечение

## Overview
Лечением занимается **только медсестра** (игрок не может применять препараты на пациентах). Игрок отвечает за пополнение стеллажей препаратами (заказ в магазине, раскладка коробок), ремонт мебели и снятие денег с кассы. После применения последнего препарата пациент автоматически выписывается на кассу — без попапа.

## Multi-Item Treatment

| Тяжесть | Кол-во препаратов | Логика |
|---------|-------------------|--------|
| `mild`   | 1 | `[primaryType]` |
| `medium` | 2 | `[primaryType, randomOther]` |
| `severe` | 3 | Все три типа |

### Ключевые поля пациента
- `requiredConsumable` (string) — PRIMARY, для MEDICAL_DATA, жалобы, визуалов
- `requiredConsumables[]` — полный список
- `pendingConsumables[]` — оставшиеся (уменьшается по применению)
- `treated` (boolean) — `true` когда `pendingConsumables` пуст
- `wasDiagnosed` — флаг для доплаты `treatmentFee = 15`

### Для needsDiagnosis
- До `revealDiagnosis()`: списки = `null`
- После `revealDiagnosis()`: строится по severity (выше), создаются индикаторы при `atBed`

## Bed Indicators (3D Sprites)
Над пациентом на кровати — по одному спрайту на каждый `pending` препарат.

### Создание — `createBedIndicators(patient)`
- `needsDiagnosis` (на exam-slot): 1 индикатор с иконкой инструмента
- Обычный `atBed`: цикл по `pendingConsumables`

### Спрайт — `createSingleIndicatorSprite(itemType)`
- Canvas 64×64, `THREE.CanvasTexture`, `SpriteMaterial({ transparent: true, depthTest: false })`
- Тёмный круг с цветной рамкой (цвет из `Game.Consumables.TYPES[type].color` / `INSTRUMENT_TYPES[type].color`)
- Иконка через `drawIndicatorIcon(ctx, itemType)`
- `scale(0.4, 0.4, 1)`
- `sprite.userData = { consumableType: itemType }`

### Позиционирование (`updateIndicators()`)
- Центрируются над пациентом: `offsetX = (j - (count - 1) / 2) * 0.45`
- Y: `1.5` (лёжа) / `2.0` (стоя/сидя)
- Пульсация: `scale = 0.4 + sin(t + patientId + j*0.5) * 0.06`

### Хелперы
- `removeAllIndicators(patient)` — dispose всех спрайтов
- `removeOneIndicator(patient, consumableType)` — удаляет по matching userData

## Treatment Pipeline (only nurse)

### `applyOneConsumable(patient, consumableType)` (применяется медсестрой и только медсестрой)
1. `pendingConsumables.splice(indexOf(consumableType), 1)`
2. `removeOneIndicator(patient, consumableType)`
3. `patient.animating = true`
4. Если `pendingConsumables.length === 0`:
   - `patient.treated = true`
   - Зелёная `'heal'`-анимация (0.5с, emissive 0x00ff44 → 0)
   - Анимация помечена `autoDischarge: true`
   - Уведомление "Лечение начато!" (зелёное)
5. Иначе (частичное):
   - Синяя вспышка (emissive 0x4488ff, 0.3с)
   - Уведомление "Препарат применён! Осталось: N" (синее)
6. `spawnSmileyReaction(patient)` — случайный смайл над головой

### Auto-Discharge (в `updateAnimations`)
По завершении `'heal'`-анимации с флагом `autoDischarge === true`:
1. `paymentInfo = { procedure: procedureFee, treatment: wasDiagnosed ? 15 : 0, total, reason: 'discharged' }`
2. `dischargePatient(patient)`:
   - Освобождает кровать
   - Декремент HP кровати
   - `removeAllIndicators`
   - state → `discharged`
   - `Game.Shift.trackPatientServed()`
   - `Game.Cashier.addPatientToQueue(patient)`

## API для staff.js
```js
Game.Patients.treatPatientByStaff(patient, consumableType)
  // Проверка: !treated && !lost && pendingConsumables.indexOf(consumableType) !== -1
  // → applyOneConsumable(patient, consumableType)
```

## Удалено относительно предыдущей версии
- **Hold-to-treat игрока** (`TREAT_HOLD_DURATION`, `startTreatHold`, `updateTreatHold`, `cancelTreatHold`, `treatPatient`) — игрок больше не лечит
- **`#treat-hold-progress`** SVG overlay
- **`patient.hint.treat` / `patient.hint.treatHold` / `patient.hint.wrongTreatment`** — не используются
- **`wrongTreatment(patient)`** — не вызывается (препарат всегда подбирается медсестрой автоматически)
- **`#discharge-popup`** и `showDischargePopup`/`confirmDischarge` — замещены `autoDischarge`
- **Состояния `recovering`/`awaitingDischargeDecision`** и `RECOVERY_DURATION` — удалены
- **3D-индикатор «бланк выписки»** (`createDischargeFormIndicator`) — удалён
- **`patient.hint.resumeDischarge` / `patient.hint.resumeDiag`** — удалены

## Smiley Reactions
После каждого `applyOneConsumable` (частичное и полное) — `spawnSmileyReaction(patient)`:
- Пул из 10 процедурных canvas-текстур 64×64 (ленивая инициализация)
- Защита от повторов двух последних через `chooseSmileyIndex()`
- Спрайт поднимается на `SMILEY_RISE = 0.5` ед за `SMILEY_LIFETIME = 1.4с`
  - 0–15% pop-in (0 → 0.55)
  - 15–70% hold на 0.55
  - 70–100% fade-out
- По завершении: dispose уникального material, общая texture остаётся

## Notification Colors
- Зелёные: "Лечение начато!", "Пациент выписан!", "Диагноз установлен!"
- Синие: "Препарат применён! Осталось: N"
- Красные: "Недостаточно средств!", "Пациент ушёл..."

## Animation System
Массив `animations[]` с объектами `{ patient, type, timer, maxTime, ... }`:
- `'heal'` — вспышка, по завершении: если `autoDischarge`, вызывается `dischargePatient`
- `'shake'` — тряска 0.3с + красная вспышка (используется при потере HP≤0)
- `'smiley'` — сприт-смайл, поднимается и fade-out

## Health Bar
HP-бар у пациентов **вернулся** — см. [specs-patient.md](specs-patient.md) §HP System.

## Healing Particle System
Удалены (лечение завершается мгновенно — зелёная вспышка 0.5с, затем выписка).
