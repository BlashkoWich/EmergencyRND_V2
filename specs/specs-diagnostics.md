# EmergencyRND V2 — Диагностика пациентов

## Overview
Диагностика проводится **только сотрудником-диагностом**. У игрока больше нет мини-игр и попапа результата. 30% пациентов приходят без диагноза (`needsDiagnosis = true`), среди них 50% — здоровые (скрытое поле `isHealthy = true`). Игрок отправляет таких пациентов из первичного попапа **«В диагностику»**. Пациент идёт на стул очереди или сразу на кушетку (`diagExamSlot`), где диагност самостоятельно проводит обследование. После завершения срабатывает автоматическая маршрутизация.

## Undiagnosed Patients (30%)
- При спавне: `Math.random() < 0.30` → `needsDiagnosis = true`
- Среди этих: `isHealthy = Math.random() < 0.5`
- Скрытые поля: `hiddenDiagnosis`, `hiddenConsumable`
- Видимые: `diagnosis = null`, `requiredConsumable = null`
- Жалоба всегда видна
- `requiredInstrument` определяется по `INSTRUMENT_MAP[consumableType]` (только для иконки-индикатора на exam-slot)

## Diagnostic Room
- Изолированный кабинет в СВ-углу здания (x:3..8, z:-12..-7 — устарело; см. [specs-scene.md](specs-scene.md))
- Внутри: стол с монитором, стул врача, кушетка (exam-slot)
- 3 стула-очередь снаружи (`diagQueueSlots`)
- Табличка `sign.diagnostics` над входом

## Instrument Mapping (только идентификатор иконки)
```js
INSTRUMENT_MAP = {
  painkiller:    'instrument_hammer',
  antihistamine: 'instrument_rhinoscope',
  strepsils:     'instrument_stethoscope'
}
```
Инструменты **не являются предметами** — их нельзя купить, подобрать, выложить. `patient.requiredInstrument` используется только для иконки на exam-slot (чтобы игрок видел, какой тип обследования нужен).

## Instrument Types (метаданные для иконок)
```js
INSTRUMENT_TYPES = {
  instrument_stethoscope: { name, color: 0x8866cc },
  instrument_hammer:      { name, color: 0xcc8844 },
  instrument_rhinoscope:  { name, color: 0x44aacc }
}
```

## Medical Data (20 кейсов на тип)
Не изменилось — `{ diagnosis, complaint }` из `Game.Lang.t('patients.medical.*')`.

## Patient Popup Changes
- `needsDiagnosis === true`: Диагноз и назначение → `????` красным, `#popup-instrument-hint` показывает "Требуется диагностика" (оранжевый)
- `needsDiagnosis === false`: обычный попап с диагнозом и списком препаратов
- Кнопки одинаковы в обоих случаях — «На кровать», «В диагностику», «В зону ожидания», «Отпустить домой». Неверное направление → ошибка в `#popup-error`.

## Bed Indicator (на exam-slot или кровати)
- `needsDiagnosis` на exam-slot → иконка инструмента
- После диагностики на кровати → иконки препаратов

## Diagnosis Flow (staff-only)
1. Игрок в первичном попапе жмёт «В диагностику» → пациент идёт на `diagExamSlot` (или в очередь `diagQueueSlots`, если занят)
2. Пациент садится на кушетку (state `atDiagExam`)
3. `Game.Staff.updateDiagnostician` (каждую 1с в idle) находит **сикейшего** пациента (минимум HP) в `atDiagExam` с `needsDiagnosis=true && !staffDiagnosing`, идёт к нему
4. `setTimedState(staff, 'diagnosing', randWorkDuration())` — длительность **30–45 секунд** (рандом)
5. По таймеру: `Game.Patients.autoRouteAfterDiag(patient)`
6. `advanceDiagQueue()` — следующий пациент из очереди перемещается на exam-slot

### Auto-Route After Diag
- `patient.wasDiagnosed = true`, `patient.needsDiagnosis = false`
- Если `isHealthy`:
  - `paymentInfo.total = procedureFee`, `reason = 'home-healthy'`
  - Освобождает exam-slot, идёт к кассе (через `diagDoorWaypoint`)
- Иначе:
  - `revealDiagnosis(patient)` (устанавливает `requiredConsumables`, `pendingConsumables`), `treatmentFee = 15`
  - Если есть свободная кровать → освобождает exam-slot, идёт на кровать
  - Иначе → свободный `waitingChair` (с последующим авто-переводом на кровать)
  - Иначе → state `awaitingAutoRoute` (стоит на exam-slot, ждёт; слот остаётся занят)

## Game.Diagnostics (stub)
Мини-игры (stethoscope/hammer/rhinoscope), overlay `#diagnostics-overlay` и HTML/CSS **удалены**. Модуль `js/diagnostics.js` оставлен как no-op заглушка:
```js
Game.Diagnostics = {
  setup() {},
  update() {},
  isActive() { return false; },  // для обратной совместимости
  getPatient() { return null; },
  startMinigame() {}
}
```

## Удалено (относительно предыдущей версии)
- Мини-игры для игрока: stethoscope / reflex hammer / rhinoscope
- `#diagnostics-overlay`, `#diagnostics-canvas`, `#diagnostics-close`, `#diagnostics-title` и прочие DOM
- `#diag-result-popup` и все его кнопки/обработчики
- `Game.Diagnostics.startMinigame` (stub, но реальная логика удалена)
- `popup.hint.diagnose` / `patient.hint.diagnose` — нет взаимодействия игрока с пациентом на exam-slot
- Все ключи `diag.steth.*`, `diag.hammer.*`, `diag.rhino.*`, `diag.bodyPart.*`, `diag.result.*`

## Integration Points
- `patients.js`: первичный попап направляет `walkingToDiagExam`/`walkingToDiagQueue`; `autoRouteAfterDiag()` вызывается из диагноста
- `staff.js`: `updateDiagnostician` выбирает цель по min(HP), время работы 30–45с через `randWorkDuration()`
