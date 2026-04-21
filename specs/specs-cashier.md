# EmergencyRND V2 — Касса самообслуживания

## Overview
Пациент идёт к кассе самообслуживания после лечения:
1. **Выписка после лечения** — медсестра применила последний препарат → recovery-анимация → `dischargePatient()` (автоматически, `reason: 'discharged'`)

Пациент стоит у кассы 10 сек (имитация самостоятельной оплаты), после чего `paymentInfo.total` зачисляется в **банк кассы** (не в баланс игрока). Игрок периодически подходит к кассе и снимает накопленные деньги удержанием E — касса трясётся, летят зелёные частицы с `$` к камере. Над кассой — 3-уровневый индикатор (монеты / мешочек / большой мешок).

Пациенты, отклонённые через кнопку «Отпустить домой» в первичном попапе, **не проходят через кассу** — идут сразу к выходу.

## Player Balance
- Стартовый баланс: `$350`
- HUD в правом верхнем углу (`#balance-hud`), всегда виден
- Значение в HUD округляется вниз (`Math.floor(balance)`) — внутреннее значение может быть дробным во время снятия, но пользователь видит целое
- Баланс увеличивается только при **снятии** денег с кассы (tickWithdraw)
- Баланс уменьшается при покупках в магазине и выплате зарплат

## Pricing (вычисляется в `wards.js`/`patients.js`, НЕ в `cashier.js`)
Цена палаты — из `Game.Wards.TYPES` (см. `specs-wards.md`). Полная цена списывается при совпадении `ward.tier === patient.preferredTier`; при несовпадении — `BASIC_PRICE_BY_SEVERITY[patient.severity.key]` (30/40/60).

`procedureFee` устанавливается в момент **приёма в палату** (`admitToWard` или `sendPatientByStaff` с `wardId`) через `Game.Wards.calcPayment(wardId, patient)`.

### paymentInfo contract
`patient.paymentInfo = { procedure, total, reason }` формируется в `patients.js` перед вызовом `Game.Cashier.addPatientToQueue(patient)`:
- `reason: 'discharged'` → `total = procedureFee` (лечение завершено — авто после recovery-анимации)

Cashier **не** вычисляет цену — только читает `paymentInfo.total`. При отсутствии `paymentInfo` предполагается `total = 0`.

## Shop Cost
- При покупке вызывается `Game.Cashier.spend(price)` — списание с баланса
- Если баланс < цены → уведомление "Недостаточно средств!", покупка не происходит

## Self-Checkout Register (3D)
- Позиция: `(-3.5, 0, -1.5)` — слева от входа, экран направлен вглубь здания (rotation.y = Math.PI)
- Base cabinet: BoxGeometry(0.7, 0.9, 0.5), MeshLambert(0x5a5a60), y=0.45 — металлический корпус
- Top panel: BoxGeometry(0.55, 0.4, 0.08), тёмный (0x2a2a2a), y=1.15, наклон rotation.x = -0.3
- LCD screen: BoxGeometry(0.45, 0.3, 0.005), emissive 0x0a3a0a, наклон как панели, смещён вперёд
- Card reader: BoxGeometry(0.12, 0.02, 0.06), чёрный (0x111111), y=0.92, z=0.15
- Receipt slot: BoxGeometry(0.1, 0.015, 0.04), белая бумага (0xf5f5f0), y=0.92, z=0.23
- Collision box: BoxGeometry(0.8, 0.9, 0.6), invisible, добавляется в collidables
- Табличка `sign.selfService` на южной стене `(-3.5, 2.5, -0.11)` с поворотом Math.PI — видна сверху-сзади над кассой
- Касса перемещаема через `Game.Furniture.registerFixture` с `type='cashierDesk'`; `canPickUp` возвращает `true` только когда нет пациента у кассы, очередь пуста и не идёт снятие денег

## Money Indicator (3D Sprite)
Canvas-based Sprite над кассой на высоте y=1.95, следует за позицией группы (обновляется каждый кадр — касса перемещаема).

| Tier | Диапазон | Иконка |
|------|----------|--------|
| 0 | `registerBalance <= 0` | sprite.visible = false |
| 1 | `0 < balance < 50` | Маленькая стопка из 3 золотых монет с `$` |
| 2 | `50 <= balance < 150` | Коричневый мешочек со шнурком и `$` |
| 3 | `balance >= 150` | Большой мешок + 3 зелёные банкноты сверху |

Перерисовка canvas происходит только при смене tier (не каждый кадр).

## Patient Position at Register
- Позиция пациента у кассы: `(-3.5, 0, -2.5)` — перед экраном (касса смотрит на север, пациент стоит лицом на юг)
- Очередь за пациентом: `(patientPos.x, 0, patientPos.z - index * 1.0)` — хвост очереди тянется вглубь здания

## Patient States

### `discharged`
- Переход из `awaitingDischargeDecision` (после «Выписать»), из `awaitingDiagDecision` (после «Отпустить домой»)
- Освобождает кровать/exam-slot (`destination.occupied = false`)
- Удаляет индикаторы
- Идёт к позиции кассы (или очереди)
- Скорость: `PATIENT_SPEED = 3.5`

### `atRegister`
- Пациент стоит у кассы, `targetPos = null`, не двигается
- Только один пациент одновременно `atRegister`, остальные в очереди с состоянием `discharged`
- По таймеру `CHECKOUT_TIME = 10` сек → `registerBalance += paymentInfo.total`, `Game.Shift.trackEarning()`, XP, `Game.Patients.onPatientPaid()`, состояние пациента → `leaving`
- При первом переходе в `atRegister` — `Game.Tutorial.onEvent('patient_at_register')`

### `leaving`
- Идёт к выходу `(0, 0, 1)`, затем на улицу `(0, 0, 25)`
- `leavePhase: 'toExit' | 'toStreet'`
- При z > 18: fade-out opacity за 0.8 сек
- При opacity = 0: `removePatient()`

## Register Interaction

### Raycasting
- Модуль `cashier` регистрируется через `Game.Interaction.register('cashier', meshProvider, false, 3)` — far=3, non-recursive
- Провайдер возвращает все меши `cashierDeskGroup` (traverse → isMesh)
- При наведении на любую часть кассы:
  - Зелёная обводка (Game.Outline) на всей группе
  - Подсказка в `#interact-hint`:
    - `register.hint.withdraw` если `registerBalance > 0`
    - `register.hint.busy` если есть `currentPatient`
    - `register.hint.move` иначе (касса пуста и свободна — можно поднять)
- Модуль `furniture` при активном модуле `cashier` делегирует `hoveredFurniture = cashierDeskItem`, не показывая свою подсказку (чтобы cashier.js отвечал за текст)

### Withdraw Flow (hold E)
Управляется через расширение E-hold системы в `furniture.js`:
1. Игрок наводится на кассу с `registerBalance > 0`, жмёт E
2. `furniture.js` onKeyDown распознаёт `hoveredFurniture.type === 'cashierDesk' && Game.Cashier.hasMoney()` → устанавливает `eHoldMode = 'withdraw'`, вызывает `Game.Cashier.startWithdraw()`
3. Каждый кадр update-цикла:
   - `Game.Cashier.tickWithdraw(delta)` — списывает `WITHDRAW_RATE * delta` из кассы в баланс игрока
   - `WITHDRAW_RATE = 25` $/сек = 4 сек на $100
   - Тряска корпуса кассы: `group.position.x = baseX + sin(t*40)*0.025`, аналогично по z
   - Spawn suction-частиц раз в 0.08 сек — зелёные sprite с `$`, летят от экрана кассы к `camera.position`, lifetime 0.4 сек
   - SVG прогресс-кольцо `#hold-progress-arc` показывает долю `drainRemoved / drainInitial`
4. Остановка — на отпускании E, уходе прицела, опустошении кассы, или блокирующих условиях (popup/carrying):
   - `Game.Cashier.stopWithdraw()` восстанавливает позицию кассы, фаертит событие `register_withdrawn` в туториал (если `drainRemoved > 0`)
5. Деньги, снятые до момента отпускания, остаются у игрока (частичное снятие допустимо)

### Pickup/Move
- Если касса пуста и свободна, hold E (600 мс) поднимает её как обычную мебель
- `onMoved` callback обновляет `patientPos`, `targetPos` очереди, позицию индикатора

## Module: Game.Cashier

### API
```js
Game.Cashier.setup(THREE, scene, camera, controls, cashierDesk)
Game.Cashier.update(delta)

// Баланс игрока
Game.Cashier.getBalance()          // → number
Game.Cashier.spend(amount)         // списание (+ trackSpending)
Game.Cashier.earn(amount)          // прямое зачисление (ads reward и т.п.)

// Регистр (касса)
Game.Cashier.getRegisterBalance()  // → number (что лежит в кассе)
Game.Cashier.hasMoney()            // → boolean
Game.Cashier.isWithdrawing()       // → boolean
Game.Cashier.startWithdraw()
Game.Cashier.tickWithdraw(delta)
Game.Cashier.stopWithdraw()
Game.Cashier.getWithdrawProgress() // → 0..1 (drainRemoved / drainInitial)

// Hover / очередь / пациенты
Game.Cashier.hasInteraction()      // → boolean (hover на кассу с деньгами)
Game.Cashier.isDeskHovered()       // → boolean (hover на любую часть кассы)
Game.Cashier.hasPatients()         // → boolean
Game.Cashier.addPatientToQueue(patient)
Game.Cashier.clearQueue()          // между днями — удаляет меши пациентов из сцены

// Backward-compat
Game.Cashier.isPopupOpen()         // → всегда false (попап удалён)
```

### Internal State
```js
balance = 350                      // баланс игрока (может быть дробным во время снятия)
registerBalance = 0                // деньги, накопленные в кассе
registerQueue = []                 // очередь пациентов
currentPatient = null              // обслуживается сейчас
checkoutTimer = 0                  // 0..10 сек
isDraining = false                 // флаг активного снятия
drainInitial = 0                   // сколько было при старте — для SVG-прогресса
drainRemoved = 0                   // сколько уже снято
shakeTimer = 0                     // для синусоидальной тряски
baseGroupX, baseGroupZ             // исходная позиция группы (восстанавливается после shake)
indicatorSprite, indicatorCanvas, indicatorTexture
indicatorTier = -1                 // текущий tier (-1 = unset)
suctionParticles = []              // {sprite, life, maxLife, startPos}
firedAtRegister = false            // чтобы не спамить tutorial событие
```

### Constants
```js
CHECKOUT_TIME = 10.0               // секунд на одного пациента
WITHDRAW_RATE = 25                 // $/сек = 4 сек / $100
SUCTION_SPAWN_INTERVAL = 0.08      // сек между частицами
XP_BY_SEVERITY = { mild: 10, medium: 15, severe: 20 }
XP_DIAGNOSIS_BONUS = 5
// Price constants (BASE_PRICES, PRICE_VARIANCE, DIAGNOSIS_FEE) live в patients.js
```

## Integration Points
- `patients.js`: формирует `patient.paymentInfo` и вызывает `Game.Cashier.addPatientToQueue(patient)` автоматически при выписке (после recovery-анимации); `onPatientPaid()` оставлен как noop (slot-based spawn сам управляет refill)
- `shop.js`: `Game.Cashier.getBalance()` / `.spend(price)` для покупок; `.isPopupOpen()` стаб (всегда false)
- `shift.js`: `trackEarning(amount)` вызывается из cashier при начислении; зарплата больше не списывается
- `ads.js`: `earn(AD_REWARD)` после просмотра рекламы
- `furniture.js`: регистрирует кассу как fixture; расширяет E-hold новым режимом `'withdraw'` (см. Withdraw Flow)
- `index.html`: инициализация через `Game.Cashier.setup(THREE, scene, camera, controls, cashierDesk)`

## Отрицательный баланс
- Зарплата сотрудников отключена — путь к отрицательному балансу практически закрыт
- При `balance < 0`: цвет HUD `#ff4444`, рамка красная (логика оставлена на всякий случай)
- Магазин блокирует покупки при нехватке средств

## Что удалено (относительно старой кассы)
- Попап терминала `#cashier-popup` и все его кнопки (1-9, 0, C, OK)
- Стили `.terminal-*`
- Ключи локализации `cashier.due`, `cashier.entered`, `cashier.hint.pay`, `cashier.hint.move`, `cashier.staffWorking`, `sign.cashier`
- Staff-кассир (тип `cashier` в Staff системе) — полностью удалён
- API `getCurrentPatient()`, `processPaymentAuto()` (нужны были только Staff-кассиру)
- API `isStaffCashierHired()` в `Game.Staff`
- Состояние пациента `atCashier` переименовано в `atRegister`
