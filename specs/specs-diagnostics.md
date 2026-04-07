# EmergencyRND V2 — Диагностика пациентов

## Overview
20% пациентов приходят без диагноза — только с жалобой. Игрок должен купить диагностический инструмент, использовать его на пациенте (мини-игра), и при успехе раскрывается диагноз и назначение. Жалобы тематически связаны с инструментом диагностики.

## Undiagnosed Patients (20%)
- При спавне: `Math.random() < 0.2` → `needsDiagnosis = true`
- Скрытые поля: `hiddenDiagnosis`, `hiddenConsumable`
- Видимые: `diagnosis = null`, `requiredConsumable = null`
- Жалоба (`complaint`) всегда видна
- `requiredInstrument` определяется по `INSTRUMENT_MAP[consumableType]`
- Травма (`injuryType`) определяется по реальному типу препарата (для анимации)

## Instrument Mapping
```js
INSTRUMENT_MAP = {
  painkiller:    'instrument_hammer',      // боли, нервы, рефлексы
  antihistamine: 'instrument_rhinoscope',  // нос, пазухи, заложенность
  strepsils:     'instrument_stethoscope'  // горло, дыхание, хрипы
}
```

## Instrument Types
```js
INSTRUMENT_TYPES = {
  instrument_stethoscope: { name: Game.Lang.t('item.instrument_stethoscope'), color: 0x8866cc, size: {x:0.72, y:0.40, z:0.40} },
  instrument_hammer:      { name: Game.Lang.t('item.instrument_hammer'),     color: 0xcc8844, size: {x:0.64, y:0.56, z:0.24} },
  instrument_rhinoscope:  { name: Game.Lang.t('item.instrument_rhinoscope'), color: 0x44aacc, size: {x:0.64, y:0.32, z:0.32} }
}
```
- 3D модели инструментов масштабированы x4 (`group.scale.set(4,4,4)`)
- Размеры в INSTRUMENT_TYPES уже учитывают масштаб (для физики)

## Medical Data (20 кейсов на тип)
- Каждый кейс: `{ diagnosis, complaint }` (поле symptom удалено)
- **painkiller** (20 кейсов): боли в суставах, мышцах, нервах, спине, голове — жалобы намекают на необходимость проверки рефлексов
- **antihistamine** (20 кейсов): заложенность носа, аллергический ринит, синусит, пазухи — жалобы намекают на необходимость осмотра носа
- **strepsils** (20 кейсов): горло, кашель, хрипы, свист при дыхании, боль в груди — жалобы намекают на необходимость аускультации

## Patient Popup Changes
- **Удалена графа "Симптом"** — в попапе только: жалоба, диагноз, назначение
- При `needsDiagnosis`:
  - Диагноз и назначение → "????" красным (`#ff4444`)
  - Иконка назначения скрыта
  - Показан `#popup-instrument-hint`: "Необходим: [название инструмента]" (оранжевый)
- После диагностики: анимированное раскрытие (см. ниже)

## Bed Indicator
- Иконка конкретного предмета (не абстрактные символы):
  - `needsDiagnosis` → иконка нужного инструмента (фонендоскоп/молоток/риноскоп)
  - После диагностики → иконка нужного препарата (блистер/флакон/коробка с крестом)
- Функция `drawIndicatorIcon(ctx, type)` рисует предмет на 64x64 canvas
- Тёмный фон с цветной обводкой инструмента/препарата
- Анимация: пульсация масштаба (scale 0.34–0.46) вместо качания вверх-вниз
- Размер спрайта: `scale.set(0.4, 0.4, 1)`

## Interaction Hints (atBed)
- `needsDiagnosis` + инструмент есть в инвентаре → "ЛКМ — Диагностика ([название])"
- `needsDiagnosis` + инструмента нет в инвентаре → "Нужен инструмент ([нужный])"
- Диагностированный + есть нужный препарат в инвентаре → "ЛКМ — Лечить"
- Диагностированный + нет нужного препарата → "Нужен препарат ([нужный])"

## Diagnosis Flow (автовыбор инструмента)
1. ЛКМ на atBed пациента — система автоматически ищет нужный инструмент в инвентаре через `findAndActivate(requiredInstrument)`. Если найден → `Game.Diagnostics.startMinigame(patient, type)`. Если не найден → "Нужен: [название инструмента]"
2. controls.unlock(), показ overlay мини-игры (z-index: 25)
3. Мини-игра зависит от типа инструмента
4. При успехе → `revealDiagnosisAnimated(patient)`:
   - Открывается попап с "????" (кнопки скрыты)
   - Через 0.4с: "????" плавно исчезают (opacity → 0)
   - Через 0.9с: появляются реальные данные зелёным цветом (opacity → 1)
   - Через 2с: применяется `revealDiagnosis()`, появляется кнопка "Понятно"
   - Клик "Понятно" → закрытие попапа, возврат управления
5. Инструмент НЕ расходуется (остаётся в инвентаре)

## Mini-Games

### Фонендоскоп (strepsils)
- Заголовок и статусные тексты мини-игр берутся из `Game.Lang.t('diag.*')` ключей
- Canvas overlay с силуэтом торса пациента
- Вверху отображается жалоба пациента — игрок сам сопоставляет с анатомической областью
- 5 точек аускультации: Сердце, Левое лёгкое, Правое лёгкое, Живот, Горло
- Правильная точка определяется автоматически из текста жалобы (`getStethCorrectPoint()`):
  - "горло/голос/глотать" → Горло (4)
  - "в боку/плеврит" → Левое лёгкое (1)
  - "свист/хрип/мокрота" → Правое лёгкое (2)
  - "за грудиной/грудь" → Сердце (0)
  - "до рвоты" → Живот (3)
- Удержание 3 секунды на правильной → успех
- Неправильная → "Здесь ничего не слышно", точка тускнеет

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
- Четыре таба: "Расходники", "Инструменты", "Мебель", "Прокачка"
- Инструменты: фонендоскоп ($220), рефлекс-молоток ($220), риноскоп ($220)
- При покупке: `spawnInstrumentInDeliveryZone(type)` — одиночный предмет (не коробка)

## Instrument Items
- Используют тот же 6-слотовый инвентарь
- Тип с префиксом `instrument_` для отличия от препаратов
- Многоразовые (не расходуются при использовании)
- Физика, подбор, бросок — аналогично препаратам

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
| `shop-tab-instruments` | div | Секция инструментов |
| `inventory-active-name` | div | Название активного предмета над инвентарём |

## Integration Points
- `controls.js`: unlock handler проверяет `Game.Diagnostics.isActive()` (не показывать overlay)
- `patients.js`: raycasting и клик проверяют `Game.Diagnostics.isActive()`
- `consumables.js`: mousedown проверяет `Game.Diagnostics.isActive()`
- `shop.js`: KeyQ блокирован при `Game.Diagnostics.isActive()`
