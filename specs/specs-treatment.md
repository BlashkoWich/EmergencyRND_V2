# EmergencyRND V2 — Лечение, индикаторы, анимации

## Мульти-препаратное лечение (Multi-Item Treatment)

Количество препаратов для лечения зависит от тяжести заболевания:

| Тяжесть | Кол-во препаратов | Логика выбора |
|---------|-------------------|---------------|
| `mild`   | 1 | `[primaryType]` — один основной |
| `medium` | 2 | `[primaryType, случайный_другой]` — основной + 1 из оставшихся двух |
| `severe` | 3 | Все три: `CONSUMABLE_KEYS.slice()` |

### Ключевые поля пациента
- `requiredConsumable` (string) — PRIMARY тип, используется для MEDICAL_DATA, жалобы, визуалов болезни. НЕ участвует в проверке лечения.
- `requiredConsumables` (string[]) — полный список нужных препаратов (неизменный)
- `pendingConsumables` (string[]) — оставшиеся неприменённые (уменьшается при каждом применении)
- `treated` (boolean) — `true` ТОЛЬКО когда `pendingConsumables` пуст (все препараты применены)

### Для needsDiagnosis пациентов
- До диагностики: `requiredConsumables = null`, `pendingConsumables = null`
- После `revealDiagnosis()`: строится список по тому же алгоритму (mild/medium/severe), создаются индикаторы

## Bed Indicators (3D Sprites)

Над каждым пациентом на кровати отображаются индикаторы — по одному на каждый оставшийся (`pending`) препарат.

### Создание — `createBedIndicators(patient)`
- Для `needsDiagnosis` (до диагностики): 1 индикатор с инструментом
- Для обычных: цикл по `patient.pendingConsumables`, для каждого создаётся спрайт

### Спрайт индикатора — `createSingleIndicatorSprite(itemType)`
- Canvas 64×64, `THREE.CanvasTexture` → `THREE.SpriteMaterial({ transparent: true, depthTest: false })`
- Тёмный круг с цветной рамкой (цвет из `CONSUMABLE_TYPES[type].color` / `INSTRUMENT_TYPES[type].color`)
- Иконка предмета через `drawIndicatorIcon(ctx, itemType)`
- Scale: `(0.4, 0.4, 1)`
- `sprite.userData = { consumableType: itemType }` — для идентификации при удалении

### Позиционирование (в `updateIndicators()`)
- Центрируются горизонтально над пациентом: `offsetX = (j - (count - 1) / 2) * 0.45`
  - 1 индикатор: offset = 0
  - 2 индикатора: -0.225 и +0.225
  - 3 индикатора: -0.45, 0, +0.45
- Y: `1.5` (лёжа) или `2.0` (стоя/сидя)
- Пульсация: `scale = 0.4 + sin(t + patientId + j * 0.5) * 0.06` — с фазовым сдвигом между индикаторами

### Хелперы
- `removeAllIndicators(patient)` — удаляет все спрайты из `patient.indicators[]`, dispose текстур и материалов
- `removeOneIndicator(patient, consumableType)` — удаляет спрайт с matching `userData.consumableType`, splice из массива

## Treatment System

### Подсказки при наведении (HUD hint)
- `treated === true` → "Пациент лечится..."
- `needsDiagnosis` → "ЛКМ — Диагностика" (инструмент применяется неявно — не требуется в инвентаре)
- Есть нужный препарат в инвентаре → "ЛКМ — Лечить"
- Нет нужного препарата:
  - 1 оставшийся → "Нужен препарат ([название])"
  - >1 оставшихся → "Нужны препараты: [название1], [название2]"
- `waiting` пациент → "ЛКМ — Перевести на кровать"

### ЛКМ на `atBed` пациента — прогрессивное лечение (автовыбор из инвентаря)
- Пациент уже лечится (`treated === true`) → клик игнорируется
- `staffTreating === true` → "Медсестра уже лечит этого пациента"
- **Автовыбор**: при клике система автоматически ищет подходящий препарат в инвентаре через `findAndActivateOneOf(pendingConsumables)` — игроку НЕ нужно вручную выбирать слот
- Нет подходящего препарата в инвентаре → "Нет нужных препаратов в инвентаре"
- **Hold-to-treat**: применение препарата не мгновенное — требуется удержание ЛКМ **0.75с** (`TREAT_HOLD_DURATION`). В центре экрана показывается SVG-кольцо прогресса (`#treat-hold-progress`, r=16, stroke `#4ad4ff`). Только по завершению удержания вызывается `treatPatient()` (→ `Game.Inventory.removeActive()` + `applyOneConsumable`).
  - Все early-checks (`treated`, `needsDiagnosis`, `staffTreating`, отсутствие `activeType`, `wrongTreatment` для неподходящего препарата) выполняются **мгновенно** при нажатии ЛКМ — UX уведомлений/тряски неизменен.
  - Отмена hold (`cancelTreatHold()`): отпускание ЛКМ, `hoveredPatient` изменился, потеря pointer lock, открытие попапа пациента, активная диагностика, удаление пациента, смена `state`/`treated`/`animating`/`staffTreating`, изменение `pendingConsumables` или активного слота инвентаря.
  - Подсказка `patient.hint.treat` во время удержания переключается на `patient.hint.treatHold` ("Удерживайте ЛКМ — Лечить").
  - Лечение медсестрой (`treatPatientByStaff`) — **мгновенное**, hold не применяется (NPC).
- Найден подходящий препарат:
  1. `Game.Inventory.removeActive()` — препарат убирается из инвентаря
  2. Удаляется из `pendingConsumables`, удаляется соответствующий индикатор (`removeOneIndicator`)
  3. **Если `pendingConsumables` пуст** (все применены):
     - `patient.treated = true` — запуск восстановления HP
     - Зелёная вспышка (emissive 0x00ff44, intensity 0.8→0, 0.5с)
     - Уведомление "Лечение начато!" (зелёное `rgba(34, 139, 34, 0.85)`)
     - По завершении анимации: `removeAllIndicators`, `animating = false`
  4. **Если ещё остались** (частичное лечение):
     - Синяя вспышка (emissive 0x4488ff, intensity 0.5→0, 0.3с)
     - Уведомление "Препарат применён! Осталось: N" (синее `rgba(70, 130, 180, 0.85)`)
     - По завершении анимации: `animating = false` (индикаторы остаются)
- Неправильный препарат невозможен — система автоматически выбирает только подходящий
- Во время анимации (`patient.animating=true`) повторное взаимодействие блокировано

### Лечение медсестрой — `treatPatientByStaff(patient, consumableType)`
- Проверка: `pendingConsumables.indexOf(consumableType) !== -1`
- Логика идентична `applyOneConsumable` (та же функция)
- Частичное → синяя вспышка, "Препарат применён!"
- Полное (последний) → зелёная вспышка, `treated = true`

## Notification Colors
- Зелёные (`rgba(34, 139, 34, 0.85)`): "Лечение начато!", "Пациент выписан! Направлен на оплату.", "Диагноз установлен!"
- Синие (`rgba(70, 130, 180, 0.85)`): "Препарат применён! Осталось: N"
- Красные (по умолчанию): "Неправильный препарат!", "Пациент ушел, не дождавшись помощи", "Пациент не смог зайти...", "Недостаточно средств!"

## Animation System
- Массив `animations[]` с объектами `{ patient, type, timer, maxTime, ... }`
- `updateAnimations(delta)` вызывается из `update()` каждый кадр
- Типы анимаций:
  - `'heal'` — зелёная/синяя вспышка (emissiveIntensity → 0), по завершении: сброс emissive, если `treated=true` → `removeAllIndicators`, `animating=false`
  - `'shake'` — тряска (sin-осцилляция x ±0.05, 8 колебаний за 0.3с) + красная вспышка, по завершении сброс позиции и `animating=false`
  - `'smiley'` — спрайт-смайлик над пациентом после применения препарата (см. ниже)

## Smiley Reactions
После каждого применения препарата в `applyOneConsumable` (как частичное, так и полное лечение) вызывается `spawnSmileyReaction(patient)`. Срабатывает одинаково для игрока и для медсестры.

- Пул из 10 процедурных canvas-текстур 64×64 (`smileyTextures[]`), ленивая инициализация в `initSmileyTextures()` — рисуются один раз и переиспользуются; НЕ диспозятся. Варианты: classic smile, laugh (teeth), heart-eyes, wink, grin (teeth), tongue out, relieved, star-eyes, sunglasses (cool), blushing.
- Случайный выбор индекса с защитой от повторов двух последних (`lastSmileyIndex` / `prevSmileyIndex`) через `chooseSmileyIndex()`.
- Спрайт: `THREE.Sprite` с `SpriteMaterial({ map, transparent, depthTest: false })`. Позиция: `(mesh.x, baseY, mesh.z)` где `baseY = 1.1` (лёжа/`atBed`) или `1.6` (иначе) — стартует на уровне пациента и поднимается вверх за время жизни.
- Анимация `type: 'smiley'`, длительность `SMILEY_LIFETIME = 1.4с`. На стадиях:
  - 0–15% времени — pop-in от 0 до масштаба 0.55 (линейно)
  - 15–70% — держится на 0.55
  - 70–100% — линейный fade-out opacity 1 → 0
  - на всём протяжении — подъём по Y на `SMILEY_RISE = 0.5` ед., следование за X/Z пациента
- По завершении таймера / при удалении пациента (`patients.indexOf === -1`): `scene.remove(sprite)` + `sprite.material.dispose()` (материал уникален на каждый спрайт; текстура общая).

## Health Bar (удалено)
HP-система полностью убрана. Пациенты не имеют здоровья, не деградируют и не умирают в очереди.

## Healing Particle System (удалено)
Частицы лечения удалены вместе с HP-системой — лечение завершается мгновенно после применения всех препаратов, без визуальной индикации восстановления.

## Treatment Completion → Discharge Popup
После применения последнего препарата (`patient.pendingConsumables.length === 0`) пациент помечается `treated = true`, проигрывается короткая зелёная вспышка (анимация `'heal'` длительностью 0.5 сек), и по её завершении автоматически открывается `#discharge-popup` (`Game.Patients::showDischargePopup`). В попапе:
- Имя, диагноз, список применённых препаратов
- К оплате: `procedureFee + (wasDiagnosed ? treatmentFee : 0)`
- Кнопка «Выписать» → освобождает кровать, декрементит её HP, направляет пациента к кассе (`dischargePatient` → `Game.Cashier.addPatientToQueue` с заполненным `paymentInfo`)
