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

## Health Bar (3D Sprite)
- Создаётся при спавне пациента (`createHealthBar()`)
- Canvas 128×16 → `THREE.CanvasTexture` → `THREE.Sprite`
- Позиция `y=1.7` над головой (стоя/сидя) или `y=1.2` (лёжа)
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
