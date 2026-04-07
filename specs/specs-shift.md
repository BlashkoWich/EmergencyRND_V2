# EmergencyRND V2 — Система смен и дней

## Overview
Игра разбита на дни. Каждый день — смена с 08:00 до 20:00 (12 игровых часов = 300 реальных секунд = 5 минут). Пациенты приходят только во время открытой смены. Когда время достигает 20:00, приём автоматически прекращается, но игрок должен дообслужить оставшихся. После оплаты последнего пациента показываются итоги дня.

## Shift Duration
```js
SHIFT_DURATION = 300  // 5 минут реального времени
// 300 реальных секунд = 12 игровых часов (08:00 → 20:00)
// 1 игровой час = 25 реальных секунд
// 1 игровая минута ≈ 0.417 реальных секунд
```

## Time Math
```js
gameHours = (gameTime / SHIFT_DURATION) * 12
displayHour = 8 + floor(gameHours)
displayMinute = floor((gameHours % 1) * 60)
// Формат: "HH:MM", cap at 20:00
```

## State
```js
shiftOpen = false       // смена активна (пациенты приходят)
shiftEnding = false     // 20:00 достигнуто, ждём дообслуживания
gameTime = 0            // 0..SHIFT_DURATION реальных секунд
dayNumber = 1           // текущий день
dayStats = {
  patientsServed: 0,    // вылечено пациентов (discharge → cashier)
  patientsLost: 0,      // потеряно (HP ≤ 0)
  moneyEarned: 0,       // заработано (оплата на кассе)
  moneySpent: 0         // потрачено (покупки в магазине)
}
dayEndPopupOpen = false // попап итогов дня показан
```

## Shift Lifecycle

### 1. Начало дня
- `shiftOpen = false`, `shiftEnding = false`
- Задача: "Откройте смену! Подойдите к табличке у входа."
- Время на HUD: 08:00, пациенты не спавнятся

### 2. Открытие смены (клик по табличке)
- `shiftOpen = true`, `gameTime = 0`, `dayStats` сброшен
- Спавн первого пациента через `Game.Patients.spawnFirstPatient()` (заходит пешком)
- Уведомление "Смена началась! День N"
- Табличка меняется на "ОТКРЫТО" (зелёная)

### 3. Смена активна
- `gameTime += delta` каждый кадр
- Пациенты спавнятся каждые 10 секунд (через `Game.Patients.update`)
- Задача: "Обслуживайте пациентов!"

### 4. 20:00 — Приём окончен
- `gameTime >= SHIFT_DURATION` → автоматически `endShiftTime()`
- `shiftOpen = false`, `shiftEnding = true`
- Новые пациенты НЕ приходят (spawn guard в patients.js проверяет `Game.Shift.isOpen()`)
- Табличка меняется на "ЗАКРЫТО" (красная)
- Уведомление "20:00 — Приём окончен! Дообслужите оставшихся пациентов."
- Задача: "Дообслужите оставшихся пациентов! (N)"

### 5. Завершение дня
- Каждый кадр проверяется `getRemainingPatients() === 0`
- Считаются только "активные" пациенты (state !== 'leaving')
- Когда все оплатили → попап итогов дня
- `controls.unlock()`, показ попапа

### 6. Следующий день
- Кнопка "Перейти в следующий день" → `dayNumber++`
- Все оставшиеся пациенты (leaving) удаляются: `Game.Patients.clearAll()`, `Game.Cashier.clearQueue()`
- Баланс НЕ сбрасывается (переносится)
- Возврат к шагу 1

## 3D Табличка Open/Closed

### Расположение
- На внутренней стороне южной стены, справа от двери
- Позиция: `(2.5, 1.8, -0.08)`, `rotY = Math.PI` (лицом внутрь)
- Крепится к стене (НЕ висит в воздухе)

### Модель
- Доска: `BoxGeometry(0.8, 0.5, 0.06)` — MeshStandardMaterial, roughness 0.4
- Лицевая панель: `PlaneGeometry(0.72, 0.42)` с CanvasTexture (256×160), z-offset +0.031
- Рамка: 4 полоски BoxGeometry по периметру, белые (0xdddddd)
- 2 кронштейна: `BoxGeometry(0.05, 0.15, 0.12)`, серые металлические (0x888888)

### Цвета
- **Открыто**: доска зелёная (0x22aa44), текст `Game.Lang.t('shift.sign.open')` белый
- **Закрыто**: доска красная (0xcc3333), текст `Game.Lang.t('shift.sign.closed')` белый

### Взаимодействие
- Raycaster far=5, от screen center
- Hover: зелёная обводка (Game.Outline) на всех мешах таблички
- Клик (ЛКМ): открывает смену (только если `!shiftOpen && !shiftEnding`)
- Подсказки: `Game.Lang.t('shift.hint.open')` / `Game.Lang.t('shift.hint.ongoing')` / `Game.Lang.t('shift.hint.ending')`
- Приоритет: ниже всех остальных систем взаимодействия

## HUD — Время и день

### Элемент: `#time-hud`
- Позиция: top center, z-index 5
- Содержит:
  - `#day-value`: `Game.Lang.t('hud.day', [dayNumber])` (цвет #7abfff)
  - `#time-value`: "HH:MM" (моноширинный шрифт)
- Стиль: полупрозрачный тёмный фон, backdrop-filter blur

## Система активных задач

### Элемент: `#task-container`
- Позиция: bottom-left (left: 16px, bottom: 120px), z-index 5
- Содержит:
  - `#task-mascot`: портрет медсестры (70×110px, canvas background-image)
  - `#task-bubble`: speech bubble с текстом задачи

### Маскот — медсестра
- Рисуется на canvas 160×240 при setup(), кэшируется как dataURL
- Русые/светлые волосы (#c8a060), зелёные глаза
- Белая форма с красным крестом, шапочка медсестры
- Портрет по пояс, стилизованный/мультяшный
- Румяна, улыбка, пропорциональная фигура

### Тексты задач
| Состояние | Текст задачи |
|-----------|-------------|
| Смена не открыта | `Game.Lang.t('shift.task.open')` |
| Смена активна | `Game.Lang.t('shift.task.serve')` |
| shiftEnding, пациенты есть | `Game.Lang.t('shift.task.finish', [remaining])` |
| shiftEnding, пациентов нет | `Game.Lang.t('shift.task.allDone')` |
| Попап итогов дня | (пусто) |

## Попап итогов дня

### Элемент: `#day-end-popup`
- z-index: 20
- Стиль: тёмно-синий фон (#0f1e2e), скруглённые углы, тень

### Содержимое
- Заголовок: `Game.Lang.t('dayEnd.title')` + номер дня
- Статистика:
  - Вылечено пациентов: `dayStats.patientsServed`
  - Потеряно пациентов: `dayStats.patientsLost`
  - Заработано: `$dayStats.moneyEarned`
  - Потрачено: `$dayStats.moneySpent`
  - Зарплата сотрудников: `$salary` (`#stat-salary`) — вычитается через `Game.Cashier.spend()`
- Кнопка "Перейти в следующий день" → `closeDayEndPopup()`

### Зарплата сотрудников
- При показе попапа: `var salary = Game.Staff.getDailySalary(); Game.Cashier.spend(salary);`
- Баланс может уйти в минус — зарплата платится всегда

### Управление
- При показе: `controls.unlock()`
- При закрытии: `controls.lock()`, `dayNumber++`, очистка пациентов

## Module: Game.Shift

### API
```js
Game.Shift.setup(THREE, scene, camera, controls, collidables)
Game.Shift.update(delta)
Game.Shift.isOpen()             // → boolean (смена активна, пациенты приходят)
Game.Shift.isPopupOpen()        // → boolean (попап итогов дня)
Game.Shift.hasInteraction()     // → boolean (hover на табличке)
Game.Shift.trackEarning(amount) // добавить к moneyEarned
Game.Shift.trackSpending(amount)// добавить к moneySpent
Game.Shift.trackPatientServed() // +1 к patientsServed
Game.Shift.trackPatientLost()   // +1 к patientsLost
```

### Internal State
```js
shiftOpen, shiftEnding, gameTime, dayNumber, dayStats
signGroup, signMeshes[], signCanvas, signTexture, signBoardMat
hoveredSign, prevHovered, dayEndPopupOpen
interactRay (Raycaster, far=5), screenCenter (Vector2(0,0))
```

## Integration Points

### patients.js
- Spawn guard: `if (Game.Shift && Game.Shift.isOpen())` перед спавном
- `spawnFirstPatient()` — спавн пешком (без instant teleport)
- `clearAll()` — удаление всех пациентов со сцены
- `getPatientCount()` → number — общее количество пациентов
- `getActivePatientCount()` → number — пациенты кроме state='leaving'
- `dischargePatient()` → вызывает `Game.Shift.trackPatientServed()`
- `removePatient()` при HP≤0 → вызывает `Game.Shift.trackPatientLost()`

### cashier.js
- `processPayment()` → вызывает `Game.Shift.trackEarning(required)`
- `spend(amount)` → вызывает `Game.Shift.trackSpending(amount)`
- `clearQueue()` — удаление пациентов из очереди кассы
- `hasPatients()` → boolean — есть ли пациенты на кассе

### controls.js
- Unlock handler проверяет `Game.Shift.isPopupOpen()`

### index.html
- Script загрузка: после diagnostics.js, перед cashier.js
- Setup: после `Game.Cashier.setup()`
- Update: в animation loop (после `Game.Cashier.update(delta)`)

## DOM Elements
| ID | Тип | Назначение |
|----|-----|------------|
| `time-hud` | div | Контейнер времени и дня |
| `day-value` | span | `Game.Lang.t('hud.day', [dayNumber])` |
| `time-value` | span | "HH:MM" |
| `task-container` | div | Контейнер задачи с маскотом |
| `task-mascot` | div | Портрет медсестры (background-image) |
| `task-bubble` | div | Speech bubble задачи |
| `task-text` | div | текст из `Game.Lang.t()` |
| `day-end-popup` | div | Попап итогов дня |
| `day-end-number` | span | Номер дня в заголовке |
| `stat-served` | span | Вылечено пациентов |
| `stat-lost` | span | Потеряно пациентов |
| `stat-earned` | span | Заработано |
| `stat-spent` | span | Потрачено |
| `day-end-next` | button | Кнопка "Перейти в следующий день", `data-lang-key="dayEnd.next"` |
