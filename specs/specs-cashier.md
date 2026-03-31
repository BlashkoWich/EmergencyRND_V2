# EmergencyRND V2 — Касса и система оплаты

## Overview
После выписки (HP = 100) пациент идёт к кассе, где игрок вводит сумму на терминале банковской карты. После оплаты пациент уходит на улицу и исчезает.

## Player Balance
- Стартовый баланс: `$100`
- HUD в правом верхнем углу (`#balance-hud`), всегда виден
- Баланс увеличивается при успешной оплате пациентом
- Баланс уменьшается при покупке препаратов в магазине ($1 за штуку)

## Pricing (по тяжести заболевания)
```js
PRICES = { mild: 30, medium: 50, severe: 80 }
```
- Лёгкое (mild, startHp=80) → $30
- Среднее (medium, startHp=50) → $50
- Тяжёлое (severe, startHp=30) → $80

## Shop Cost
- Коробка препаратов (10 штук) стоит `$10`
- При покупке вызывается `Game.Cashier.spend(10)` — списание с баланса
- Если баланс < $10 → уведомление "Недостаточно средств!", покупка не происходит

## Cashier Desk (3D)
- Позиция: `(3.5, 0, -9.5)` — справа от ресепшн-стойки
- Стол: BoxGeometry(0.8, 0.8, 0.6), деревянный цвет (0x8B6F47)
- Терминал на столе:
  - Корпус: BoxGeometry(0.22, 0.04, 0.28), тёмный (0x2a2a2a), y=0.84
  - Экран: BoxGeometry(0.16, 0.005, 0.10), зелёный (0x1a3a1a), y=0.865
  - Клавиатура: BoxGeometry(0.16, 0.005, 0.12), серая (0x3a3a3a), y=0.865
- Табличка "КАССА" на задней стене (3.5, 2.5, -11.78)
- Collision box для стола

## Patient Position at Cashier
- Позиция пациента у кассы: `(3.5, 0, -8.0)` — спереди от терминала
- Очередь за кассой: `(3.5, 0, -8.0 + index)` для index > 0

## New Patient States

### `discharged`
- Переход из `atBed` когда HP >= 100
- Освобождает кровать (`destination.occupied = false`)
- Удаляет indicator и healthBar
- Идёт к позиции кассы
- Скорость: `PATIENT_SPEED = 2.0`

### `atCashier`
- Пациент стоит у кассы, ждёт оплаты
- Только один пациент одновременно `atCashier`, остальные в очереди

### `leaving`
- После оплаты, идёт к выходу `(0, 0, 1)`, затем на улицу `(0, 0, 25)`
- `leavePhase: 'toExit' | 'toStreet'`
- При z > 18: fade-out opacity за 0.8 сек
- При opacity = 0: `removePatient()`

## Terminal Interaction

### Raycasting
- Raycaster far=3 (ближняя дистанция)
- Проверяет пересечение с мешами терминала **и** мешом пациента в состоянии `atCashier`
- Подсказка "ЛКМ — Оплата" (только когда пациент `atCashier`)
- При наведении: зелёная подсветка (emissive 0x00ff44, intensity 0.35) на терминале **и** пациенте одновременно
- При уходе прицела: подсветка сбрасывается

### Terminal Popup (`#cashier-popup`)
- z-index: 20
- Стилизация под реальный терминал банковской карты:
  - Тёмный корпус, зелёный LCD экран
  - Экран: "К оплате: $XX" + "Введено: [digits]"
  - Нумпад: кнопки 1-9, 0, C (очистка), OK (подтверждение)
  - Кнопка OK disabled пока введённая сумма !== требуемой
  - Кнопка OK с пульсирующим свечением когда активна
- При открытии: `controls.unlock()`
- При закрытии: `controls.lock()`

### Payment Flow
1. Пациент `atCashier` → игрок смотрит на терминал или пациента → подсказка
2. ЛКМ → открывается попап терминала
3. Игрок вводит сумму нажимая кнопки нумпада
4. Сумма совпадает → кнопка OK активируется
5. Нажатие OK → `balance += amount`, HUD обновляется
6. Попап закрывается, пациент переходит в `leaving`
7. Следующий пациент из очереди занимает позицию у кассы

## Module: Game.Cashier

### API
```js
Game.Cashier.setup(THREE, scene, camera, controls, cashierDesk)
Game.Cashier.update(delta)
Game.Cashier.isPopupOpen()     // → boolean
Game.Cashier.hasInteraction()  // → boolean (hover на терминал/пациента)
Game.Cashier.getBalance()      // → number
Game.Cashier.spend(amount)     // списание средств с баланса
Game.Cashier.addPatientToQueue(patient)  // добавить пациента в очередь на оплату
```

### Internal State
```js
balance = 100                  // текущий баланс
cashierQueue = []              // очередь пациентов на оплату
currentPatient = null          // текущий пациент у кассы
enteredAmount = ''             // введённая сумма (строка)
isOpen = false                 // попап открыт
hoveredTerminal = false        // курсор на терминале/пациенте
prevHovered = false            // предыдущее состояние hover (для highlight toggle)
terminalMeshes = []            // меши терминала для raycasting
patientPos = Vector3(3.5, 0, -8.0)  // позиция пациента у кассы
```

### Constants
```js
PRICES = { mild: 30, medium: 50, severe: 80 }
```

## Integration Points
- `patients.js`: при HP >= 100 вызывает `Game.Cashier.addPatientToQueue(patient)` вместо `removePatient()`
- `shop.js`: проверяет `Game.Cashier.isPopupOpen()` перед открытием магазина; вызывает `Game.Cashier.spend(1)` при покупке
- `index.html`: инициализация после `Game.Shelves.setup()`, обновление в animation loop
