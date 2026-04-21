# EmergencyRND V2 — Сотрудники

## Overview
На старте игры **автоматически наняты 4 медсестры** (бесплатно, зарплата отключена). Игрок может дополнительно нанять администратора (также бесплатно) через магазин (Q). Сотрудники — автономные NPC.

Диагност и связанный с ним пайплайн удалены.

## Модуль
`Game.Staff` — файл `js/staff.js` (IIFE). Загружается после `shelves.js`, перед `trash.js`/`shift.js`.

## Типы сотрудников (все бесплатные, зарплата = 0)
```js
STAFF_TYPES = {
  administrator: { name: t('staff.administrator'), salary: 0, color: 0x2266aa, hatColor: 0x1a4a88 },
  nurse:         { name: t('staff.nurse'),         salary: 0, color: 0xcc4488, hatColor: 0xaa3366 }
}
```

## Рабочие позиции
```js
WORK_POSITIONS.administrator = { x: 0, z: -9.5, rotY: Math.PI }

NURSE_WORK_POSITIONS = [
  { x: -4, z: -11, rotY: 0 },
  { x:  4, z: -11, rotY: 0 },
  { x: -4, z: -13, rotY: 0 },
  { x:  4, z: -13, rotY: 0 }
]
```
Медсёстры встают в коридоре между палатными колоннами. Каждой при найме резервируется свободный slot (`workSlotIndex`).

## Caps
```js
MAX_NURSES = 4
```
Админ — max 1. Медсестра — до 4. `isTypeHired(type)` возвращает `true` когда cap достигнут (магазин скроет кнопку найма).

## Pre-hire на старте
В `index.html` после `Game.Staff.setup(...)`:
```js
Game.Staff.hire('nurse'); × 4
```
Админ доступен для найма через магазин.

## Work Durations
```js
var TREAT_APPLY_DURATION = 4;  // фикс 4с на один препарат
```
- Медсестра (`treating`) — `TREAT_APPLY_DURATION` (4с на каждый препарат).
- После применения **последнего** препарата пациент восстанавливается 30–45с (рандом) — логика в `patients.js`, см. `specs-treatment.md`.
- `processing` админа — 5с. `pickMedicine` медсестры — 1с.

## Магазин — вкладка «Сотрудники»
- Вкладка `data-tab="staff"` в `#shop-popup`
- Делится на блоки:
  - **Доступные** — иконка, имя, кнопка «Нанять»
  - **Нанятые** — имя, кнопка «Уволить»
- Цена зарплаты **не показывается** (salary-строки удалены из HTML/CSS)
- При найме: тип переходит в «Нанятые», max 1 на тип
- При увольнении: возврат в «Доступные»

## 3D модель сотрудника
- Процедурная (аналогична пациенту): **белый халат**, **цветной воротник** (`STAFF_TYPES.color`), **бейджик** (plane), **шапочка** (CylinderGeometry + brim, `hatColor`), scale 1.1
- `mesh.userData.isStaff = true`, `staffType = type`
- Та же скелетная структура + анимация ходьбы

## Прогресс-бар работы
3D спрайт над головой (Canvas 192×28):
```js
ACTION_LABELS = {
  processing: t('staff.status.processing'),
  diagnosing: t('staff.status.diagnosing'),
  pickMedicine: t('staff.status.pickMedicine'),
  treating: t('staff.status.treating'),
  cleaningTrash: t('staff.status.cleaningTrash')
}
```
- scale `(0.85, 0.12, 1)`, `y = 2.1 * 1.1`
- Тёмный фон с цветной рамкой (цвет по типу)
- Градиентная заливка (staff color → `#55ccff`)
- Текст слева, процент справа
- Перерисовка canvas только при смене целочисленного процента

## Движение
- `moveToward(pos, target, maxDist)`
- `faceTarget(staff, target)`
- `STAFF_SPEED = 3.5`
- Состояния walk-*: автоматически помечают `isMoving = true`

## Стейт-машины

### Медсестра (FIFO, несколько одновременно)
```
idle (каждую 1с) → строит список кандидатов:
  state === 'atBed' + !treated + !staffTreating + pendingConsumables.length > 0

  Для первого кандидата у которого препарат есть на стеллаже:
    → patient.staffTreating = true
    → heldItem = pendingConsumables[0]
    → targetSlot = slot на стеллаже
    → state = 'walkToShelf'

  Препарат недоступен → добавляет в missingMeds → HUD-предупреждение

walkToShelf → pickMedicine (1с) → takeFromSlot → walkToPatient
walkToPatient → treating (TREAT_APPLY_DURATION = 4с) → treatPatientByStaff(patient, heldItem)
returning → idle (возвращается к своему NURSE_WORK_POSITIONS[workSlotIndex])
```
**Cancel**: `patient.state !== 'atBed'`, `patient.treated`, препарат взят другим путём.

Несколько медсестёр могут параллельно лечить разных пациентов (флаг `staffTreating` на пациенте исключает перекрытие).

### Администратор (опционально — не пре-хайрен, FIFO)
```
idle (каждые 2с):
  → если есть 'waiting'-пациент и findDestinationForPatient вернул ward-slot
    → sendPatientByStaff(patient, slot.pos, slot, wardId) сразу
  → иначе берёт первого queued-пациента (FIFO, !staffProcessing) с совместимой палатой
    → summonToDesk (patient.staffProcessing = true)
    → state = 'waitingForPatient'

waitingForPatient → patient дошёл до ADMIN_DESK_POS (dist<0.15)
  → processing (5с)
  → sendPatientByStaff(patient, slot.pos, slot, wardId) в подготовленную палату
```
`findDestinationForPatient` итерирует `Game.Wards.ORDER`, предпочитая палаты с `tier === preferredTier`.

## Блокировка для игрока
- `patient.staffProcessing` → игрок видит "Администратор оформляет пациента" при попытке клика
- `patient.staffTreating` — используется только внутри staff-логики (игрок не кликает пациентов на кровати)

## Предупреждения

### Медсестра — `#nurse-warning-hud`
- Фон `rgba(180, 30, 30, 0.92)`, рамка `rgba(255, 80, 80, 0.6)`
- Заголовок: `staff.nurseWarning`
- Список отсутствующих препаратов с цветной точкой
- Пульсация `nurse-warn-pulse`
- Показывается когда медсестра нанята И есть пациент для лечения И препарата нет на стеллаже

## Зарплата — ОТКЛЮЧЕНА
- `STAFF_TYPES[*].salary = 0`
- `getDailySalary()` всегда возвращает `0`
- Ежедневный вычет в `shift.js::showDayEndPopup` удалён
- Строка `#stat-salary` в попапе конца дня **удалена**
- `fire()` не выплачивает единоразово (салари = 0)
- `notify.fired` текст упрощён (без `{1}` с суммой)

## Координация с игроком

| Сотрудник | Блокировка игрока |
|-----------|-------------------|
| Администратор | При попытке ЛКМ по head of queue: `Game.Lang.t('notify.adminProcessing')` если `staffProcessing` |
| Диагност | — (игрок не кликает пациентов на exam-slot) |
| Медсестра | — (игрок не кликает пациентов на кровати) |

## Флаги на объекте пациента
```js
patient.staffProcessing = false
patient.staffTreating = false
```

## API — публичные функции

### Game.Staff
```js
setup(THREE, scene, camera, controls, collidables)
update(delta)
hire(type)              // admin max 1; nurse max MAX_NURSES (4); бесплатно
fire(staffId)           // без выплат
getHiredStaff()         // массив нанятых
getDailySalary()        // всегда 0 (заглушка для shift.js)
isTypeHired(type)       // bool — true когда cap достигнут
countByType(type)       // → number
isPatientBeingDiagnosed(patient)  // всегда false (backward-compat)
isPatientBeingTreated(patient)
```

### Game.Patients (используются staff)
```js
getPatients()
getQueue()
sendPatientByStaff(patient, dest, slot, wardId)  // wardId опционален — устанавливает procedureFee
summonToDesk(patient, deskPos)
treatPatientByStaff(patient, consumableType)
```

## DOM-элементы
```
#shop-tab-staff             — вкладка сотрудников
.staff-hire-item            — строка найма (data-type)
.staff-hire-btn             — кнопка «Нанять»
#staff-hired-list           — блок нанятых
.staff-hired-item           — строка нанятого
.staff-fire-btn             — кнопка «Уволить» (data-id)
#staff-warnings-container   — контейнер предупреждений (fixed, top:60px, right:20px)
#nurse-warning-hud          — предупреждение медсестры
```

Удалено: `.staff-salary`, `#stat-salary`, `shop.perDay`, `shop.salary`, параметр `{1}` в `shop.fire`/`notify.fired`.

## Integration
### index.html
- `<script src="js/staff.js">` между diagnostics.js и trash.js
- `Game.Staff.setup(...)` и затем `Game.Staff.hire('nurse');` × 4
- `Game.Staff.update(delta)` в animation loop

### shop.js
- Вкладка `staff` в `tabContents`
- `refreshStaffList()` — обновление списка и видимости кнопок найма

### shift.js
- `#stat-salary` удалён; logic `getDailySalary()` больше не вызывается (возвращает 0)

### cashier.js
- `updateBalanceHUD()` — красный цвет при отрицательном балансе (практически недостижимо после удаления зарплат)

### patients.js
- Проверка `staffProcessing` перед открытием попапа
