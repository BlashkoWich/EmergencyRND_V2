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
- `procedureFee` — цена палаты (устанавливается при приёме через `Game.Wards.calcPayment`)

Диагностика как фаза удалена: диагноз у пациента всегда виден сразу.

## Bed Indicators (3D Sprites) — ОТКЛЮЧЕНЫ
Иконки препаратов и диагностики над головами пациентов **не отображаются**. `createBedIndicators(patient)` теперь no-op (только сбрасывает массив `patient.indicators`). Хелперы `createSingleIndicatorSprite`, `removeAllIndicators`, `removeOneIndicator`, `updateIndicators` сохранены и работают вхолостую (массив всегда пуст). Логика лечения завязана на `patient.pendingConsumables`, а не на наличие спрайтов — медсестра по-прежнему перебирает `pendingConsumables` для подбора препарата.

## Recovery Progress Bar (3D Sprite)
После применения **последнего** препарата над пациентом появляется зелёный прогресс-бар «Восстановление» (Canvas 192×28, `SpriteMaterial({ transparent: true, depthTest: false })`, `scale(0.85, 0.12, 1)`).
- Y: `1.6` (лёжа) / `2.1` (стоя/сидя), X/Z по позиции пациента.
- Цвет рамки `#22aa44`, заливка градиент `#22aa44 → #7fffaa`, текст `patient.status.recovering` слева, процент справа.
- Перерисовка только при смене целочисленного процента.
- Привязан к анимации `'recover'`. По завершении: dispose sprite/texture/material → `dischargePatient`.

## Treatment Pipeline (only nurse)

### `applyOneConsumable(patient, consumableType)` (применяется медсестрой и только медсестрой)
1. `pendingConsumables.splice(indexOf(consumableType), 1)`
2. `removeOneIndicator(patient, consumableType)` (no-op, индикаторов нет)
3. Если `pendingConsumables.length === 0`:
   - `patient.animating = true`, `patient.treated = true`
   - Запускается анимация `'recover'` (30–45с рандом, `autoDischarge: true`) с прогресс-баром над пациентом
   - Уведомление "Лечение начато!" (зелёное)
   - **Эмиссивная зелёная подсветка тела пациента удалена** — пациент во время восстановления выглядит обычно
4. Иначе (частичное):
   - Уведомление "Препарат применён! Осталось: N" (синее)
   - **Эмиссивная синяя вспышка удалена** — нет анимации, никаких флагов
5. `spawnSmileyReaction(patient)` — случайный смайл над головой

### Auto-Discharge (в `updateAnimations`)
По завершении анимации `'recover'` с флагом `autoDischarge === true`:
1. `paymentInfo = { procedure: procedureFee, total: procedureFee, reason: 'discharged' }`
2. `dischargePatient(patient)`:
   - Освобождает ward-slot
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
- **`#discharge-popup`** и `showDischargePopup`/`confirmDischarge` — замещены `autoDischarge`-флагом анимации `'recover'` (после фазы восстановления 30–45с — `dischargePatient`)
- **Состояния `recovering` / `awaitingDischargeDecision`** и `RECOVERY_DURATION` — удалены. HP-система удалена целиком.
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
- `'recover'` — фаза восстановления 30–45с (рандом на пациента); каждый кадр обновляет позицию и текстуру 3D прогресс-бара `bar`; по завершении dispose бара и, если `autoDischarge`, вызывается `dischargePatient`
- `'shake'` — тряска 0.3с + красная вспышка (зарезервировано; сейчас не используется)
- `'smiley'` — сприт-смайл, поднимается и fade-out
- `'heal'` — **удалён** (эмиссивная зелёная/синяя вспышка больше не используется)

## Health Bar
HP-система полностью **удалена**. Пациенты не имеют HP, не деградируют, не теряются по таймеру. Единственный неоплачиваемый путь ухода — «Отпустить домой» из первичного попапа (state → `leaving`).

## Healing Particle System
Удалена. После последнего препарата над пациентом появляется зелёный прогресс-бар «Восстановление» (30–45с), без свечения тела и без частиц.
