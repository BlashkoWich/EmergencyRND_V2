# EmergencyRND V2 — Система найма сотрудников

## Overview
Игрок может нанимать сотрудников в магазине (Q). Сотрудники — автономные NPC, которые выполняют задачи: направление пациентов, расчёт на кассе, диагностика, лечение, смена белья. Каждый тип — максимум 1 сотрудник. Зарплата выплачивается в конце дня. Баланс может уходить в минус при нехватке средств на зарплату.

## Модуль
`Game.Staff` — файл `js/staff.js` (IIFE). Загружается после `diagnostics.js`, перед `shift.js`.

Порядок загрузки:
```
... shelves.js → diagnostics.js → staff.js → shift.js → cashier.js
```

## Типы сотрудников

```js
STAFF_TYPES = {
  administrator: { name: 'Администратор', salary: 100, color: 0x2266aa, hatColor: 0x1a4a88 },
  cashier:       { name: 'Кассир',        salary: 100, color: 0x22aa66, hatColor: 0x188844 },
  diagnostician: { name: 'Диагност',      salary: 100, color: 0x8844cc, hatColor: 0x6633aa },
  nurse:         { name: 'Медсестра',      salary: 100, color: 0xcc4488, hatColor: 0xaa3366 },
  janitor:       { name: 'Уборщик',       salary: 100, color: 0x888844, hatColor: 0x666633 }
}
```

## Рабочие позиции

```js
WORK_POSITIONS = {
  administrator: { x: 0,    z: -9.5,  rotY: Math.PI },
  cashier:       { x: 3.5,  z: -10.0, rotY: 0 },
  diagnostician: { x: -5.0, z: -11.0, rotY: 0 },
  nurse:         { x: -4.0, z: -11.0, rotY: 0 },
  janitor:       { x: 6.0,  z: -10.0, rotY: 0 }
}
```

## Магазин — вкладка "Сотрудники"

- Новая вкладка `data-tab="staff"` в `#shop-popup`, контент `#shop-tab-staff`
- Делится на два блока:
  - **Доступные** (`.staff-hire-item`): иконка, название, `$100/день`, кнопка "Нанять"
  - Найм бесплатный, зарплата $100/день для всех типов сотрудников
  - **Нанятые** (`#staff-hired-list`): название, кнопка "Уволить — $X"
- При найме тип скрывается из "Доступные" и появляется в "Нанятые" (максимум 1 на тип)
- При увольнении — обратно
- Обновление списка: `refreshStaffList()` в `shop.js`, вызывается при открытии магазина и после найма/увольнения

## 3D модель сотрудника

Процедурная, аналогична пациентам, но с отличиями:
- **Белый халат** (`color: 0xffffff`) — тело
- **Цветной воротник** по `STAFF_TYPES[type].color`
- **Бейджик** на груди (маленький plane, цвет по типу)
- **Шапочка** на голове (CylinderGeometry + brim, цвет `hatColor`)
- **Масштаб 1.1** (крупнее пациентов)
- `mesh.userData.isStaff = true`, `mesh.userData.staffType = type`
- Та же скелетная структура: `poseContainer`, `bodyContainer`, `leftArm`, `rightArm`, `leftLegPivot`, `rightLegPivot`
- Анимация ходьбы: stride-based (как у пациентов), скорость `STAFF_SPEED = 3.5`

## Прогресс-бар работы

3D спрайт над головой сотрудника (Canvas 192×28):
- Появляется при выполнении действий с таймером (`ACTION_LABELS`)
- **Отличие от HP-бара пациентов**:
  - Размер: `scale(0.85, 0.12, 1)`, позиция `y = 2.1 * 1.1`
  - Тёмный фон с цветной рамкой (цвет по типу сотрудника)
  - Градиентная заливка: от цвета сотрудника до `#55ccff`
  - Текст действия слева, процент справа
  - Трек прогресса в нижней части
- Автоматически скрывается при ходьбе/idle
- Удаляется при увольнении

```js
ACTION_LABELS = {
  processing: 'Оформление',
  pickInstrument: 'Берёт инструмент',
  diagnosing: 'Диагностика',
  returnInstrument: 'Возвращает',
  pickMedicine: 'Берёт лекарство',
  treating: 'Лечение',
  changingLinen: 'Смена белья',
  depositDirty: 'Складывает',
  loadingMachine: 'Загрузка',
  collectClean: 'Собирает бельё'
}
```

## Движение

- `moveToward(pos, target, maxDist)` — прямолинейное движение к цели
- `faceTarget(staff, target)` — поворот лицом к цели через `Math.atan2`
- Скорость: `STAFF_SPEED = 3.5` (как у здоровых пациентов)
- Перемещение определяется стейт-машиной: walk-состояния (`walkToShelf`, `walkToPatient`, и т.д.)

## Стейт-машины

### Администратор

Позиция обслуживания: `ADMIN_DESK_POS = { x: 0, z: -8.5 }`

```
idle (каждые 2 сек):
  → Приоритет 1: свободная кровать + пациент из ожидания → sendPatientByStaff (мгновенно)
  → Приоритет 2: свободное место + пациент из очереди → summonToDesk
      → patient.staffProcessing = true
      → пациент идет к ADMIN_DESK_POS

waitingForPatient:
  → ждет пока пациент дойдет до столика (расстояние < 0.15)

processing (5 сек):
  → по окончании: sendPatientByStaff или release если место занято

→ idle
```

**Блокировка**: `patient.staffProcessing = true` → игрок видит "Администратор оформляет пациента"

### Кассир

```
idle → ждет patient.state === 'atCashier'
processing (5 сек) → processPaymentAuto() → idle
```

**Блокировка**: если кассир нанят, игрок НЕ может открыть терминал → "Кассир уже работает"

### Диагност

```
idle → ищет atBed + needsDiagnosis + !staffDiagnosing
  → patient.staffDiagnosing = true
  → ищет инструмент: панель → стеллаж → пол
walkToShelf → pickInstrument (1 сек) → берёт инструмент (с панели или стеллажа)
  ИЛИ walkToGround → подбирает с пола
walkToPatient → diagnosing (15 сек) → revealDiagnosis()
walkBackToShelf → returnInstrument (1 сек) → ToolPanel.placeItem или placeOnAnyShelf или бросает рядом
returning → idle
```

**Поиск инструментов**: диагност сначала проверяет панель инструментов (`Game.ToolPanel.findSlot`), затем стеллажи (`Game.Shelves.findSlotWithItem`), затем пол. При возврате инструмента — сначала пытается повесить на панель, затем fallback на стеллаж.

**Навигация**: если инструмент на панели — идёт к `ToolPanel.getPosition()` + z+0.8; если на стеллаже — к позиции слота.

**Блокировка**: `patient.staffDiagnosing` → игрок видит "Диагност уже проводит обследование"

**Предупреждение**: если инструментов нет ни на панели, ни на стеллаже, ни на полу — фиолетовый HUD-блок (`#diag-warning-hud`) с перечнем недостающих инструментов. Пульсирующая анимация. Исчезает при появлении инструмента или увольнении диагноста.

### Медсестра

Медсестра поддерживает мульти-препаратное лечение: делает **несколько ходок** (по одному препарату за раз). После доставки одного препарата возвращается в idle, затем снова находит того же пациента (если `pendingConsumables` не пуст) и несёт следующий.

```
idle (каждые 1 сек) → ищет atBed + !needsDiagnosis + !treated + !staffTreating + pendingConsumables.length > 0
  → requiredMed = patient.pendingConsumables[0]  // берёт ПЕРВЫЙ из оставшихся
  → patient.staffTreating = true
  → ищет лекарство ТОЛЬКО на стеллаже
walkToShelf → pickMedicine (1 сек) → берёт лекарство
  → если нет: красное предупреждение HUD
walkToPatient → treating (5 сек) → treatPatientByStaff(patient, heldItem)
  → проверка: если pendingConsumables.indexOf(heldItem) === -1 → cancelNurseTask (игрок уже применил)
returning → idle
  → если у пациента ещё есть pendingConsumables → на следующем цикле idle снова подберёт его
```

**Защита от дублирования**: при walkToPatient и treating проверяется `pendingConsumables.indexOf(staff.heldItem)`. Если игрок уже применил этот препарат пока медсестра шла — задача отменяется (`cancelNurseTask`), лекарство возвращается на стеллаж.

**Блокировка**: `patient.staffTreating` → игрок видит "Медсестра уже лечит этого пациента". Действует с момента начала (даже пока идёт за лекарством). Снимается после каждой доставки.

**Предупреждение**: красный HUD-блок (`#nurse-warning-hud`) с перечнем недостающих препаратов на стеллаже. Пульсирующая анимация. Исчезает при появлении лекарства на стеллаже или увольнении медсестры.

### Уборщик

```
idle (каждые 1.5 сек):
  → Приоритет 1: грязные кровати + чистое бельё в корзине → walkToCleanBasket → walkToBed
  → Приоритет 2: грязное в корзине + стиралка свободна → walkToLoadMachine
  → Приоритет 3: грязные кровати без чистого → walkToBed (только снять)

walkToCleanBasket → берёт чистое бельё из корзины
walkToBed → changingLinen (5 сек) → markBedClean, dirtyLinenCollected++
  → если есть ещё грязные — продолжает цикл
walkToDirtyBasket → depositDirty (1 сек) → складывает грязное в корзину
walkToLoadMachine → loadingMachine (1 сек) → перекладывает из грязной корзины в стиралку
  → запускает стирку ТОЛЬКО когда стиралка полная (5 шт)
waitingForWash → ждёт окончания стирки
collectClean (2 сек) → собирает чистое бельё со стиралки → в чистую корзину
returning → idle
```

## Корзины для белья

Два 3D объекта рядом со стиральной машиной:

| Корзина | Позиция | Тип предмета | Подпись на стене |
|---------|---------|--------------|-----------------|
| Чистая | `(4.2, 0, -10.5)` | `linen_clean` | ЧИСТОЕ |
| Грязная | `(6.8, 0, -10.5)` | `linen_dirty` | ГРЯЗНОЕ |

- **Ёмкость**: бесконечная
- **Модель**: открытый ящик (BoxGeometry стены + дно, деревянный цвет `0x8B7355`)
- **Collision box**: 0.8×0.6×0.6
- **Спрайт-счётчик**: показывает количество предметов в корзине (аналогично стеллажу)
- **Взаимодействие игрока**: E — положить (если в руках подходящий тип), ЛКМ — взять
- **Используются уборщиком** для промежуточного хранения белья

## Предупреждения (Staff Warning HUDs)

Контейнер `#staff-warnings-container` (fixed, top:60px, right:20px, z-index:6, flex-column, gap:8px):

### Диагност — `#diag-warning-hud`
- Фон: `rgba(100, 40, 160, 0.92)`, рамка `rgba(160, 100, 255, 0.6)`
- Заголовок: "ДИАГНОСТУ НЕ ХВАТАЕТ ИНСТРУМЕНТОВ:"
- Список: цветная точка + название инструмента
- Пульсация: `diag-warn-pulse` (фиолетовый box-shadow)
- Показывается когда диагност нанят И есть пациенты, нуждающиеся в диагностике, но инструментов нет

### Медсестра — `#nurse-warning-hud`
- Фон: `rgba(180, 30, 30, 0.92)`, рамка `rgba(255, 80, 80, 0.6)`
- Заголовок: "МЕДСЕСТРЕ НЕ ХВАТАЕТ НА СТЕЛЛАЖЕ:"
- Список: цветная точка + название препарата
- Пульсация: `nurse-warn-pulse` (красный box-shadow)
- Показывается когда медсестра нанята И есть пациенты для лечения, но лекарств нет на стеллаже

## Зарплата и конец дня

- Зарплата платится **в конце дня** автоматически в `showDayEndPopup()` (`shift.js`)
- `Game.Staff.getDailySalary()` → сумма зарплат всех нанятых
- `Game.Cashier.spend(salary)` — списание (баланс может уйти в минус)
- В попапе конца дня: строка "Зарплата сотрудников: $X" (`#stat-salary`)
- При увольнении — выплачивается зарплата за один день немедленно

### Отрицательный баланс
- `updateBalanceHUD()` в `cashier.js`: если `balance < 0`, цвет `#ff4444` (красный), рамка красная
- Магазин по-прежнему блокирует покупки при нехватке средств
- Только зарплата сотрудников может увести баланс в минус

## Координация с игроком

| Сотрудник | Блокировка для игрока |
|-----------|----------------------|
| Администратор | Пациент с `staffProcessing=true` → "Администратор оформляет пациента" |
| Кассир | Терминал полностью заблокирован → "Кассир уже работает" |
| Диагност | Мини-игра на конкретном пациенте → "Диагност уже проводит обследование" |
| Медсестра | Лечение конкретного пациента → "Медсестра уже лечит этого пациента" |
| Уборщик | Ничего не блокирует |

## Новые флаги на объекте пациента

```js
patient.staffProcessing = false  // администратор оформляет
patient.staffDiagnosing = false  // диагност работает
patient.staffTreating = false    // медсестра лечит
```

## API модулей — новые публичные функции

### Game.Staff
```js
setup(THREE, scene, camera, controls, collidables)
update(delta)
hire(type)              // создаёт и добавляет, max 1 на тип
fire(staffId)           // удаляет, платит зарплату за день
getHiredStaff()         // массив нанятых
getDailySalary()        // сумма всех зарплат
isStaffCashierHired()   // bool
isTypeHired(type)       // bool
isPatientBeingDiagnosed(patient) // bool
isPatientBeingTreated(patient)   // bool
hasBasketInteraction()  // bool
getBaskets()            // { clean, dirty }
```

### Game.Patients (новые)
```js
getPatients()           // массив всех пациентов
getQueue()              // массив очереди
sendPatientByStaff(patient, dest, slot)  // направить без попапа
summonToDesk(patient, deskPos)           // вызвать к стойке
treatPatientByStaff(patient, consumableType) // лечить без инвентаря
```

### Game.Shelves (новые)
```js
getShelves()            // массив стеллажей
findSlotWithItem(type)  // слот с предметом или null
takeFromSlot(slot)      // забрать 1 шт
placeOnAnyShelf(type)   // положить на первый подходящий стеллаж (инструменты отклоняются → false)
```

### Game.ToolPanel (новые)
```js
findSlot(type)          // слот с инструментом данного типа или null
takeFromSlot(slot)      // снять инструмент с крюка
placeItem(type)         // повесить инструмент на его крюк → boolean
getPosition()           // {x, z} координаты панели для навигации
```

### Game.Cashier (новые)
```js
getCurrentPatient()     // текущий пациент у кассы
processPaymentAuto()    // автоматическая оплата
```

### Game.WashingMachine (новые)
```js
canLoad()               // можно ли загрузить
loadOne()               // загрузить 1 шт грязного белья
isFull()                // полная ли машинка (5/5)
startWashAuto()         // запустить стирку
```

### Game.Furniture (новые)
```js
getDirtyBeds()          // массив слотов грязных кроватей
```

### Game.Consumables (новые)
```js
findNearestGroundItem(type, fromPos) // ближайший предмет на полу
removeGroundItem(mesh)               // убрать предмет с пола
getGroundItemsByType(type)           // все предметы типа на полу
```

## DOM-элементы

```
#shop-tab-staff             — контент вкладки сотрудников
.staff-hire-item            — строка найма (data-type)
.staff-hire-btn             — кнопка "Нанять"
#staff-hired-list           — блок нанятых
.staff-hired-item           — строка нанятого
.staff-fire-btn             — кнопка "Уволить" (data-id)
#staff-warnings-container   — контейнер предупреждений (fixed)
#diag-warning-hud           — предупреждение диагноста
#nurse-warning-hud          — предупреждение медсестры
#stat-salary                — строка зарплаты в попапе конца дня
```

## Integration

### index.html
- `<script src="js/staff.js">` между diagnostics.js и shift.js
- `Game.Staff.setup(...)` в блоке инициализации
- `Game.Staff.update(delta)` в animation loop (после Cashier, перед Shift)

### shop.js
- Новая вкладка `staff` в `tabContents`
- `refreshStaffList()` — обновление списка нанятых и видимости кнопок найма

### shift.js
- В `showDayEndPopup()`: вычет зарплаты через `Game.Cashier.spend()`
- Отображение в `#stat-salary`

### cashier.js
- В `openTerminal()`: блокировка при нанятом кассире
- `updateBalanceHUD()`: красный цвет при отрицательном балансе

### patients.js
- Проверка `staffProcessing` перед открытием попапа
- Проверка `staffDiagnosing` перед диагностикой
- Проверка `staffTreating` перед лечением
