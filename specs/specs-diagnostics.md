# EmergencyRND V2 — Диагностика пациентов

## Overview
30% пациентов (уровни 2+) приходят без диагноза — только с жалобой (`needsDiagnosis = true`). Они направляются в **отдельный кабинет диагностики** (см. `specs-scene.md`), где сидят на кушетке, а игрок запускает мини-игру кликом. Среди диагностируемых **50% оказываются здоровыми** (болезнь не обнаружена) и **50% — больными** (болезнь скрыта, раскрывается после успешной мини-игры). После мини-игры открывается **попап результата** с опциями: на кровать / в зону ожидания / отпустить домой. Инструмент применяется неявно — не покупается, не подбирается.

## Undiagnosed Patients (30%)
- При спавне: `Math.random() < 0.30` → `needsDiagnosis = true`
- Среди этих: `isHealthy = Math.random() < 0.5`
- Скрытые поля: `hiddenDiagnosis`, `hiddenConsumable`
- Видимые: `diagnosis = null`, `requiredConsumable = null`
- Жалоба (`complaint`) всегда видна
- `requiredInstrument` определяется по `INSTRUMENT_MAP[consumableType]` (даже у healthy-пациентов — мини-игра всё равно выбирается из 3 типов)
- Травма (`injuryType`) определяется по реальному типу препарата (для анимации)

## Diagnostic Room
- Изолированный кабинет в СВ-углу здания (x:3..8, z:-12..-7)
- Стены: west interior wall (x=3), south interior wall (z=-7) с дверным проёмом шириной 1.0 (x:4.7..5.7)
- Мебель внутри: стол с монитором (5.5, 0, -11.4), стул врача (5.5, 0, -10.7) rotY=π, кушетка/стул пациента (5.5, 0, -9.5) rotY=0
- 3 стула-очередь перед дверью (x=5.2, z=-6.3/-5.1/-3.9 — index 0 ближе к двери), rotY=π (лицом на север)
- Exam slot: (5.5, 0, -9.5), 1 место
- Табличка `sign.diagnostics` над входом снаружи
- Внутренние стены добавлены в `furniture.js::WALL_SEGMENTS` для wall-clamping мебели

## Instrument Mapping (тип мини-игры)
```js
INSTRUMENT_MAP = {
  painkiller:    'instrument_hammer',      // боли, нервы, рефлексы
  antihistamine: 'instrument_rhinoscope',  // нос, пазухи, заложенность
  strepsils:     'instrument_stethoscope'  // горло, дыхание, хрипы
}
```
Инструменты больше не являются физическими предметами: их нельзя купить, подобрать, выложить в инвентарь или поставить на стеллаж/панель. `patient.requiredInstrument` используется только как идентификатор мини-игры и для визуальной иконки-подсказки над кроватью.

## Instrument Types (метаданные для иконок/подсказок)
```js
INSTRUMENT_TYPES = {
  instrument_stethoscope: { name, color: 0x8866cc },
  instrument_hammer:      { name, color: 0xcc8844 },
  instrument_rhinoscope:  { name, color: 0x44aacc }
}
```
Используется только для рисования иконки над кроватью и отображения имени/цвета при необходимости.

## Medical Data (20 кейсов на тип)
- Каждый кейс: `{ diagnosis, complaint }` (поле symptom удалено)
- **painkiller** (20 кейсов): боли в суставах, мышцах, нервах, спине, голове — жалобы намекают на необходимость проверки рефлексов
- **antihistamine** (20 кейсов): заложенность носа, аллергический ринит, синусит, пазухи — жалобы намекают на необходимость осмотра носа
- **strepsils** (20 кейсов): горло, кашель, хрипы, свист при дыхании, боль в груди — жалобы намекают на необходимость аускультации

## Patient Popup Changes
- **Удалена графа "Симптом"** — в попапе только: жалоба, диагноз, назначение (HP-бар удалён вместе со всей HP-системой)
- При `needsDiagnosis`:
  - Диагноз и назначение → "????" красным (`#ff4444`)
  - Иконка назначения скрыта
  - Показан `#popup-instrument-hint`: "Требуется диагностика" (оранжевый)
  - Кнопки: «В диагностику (X/4)», «Отказать» (bed/wait кнопки скрыты)
- При отсутствии `needsDiagnosis`: кнопки «На кровать», «В зону ожидания», «Отказать»
- После мини-игры: открывается **отдельный попап `#diag-result-popup`** (не анимированный reveal)

## Bed Indicator
- Иконка конкретного предмета (не абстрактные символы):
  - `needsDiagnosis` → иконка нужного инструмента (фонендоскоп/молоток/риноскоп)
  - После диагностики → иконка нужного препарата (блистер/флакон/коробка с крестом)
- Функция `drawIndicatorIcon(ctx, type)` рисует предмет на 64x64 canvas
- Тёмный фон с цветной обводкой инструмента/препарата
- Анимация: пульсация масштаба (scale 0.34–0.46) вместо качания вверх-вниз
- Размер спрайта: `scale.set(0.4, 0.4, 1)`

## Interaction Hints (atBed)
- `needsDiagnosis` → "ЛКМ — Диагностика"
- Диагностированный + есть нужный препарат в инвентаре → "ЛКМ — Лечить"
- Диагностированный + нет нужного препарата → "Нужен препарат ([нужный])"

## Diagnosis Flow
1. Игрок в первичном попапе жмёт «В диагностику» → пациент идёт на exam-slot (или в очередь, если exam занят)
2. Пациент садится на кушетку (state `atDiagExam`)
3. Игрок прицеливается и кликает ЛКМ → `Game.Diagnostics.startMinigame(patient, patient.requiredInstrument)`. Никаких проверок инвентаря — инструмент применяется неявно.
4. `controls.unlock()`, показ overlay мини-игры (z-index: 25)
5. Мини-игра выбирается по `patient.requiredInstrument` (тип мини-игры)
6. При успехе → `Game.Patients.showDiagResultPopup(patient)`:
   - Устанавливается `patient.wasDiagnosed = true`, `patient.needsDiagnosis = false`
   - `patient.treatmentFee = isHealthy ? 0 : 15`
   - Для `isHealthy`: показывается «Пациент здоров, болезнь не обнаружена» + только кнопка «Отпустить домой ($procedureFee)»
   - Для больных: вызывается `revealDiagnosis(patient)` (устанавливает `diagnosis`, `requiredConsumables`, `pendingConsumables`) и показываются 3 кнопки: «На лечение — кровать», «В зону ожидания», «Отпустить домой»
   - Стоимость отображается в строке `diag-result-price`
7. Выбор игрока освобождает exam-slot и вызывает `advanceDiagQueue()` — первый пациент из очереди `diagQueueSlots` идёт на exam-slot

## Mini-Games

### Фонендоскоп (strepsils)
- Заголовок и статусные тексты мини-игр берутся из `Game.Lang.t('diag.*')` ключей
- Canvas overlay с силуэтом торса пациента
- Вверху отображается жалоба пациента
- 5 точек аускультации: Сердце (0), Левое лёгкое (1), Правое лёгкое (2), Живот (3), Горло (4)
- При старте генерируется рандомная последовательность из 3 уникальных точек (`generateStethSequence()`, Fisher-Yates shuffle)
- Текущая целевая точка подсвечена ярко и пульсирует, остальные тусклые
- Наведение на целевую точку 0.5 секунды → точка засчитана (зелёная с галочкой), переход к следующей
- После первой засчитанной точки запускается глобальный таймер 6 секунд (полоска убывает сверху)
- Если таймер истекает — прогресс сбрасывается, генерируется новая последовательность, статус: "Время вышло!"
- 3 из 3 точек засчитаны → успех
- Индикатор прогресса "N/3" отображается в правом верхнем углу canvas

### Рефлекс-молоток (painkiller)
- Колено пациента (вид сбоку) с анимацией ноги
- Шкала силы удара осциллирует автоматически (0→1→0)
- Зелёная зона: 35%–65% шкалы
- ЛКМ в любом месте canvas когда шкала в зелёной зоне → нога дёргается, засчитано
- 3 успешных удара (★★★) = диагноз
- Промах по силе → "Слишком слабо/сильно"

### Риноскоп (antihistamine)
- Классический лабиринт 6×6 (recursive backtracking)
- Стилизация: розовые стенки (слизистая), тёмный фон
- Вход: верхний левый угол ("СТАРТ"), выход: нижний правый ("ОЧАГ")
- Курсор-точка движется к мыши, стенки блокируют движение
- Дойти до красной точки → мгновенный успех

## Shop Changes
- Табы: "Расходники", "Мебель", "Прокачка", "Сотрудники"
- Вкладки "Инструменты" больше НЕТ — инструменты не продаются
- Настенная панель инструментов (`ToolPanel`) удалена

## Inventory Changes
- Слоты увеличены до 76x76px
- Вместо цветных квадратов — canvas-иконки 128x128 для каждого типа предмета
- Над инвентарём отображается название активного предмета (`#inventory-active-name`)

## Module: Game.Diagnostics (`js/diagnostics.js`)

### API
```js
Game.Diagnostics.setup(controls)
Game.Diagnostics.startMinigame(patient, instrumentType)
Game.Diagnostics.isActive() → boolean
Game.Diagnostics.getPatient() → patient|null  // текущий пациент в мини-игре
Game.Diagnostics.update(delta)
```

### Internal State
```js
active = false
currentPatient = null
currentInstrument = null
currentGame = null  // 'stethoscope' | 'hammer' | 'rhinoscope'
```

## DOM Elements
| ID | Тип | Назначение |
|----|-----|------------|
| `diagnostics-overlay` | div | Overlay мини-игры (z-index: 25) |
| `diagnostics-canvas` | canvas | Игровой canvas (600×500) |
| `diagnostics-title` | div | Заголовок мини-игры |
| `diagnostics-controls` | div | Кнопки управления (динамические) |
| `diagnostics-status` | div | Статус/инструкции |
| `diagnostics-close` | button | Закрытие (×) |
| `popup-instrument-hint` | div | Подсказка инструмента в попапе |
| `shop-tabs` | div | Контейнер табов магазина |
| `shop-tab-consumables` | div | Секция препаратов |
| `inventory-active-name` | div | Название активного предмета над инвентарём |

## Integration Points
- `controls.js`: unlock handler проверяет `Game.Diagnostics.isActive()` (не показывать overlay)
- `patients.js`: raycasting и клик проверяют `Game.Diagnostics.isActive()`; `showDiagResultPopup` вызывается из `diagnostics.js::onSuccess`
- `consumables.js`: mousedown проверяет `Game.Diagnostics.isActive()`
- `shop.js`: KeyQ блокирован при `Game.Diagnostics.isActive()`
- `Game.Patients.isPopupOpen()` возвращает `true` если открыт любой из: primary popup, diag-result popup, discharge popup — это используется `controls.js` unlock handler для подавления pause-screen
