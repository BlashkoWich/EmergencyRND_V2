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
  patientsLost: 0,      // потеряно (HP ≤ 0 или таймер волны)
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
- Level 1: Спавн первого пациента через `Game.Patients.spawnFirstPatient()`
- Level 2+: Запуск волновой системы через `Game.Patients.startWaveSystem()`
- Уведомление "Смена началась! День N"
- Табличка меняется на "ОТКРЫТО" (зелёная)

### 3. Смена активна
- `gameTime += delta` каждый кадр
- Пациенты спавнятся волнами по расписанию `WAVE_CONFIG` (через `Game.Patients.update`)
- При спавне волны — HUD-баннер с таймером 60 сек и лорным текстом
- Задача: "Обслуживайте пациентов!"

### 4. 20:00 — Приём окончен
- `gameTime >= SHIFT_DURATION` → автоматически `endShiftTime()`
- `shiftOpen = false`, `shiftEnding = true`
- Новые пациенты НЕ приходят
- Табличка → "ЗАКРЫТО" (красная)
- Задача: "Дообслужите оставшихся пациентов! (N)"

### 5. Завершение дня
- `getRemainingPatients() === 0` (state !== 'leaving')
- Попап итогов дня

### 6. Следующий день
- `dayNumber++`, `Game.Patients.clearAll()`, `Game.Cashier.clearQueue()`
- Баланс НЕ сбрасывается

## 3D Табличка Open/Closed

### Расположение
- Внутренняя сторона южной стены, справа от двери
- Позиция: `(2.5, 1.8, -0.08)`, `rotY = Math.PI` (лицом внутрь)
- Крепится к стене (НЕ висит в воздухе)

### Модель
- Доска: `BoxGeometry(0.8, 0.5, 0.06)`
- Лицевая панель: `PlaneGeometry(0.72, 0.42)` с CanvasTexture (256x160)
- Рамка: 4 полоски, белые. 2 кронштейна: серые металлические

### Цвета
- **Открыто**: зелёная (0x22aa44), белый текст
- **Закрыто**: красная (0xcc3333), белый текст

### Взаимодействие
- Raycaster far=5, hover → обводка, клик → открытие смены

## HUD — Время и день

### Элемент: `#time-hud`
- Позиция: top center, z-index 5
- Содержит: `#day-value` (голубой) + `#time-value` (моноширинный)
- Стиль: полупрозрачный тёмный фон, backdrop-filter blur

### Элемент: `#wave-banner`
- Позиция: top center, ниже time-hud (top: 55px), z-index 6
- Тёмно-красный фон, оранжевая рамка
- Содержит:
  - `#wave-text`: лорный текст (Game.Lang.t('wave.arrived'))
  - `#wave-timer-bar` + `#wave-timer-fill`: красно-оранжевая полоска обратного отсчёта
  - `#wave-timer-text`: секунды (оранжевый моноширинный)
- Класс `.urgent` при <25% времени — красное свечение
- Показывается при спавне волны, скрывается когда все пациенты распределены или ушли

## Система активных задач

### Элемент: `#task-container`
- Позиция: bottom-left, z-index 5
- Маскот-медсестра (canvas portrait) + speech bubble с задачей

### Тексты задач
| Состояние | Текст |
|-----------|-------|
| Смена не открыта | `shift.task.open` |
| Смена активна | `shift.task.serve` |
| shiftEnding, пациенты есть | `shift.task.finish` (N) |
| shiftEnding, пациентов нет | `shift.task.allDone` |

## Попап итогов дня
- z-index 20, тёмно-синий фон
- Статистика: вылечено, потеряно, заработано, потрачено, зарплата
- Зарплата платится всегда (баланс может уйти в минус)
- Кнопка "Следующий день"

## Module: Game.Shift

### API
```js
Game.Shift.setup(THREE, scene, camera, controls, collidables)
Game.Shift.update(delta)
Game.Shift.isOpen()             // → boolean
Game.Shift.isPopupOpen()        // → boolean
Game.Shift.hasInteraction()     // → boolean
Game.Shift.getDayNumber()       // → number
Game.Shift.getGameTime()        // → number (0..SHIFT_DURATION секунд)
Game.Shift.trackEarning(amount)
Game.Shift.trackSpending(amount)
Game.Shift.trackPatientServed()
Game.Shift.trackPatientLost()
```

## Integration Points

### patients.js
- Spawn guard: `Game.Shift.isOpen()` перед спавном
- `startWaveSystem()` — запуск волновой системы при открытии смены (Level 2+)
- `spawnFirstPatient()` — для Level 1 (sequential)
- `clearAll()` — очистка, сброс волн и таймеров
- `getGameTime()` — используется волновой системой для определения времени триггера волн

### cashier.js
- `processPayment()` → `trackEarning()`
- `spend(amount)` → `trackSpending()`

## DOM Elements
| ID | Тип | Назначение |
|----|-----|------------|
| `time-hud` | div | Контейнер времени и дня |
| `day-value` | span | Номер дня |
| `time-value` | span | HH:MM |
| `wave-banner` | div | Баннер волны с таймером |
| `wave-text` | div | Лорный текст волны |
| `wave-timer-bar` | div | Контейнер полоски таймера |
| `wave-timer-fill` | div | Заливка полоски таймера |
| `wave-timer-text` | div | Секунды обратного отсчёта |
| `task-container` | div | Задача с маскотом |
| `task-mascot` | div | Портрет медсестры |
| `task-bubble` | div | Speech bubble задачи |
| `task-text` | div | Текст задачи |
| `day-end-popup` | div | Попап итогов дня |
| `day-end-number` | span | Номер дня в заголовке |
| `stat-served` | span | Вылечено |
| `stat-lost` | span | Потеряно |
| `stat-earned` | span | Заработано |
| `stat-spent` | span | Потрачено |
| `day-end-next` | button | Кнопка следующего дня |

## No Session Persistence
- Никаких данных не сохраняется между сессиями
- Каждый запуск — абсолютно новая игра
- Сервер (`serve.mjs`) отдаёт все файлы с `Cache-Control: no-cache, no-store, must-revalidate`
