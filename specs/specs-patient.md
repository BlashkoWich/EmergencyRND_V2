# EmergencyRND V2 — Пациенты, очереди, препараты, лечение

## Patient Data Pools
```
NAMES:    20 русских имён (10 муж + 10 жен)
SURNAMES: 20 русских фамилий (10 муж + 10 жен)
MEDICAL_DATA: структурированный объект по типам препаратов, каждый содержит массив cases[]:
  Каждый case = { diagnosis, complaint } — связный медицинский кейс (поле symptom удалено)
  Жалобы тематически связаны с инструментом диагностики для данного типа:
  painkiller:     20 кейсов (боли, нервы, суставы, мышцы — диагностика рефлекс-молотком)
  antihistamine:  20 кейсов (нос, пазухи, заложенность, аллергический ринит — диагностика риноскопом)
  strepsils:      20 кейсов (горло, кашель, хрипы, дыхание — диагностика фонендоскопом)
CONSUMABLE_KEYS: ['painkiller', 'antihistamine', 'strepsils']
```

## Patient Object Structure
```js
{
  id: number,              // автоинкремент
  name: string,            // из NAMES
  surname: string,         // из SURNAMES
  age: number,             // случайный возраст 18-75
  symptom: null,           // не используется (удалено)
  diagnosis: string,       // из MEDICAL_DATA[type].cases[].diagnosis (null если needsDiagnosis)
  complaint: string,       // из MEDICAL_DATA[type].cases[].complaint — жалоба от первого лица (всегда видна)
  needsDiagnosis: boolean, // true у 20% пациентов — требуется диагностика инструментом
  requiredInstrument: string|null, // 'instrument_hammer'|'instrument_rhinoscope'|'instrument_stethoscope'
  hiddenDiagnosis: string|null,    // скрытый диагноз (до диагностики)
  hiddenConsumable: string|null,   // скрытый тип препарата (до диагностики)
  vitals: {                // витальные показатели, зависят от тяжести
    temp: number,          // температура (°C), 1 знак после запятой
    bpSys: number,         // систолическое давление
    bpDia: number,         // диастолическое давление
    pulse: number           // пульс (уд/мин)
  },
  requiredConsumable: string, // ключ типа препарата ('painkiller'|'antihistamine'|'strepsils')
  mesh: THREE.Group,       // 3D-модель (иерархия с суставами, см. Patient 3D Model)
  state: string,           // 'queued' | 'interacting' | 'walking' | 'atBed' | 'waiting' | 'discharged' | 'atCashier' | 'leaving'
  targetPos: Vector3|null, // целевая позиция при walking/discharged/leaving
  queueTarget: Vector3|null, // позиция в очереди
  destination: object|null,// ссылка на слот beds[] или waitingChairs[]
  indicator: THREE.Sprite|null, // индикатор препарата над головой (создаётся при atBed)
  animating: boolean,      // флаг блокировки взаимодействия во время анимации
  hp: number,              // текущее здоровье
  maxHp: number,           // максимальное здоровье (100)
  severity: object,        // { key, label, startHp } — тяжесть заболевания
  treated: boolean,        // true после применения правильного препарата
  hpDecayTimer: number,    // таймер деградации HP (сбрасывается каждые 3 сек)
  healthBar: THREE.Sprite|null, // 3D хелсбар над головой
  healthBarCanvas: HTMLCanvasElement,
  healthBarTexture: THREE.CanvasTexture,
  lastDrawnHp: number,     // кеш для оптимизации перерисовки
  particleTimer: number,   // таймер спавна лечебных частиц
  leavePhase: string|null, // 'toExit' | 'toStreet' — фаза ухода (только для leaving)
  fadeTimer: number|null,  // таймер fade-out при уходе
  _wasWaiting: boolean,    // флаг: пациент был в зоне ожидания перед открытием попапа
  anim: {                  // состояние анимации
    walkPhase: number,     // фаза шагового цикла (distance-based, рад)
    walkBlend: number,     // 0..1, blend in/out анимации ходьбы
    pose: string,          // 'standing' | 'sitting' | 'lying' — текущая поза
    targetPose: string,    // целевая поза (для плавного перехода)
    poseTransition: number,// 0..1, прогресс перехода между позами
    poseFrom: string,      // предыдущая поза (для интерполяции)
    recovered: boolean,    // true после выписки (HP=100) — пациент ходит нормально
    injuryType: string     // тип травмы: 'holdStomach'|'holdBack'|'holdHead'|'holdThroat'|'limp'
  }
}
```

## Patient States
| Состояние     | Описание |
|---------------|----------|
| `queued`      | В очереди, движется к `queueTarget`, доступен для взаимодействия |
| `interacting` | Попап открыт для этого пациента |
| `walking`     | Идёт к кровати или стулу (`targetPos`) |
| `atBed`       | Лежит на кровати, доступен для лечения. Над головой индикатор препарата |
| `waiting`     | Сидит в зоне ожидания. Доступен для взаимодействия — можно перевести на кровать |
| `discharged`  | Выписан (HP=100), идёт к кассе на оплату |
| `atCashier`   | Стоит у кассы, ждёт оплаты через терминал |
| `leaving`     | После оплаты идёт к выходу и на улицу, fade-out при z>18 |

## Queue System
- Очередь перед ресепшном по оси Z
- **Динамический максимум очереди**: базовый лимит 2, увеличивается на 1 за каждый купленный предмет мебели (сверх начальных 5), максимум 10
  - Формула: `maxQueue = min(2 + totalFurniture - 5, 10)`, минимум 2
  - Начальное состояние: 2 кровати + 3 стула = 5 → maxQueue = 2
- Если очередь полна, новый пациент не появляется, уведомление "Пациент не смог зайти из-за того, что очередь переполнена"
- Позиция в очереди: `getQueuePosition(index)` → `(0, 0, -7.5 + index)`
  - index 0 → z=-7.5 (ближе к стойке)
  - index 1 → z=-6.5
- При удалении пациента из очереди → `updateQueueTargets()` сдвигает всех вперёд
- Пациенты в очереди повёрнуты на `Math.PI` (лицом к стойке)

## Spawning
- Пациенты спавнятся ТОЛЬКО когда смена открыта (`Game.Shift.isOpen() === true`)
- Первый пациент спавнится при открытии смены через `Game.Patients.spawnFirstPatient()` — заходит пешком (НЕ телепорт)
- Далее каждые `SPAWN_INTERVAL = 10` секунд (таймер в animation loop, только при открытой смене)
- Если `queue.length >= maxQueue` → спавн не происходит, уведомление о переполнении (maxQueue = min(2 + totalFurniture - 5, 10), min 2)
- Точка появления: `(0, 0, 1)` — у входа, пациент идёт пешком к очереди
- При создании выбирается случайный тип из `CONSUMABLE_KEYS`, затем случайный case из `MEDICAL_DATA[type].cases[]` (symptom, diagnosis, complaint — связный кейс)
- Генерируются витальные показатели через `generateVitals(severity.key)` — значения коррелируют с тяжестью
- Случайный возраст 18-75 через `randomInt(18, 75)`

## Severity Distribution (при спавне)
- 60% — `mild` (Лёгкое, startHp=80)
- 25% — `medium` (Среднее, startHp=50)
- 15% — `severe` (Тяжёлое, startHp=30)

## Destination Slots
- Слоты мебели управляются системой `Game.Furniture` (динамические, не статические)
- Начальные слоты (от world.js):
```js
beds = [
  { pos: Vector3(-4.5, 0, -9), occupied: bool },
  { pos: Vector3(-4.5, 0, -7), occupied: bool }
]
waitingChairs = [
  { pos: Vector3(5.5, 0, -2),   occupied: bool },
  { pos: Vector3(5.5, 0, -3.2), occupied: bool },
  { pos: Vector3(5.5, 0, -4.4), occupied: bool }
]
```
- Позиции слотов смещены от мебели: bed slotOffset +1.0 по X, chair slotOffset -1.0 по X
- При перемещении мебели слоты автоматически пересчитываются
- Пациенты используют только indoor слоты (`Game.Furniture.getIndoorBeds()` / `getIndoorChairs()`)
- Новая мебель добавляется через покупку в магазине и перенос внутрь здания

## Interaction (Raycasting)
- `interactRay`: Raycaster, far=5, направление из центра экрана (`screenCenter = Vector2(0,0)`)
- Каждый кадр: `setFromCamera(screenCenter, camera)` → пересечение со всеми мешами пациентов в состоянии `queued`/`interacting`/`atBed`/`waiting` (кроме `animating`)
- `getPatientFromMesh(object)`: обход вверх по parent до группы с `userData.bodyParts`
- При наведении: emissive = `0x00ff44`, intensity = 0.35 (зелёная подсветка)
- При уходе: emissive сбрасывается в `0x000000`

## Popup Flow
1. ЛКМ на подсвеченного пациента в состоянии `queued` или `waiting` → `openPopup(patient)`
2. Состояние → `interacting`, pointer unlock, попап показан
3. Попап — медицинская карта со структурой:
   - **Цветная полоса тяжести** (4px сверху): красная (severe), жёлтая (medium), зелёная (mild)
   - **Шапка**: имя + фамилия, возраст, тяжесть (цветной текст)
   - **Витальные показатели** (3 ячейки): температура °C, пульс уд/м, АД sys/dia
     - Цветовая кодировка: норма (голубой), повышенные (жёлтый `.vital-warning`), критические (красный `.vital-critical`)
     - Пороги: температура ≥39.0 = critical, ≥37.5 = warning; пульс ≥110 = critical, ≥90 = warning; АД sys ≥160 = critical, ≥140 = warning
   - **HP-бар**: горизонтальная полоса с процентом, цвет: зелёный >60%, жёлтый 30-60%, красный ≤30%
   - **Клинический блок** (с левой акцентной линией 2px):
     - Жалоба (курсивом в «кавычках» — от первого лица пациента)
     - Диагноз (или "????" красным если needsDiagnosis)
     - Назначение (цветной кружок + название препарата, или "????" красным)
     - При needsDiagnosis: подсказка "Необходим: [инструмент]" (оранжевым)
4. **Предупреждение об outdoor мебели** (`#outdoor-warning`):
   - Если есть хотя бы одна кровать или стул на улице → показывается: "Пока кровать/стул на улице — их нельзя использовать"
   - Скрыто если вся мебель внутри здания
5. **Предупреждение о грязном белье** (`#dirty-linen-warning`):
   - Если есть хотя бы одна кровать с грязным бельём → показывается: "Грязное бельё на N кроватях — замените бельё"
   - Оба предупреждения (outdoor + dirty) могут отображаться одновременно
   - Грязные кровати НЕ считаются свободными при подсчёте: `freeBeds = indoorBeds.filter(b => !b.occupied && !isBedDirty(b))`
6. Кнопки:
   - "На кровать (X/N)" — проверяет `Game.Furniture.getIndoorBeds()`, фильтрует грязные и занятые, disabled если нет свободных
   - "В зону ожидания (X/N)" — проверяет `Game.Furniture.getIndoorChairs()`, **скрыта если пациент уже в зоне ожидания**
   - "Подождать" — закрывает попап, возвращает пациента в прежнее состояние (queued или waiting)
5. Клик по кнопке размещения → `sendPatient(patient, dest, slot)`:
   - state → `walking`, targetPos установлен, slot.occupied = true
   - Если пациент был в зоне ожидания (`_wasWaiting`), старый стул освобождается
   - Пациент удалён из queue (если был), очередь сдвинута
6. Попап закрыт, `controls.lock()` — управление возвращается

## Health System
- Каждый пациент при спавне получает тяжесть заболевания (по весам 60/25/15%):
  - `severe` (Тяжёлое) → стартовое HP = 30
  - `medium` (Среднее) → стартовое HP = 50
  - `mild` (Лёгкое) → стартовое HP = 80
- Максимальное HP = 100
- **Деградация HP**: каждые 3 секунды, пока `treated === false`, пациент теряет 1 HP
  - **HP НЕ падает** пока пациент идёт к зоне ожидания (state=`walking`), идёт к кровати (state=`walking`), или во время активной мини-игры диагностики
  - Заморозка при ходьбе: state=`walking` или (state=`queued` и ещё не дошёл до позиции в очереди)
  - Заморозка при мини-игре: `Game.Diagnostics.isActive()` и `Game.Diagnostics.getPatient() === patient`
  - При HP ≤ 0 → пациент удаляется (`removePatient()`), кровать помечается грязной (`markBedDirty`), уведомление "Пациент ушел, не дождавшись помощи"
- **Восстановление HP**: после применения правильного препарата (`treated = true`), HP растёт на 3 ед/сек
  - При HP ≥ 100 → пациент выписывается, направляется к кассе (`dischargePatient()`), уведомление "Пациент выписан! Направлен на оплату." (зелёное)
- Логика в `updateHealthTimers(delta)`, вызывается из `update()` каждый кадр

## Discharge Flow (HP = 100)
1. `dischargePatient(patient)`:
   - Освобождает кровать (`destination.occupied = false`)
   - Если кровать → помечает бельё грязным (`Game.Furniture.markBedDirty(destination)`)
   - Удаляет indicator и healthBar
   - `patient.treated = false` (остановка логики восстановления)
   - `patient.anim.recovered = true` — скорость и походка становятся нормальными
   - `removeIllnessVisuals(patient)` — убирает все визуальные индикаторы болезни (тинты, масштаб, доп. меши)
   - `patient.anim.targetPose = 'standing'` — пациент встаёт с кровати (плавный переход из lying), сдвигается на standing position
   - Вызывает `Game.Cashier.addPatientToQueue(patient)`
2. Пациент получает `state = 'discharged'`, `targetPos` к кассе, идёт нормальной походкой
3. Подход к кассе → `state = 'atCashier'`
4. Оплата через терминал → `state = 'leaving'`
5. Уход: к выходу (0,0,1), затем на улицу (0,0,25)
6. При z > 18: fade-out opacity за 0.8 сек → `removePatient()`

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

## Treatment System
- Наведение на `atBed` пациента показывает подсказку:
  - Пациент лечится (`treated === true`) → "Пациент лечится..."
  - Есть активный препарат → "ЛКМ — Применить [название]"
  - Нет препарата → "Нужен препарат"
- Наведение на `waiting` пациента → "ЛКМ — Перевести на кровать"
- ЛКМ на `atBed` пациента:
  - Пациент уже лечится (`treated === true`) → клик игнорируется
  - Нет препарата → уведомление "Выберите препарат в инвентаре"
  - Правильный препарат (`activeType === requiredConsumable`):
    1. `Game.Inventory.removeActive()` — препарат убирается из инвентаря
    2. `patient.treated = true` — запуск восстановления HP
    3. Зелёная вспышка (emissive 0x00ff44, intensity 0.8→0, 0.5с)
    4. Уведомление "Лечение начато!" (зелёное)
    5. По завершении анимации: сброс emissive, удаление индикатора препарата, `animating = false`
    6. Пациент остаётся на кровати, HP восстанавливается 3 ед/сек, лечебные частицы спавнятся
    7. При HP = 100 → выписка и направление на оплату (`dischargePatient()`)
  - Неправильный препарат:
    1. Препарат НЕ расходуется
    2. Красная вспышка (emissive 0xff2222, intensity 0.5→0, 0.3с)
    3. Тряска меша (sin-осцилляция x ±0.05, 0.3с)
    4. Уведомление "Неправильный препарат!"
- Во время анимации (`patient.animating=true`) повторное взаимодействие блокировано

## Notification Colors
- Зелёные (`rgba(34, 139, 34, 0.85)`): "Лечение начато!", "Пациент выписан! Направлен на оплату."
- Красные (по умолчанию): "Неправильный препарат!", "Пациент ушел, не дождавшись помощи", "Пациент не смог зайти...", "Недостаточно средств!"

## Animation System
- Массив `animations[]` с объектами `{ patient, type, timer, maxTime, ... }`
- `updateAnimations(delta)` вызывается из `update()` каждый кадр
- Типы анимаций:
  - `'heal'` — зелёная вспышка (emissiveIntensity 0.8→0 за 0.5с), по завершении: сброс emissive, удаление индикатора препарата, `animating=false` (пациент остаётся для восстановления HP)
  - `'shake'` — тряска (sin-осцилляция x ±0.05, 8 колебаний за 0.3с) + красная вспышка, по завершении сброс позиции и `animating=false`

## Patient Movement
- Базовая скорость: `PATIENT_SPEED = 3.5` ед/сек
- Скорость зависит от тяжести: `getPatientSpeed(patient)` = `PATIENT_SPEED * WALK_SPEED[severity]`
  - severe: ×0.35, medium: ×0.65, mild: ×0.9, normal (после выздоровления): ×1.0
- Функция `moveToward(pos, target, maxDist)`: линейное перемещение по XZ
- В состоянии `queued`: движение к `queueTarget`
- В состоянии `walking`: движение к `targetPos`, поворот лицом к цели
- При достижении цели: state → `atBed` (+ создание индикатора, поза → lying) или `waiting` (поза → sitting)
- В состоянии `discharged`: движение к кассе, `recovered=true`, нормальная скорость
- В состоянии `leaving`: движение к выходу (phase toExit → toStreet), fade-out при z>18

## Walk Animation System
- Фаза шагового цикла привязана к пройденному расстоянию: `walkPhase += (dist / STRIDE_LEN) * 2PI`
- `STRIDE_LEN = 1.1` — мировых единиц на полный цикл (2 шага)
- Плавный blend in/out при начале/остановке движения (walkBlend 0..1)
- Ноги: `sin(phase)` / `sin(phase + PI)` — противофазное качание вокруг X на тазобедренных суставах
  - Амплитуда: `LEG_SWING = 0.4` рад
  - При хромоте (limp): правая нога с задержкой фазы и уменьшенной амплитудой
- Руки: плечо качается в противофазе ногам, локоть слегка сгибается на заднем махе
  - `ARM_SWING = 0.35`, `ELBOW_SWING = 0.25`

## Injury Poses (при ходьбе)
- Каждый пациент при спавне получает `injuryType` из `INJURY_MAP[requiredConsumable]`:
  - **painkiller** → случайно: `holdStomach`, `holdBack`, или `limp`
  - **antihistamine** → `holdHead`
  - **strepsils** → `holdThroat`
- Эффект травмы масштабируется по `getSeverityFactor()`:
  - severe=1.0, medium=0.5, mild=0.15, recovered=0
- Каждая поза задаёт: наклон торса (hunch), опускание головы (headDroop), углы плеча и локтя для каждой руки, хромоту
- При ходьбе руки плавно интерполируются между нормальным махом и позой травмы по severity factor
- Позы:
  - `holdStomach`: hunch=0.3, обе руки согнуты к животу (shoulder=-0.8, elbow=-1.6)
  - `holdBack`: hunch=0.25, одна рука за спину (shoulder=0.4, elbow=-1.2), хромота
  - `holdHead`: hunch=0.1, обе руки подняты к лицу (shoulder=-1.8, elbow=-2.0)
  - `holdThroat`: hunch=0.15, одна рука у горла (shoulder=-1.4, elbow=-2.2), вторая свободна
  - `limp`: hunch=0.12, руки свободны, хромота

## Illness Visual Indicators
- При спавне пациента вызывается `applyIllnessVisuals(patient)` — добавляет визуальные отличия на 3D-модель в зависимости от типа болезни
- При выписке (`dischargePatient`) вызывается `removeIllnessVisuals(patient)` — убирает все визуалы, пациент выглядит нормально
- Также вызывается в `removePatient()` и `clearAll()` для корректной очистки памяти

### Данные
- `ILLNESS_REGION_MAP` — маппинг конкретных диагнозов на зоны тела (head, back, leg, arm, neck, stomach, teeth, chest, fullBody, throat, both)
- `getIllnessRegion(consumableType, diagnosis)` — возвращает зону тела
- `getIllnessSeverityScale(patient)` — severity → множитель: severe=1.0, medium=0.6, mild=0.3
- Для `needsDiagnosis` пациентов используются `hiddenConsumable`/`hiddenDiagnosis` — визуально болезнь видна даже без поставленного диагноза

### Хранение на пациенте
```js
mesh.userData.illnessVisuals = [{ mesh, parent, resetScale? }]  // добавленные меши и изменённые scale
mesh.userData.illnessMaterials = [{ mesh, originalColor }]       // изменённые материалы (для восстановления)
```

### Визуальные эффекты по типам

**Antihistamine (аллергия):**
- Ярко-красная голова (сильный тинт 0xff0000)
- Увеличенная голова (scale 1.1–1.3 по severity)
- Красная кожа на всех руках (тинт 0xff3333)

**Painkiller (боль) — зависит от зоны:**
| Зона | Визуал |
|------|--------|
| head | Красная увеличенная голова (scale 1.15–1.35) |
| back | Красный торс |
| leg | Опухшие красные ноги (scale 1.2–1.7) |
| arm | Опухшая красная рука (scale 1.3–1.7) + белая повязка-цилиндр |
| neck | Белый шейный бандаж (CylinderGeometry) |
| stomach | Зеленоватое тело и голова (тошнота) |
| teeth | Увеличенная красноватая голова (асимметричный scale) |
| chest | Красный торс |
| fullBody | Красный тинт на всём теле (торс, голова, руки, ноги) |

**Strepsils (горло/дыхание):**
| Зона | Визуал |
|------|--------|
| throat | Красный цилиндр-шея (опухшая) + красное лицо |
| chest | Красный торс + увеличенный (scale 1.0–1.15) |
| both | Оба эффекта с 70% интенсивностью |

### Масштабирование по severity
- Влияет на: интенсивность цветовых тинтов, размер увеличения (scale), размер доп. мешей
- Формула тинта: `color.lerp(targetColor, baseFactor + severityFactor * sev)`

## Pose Transitions (standing → sitting / lying)
- Плавная интерполяция (smoothstep) за ~0.4с (`POSE_TRANSITION_SPEED = 2.5`)
- **Sitting** (зона ожидания): bodyContainer опускается на 0.3, ноги сгибаются на -PI/2 (вперёд)
- **Lying** (кровать): poseContainer.rotation.x = -PI/2 (тело укладывается горизонтально), poseContainer.position.y = 0.62 (высота матраса), Z-компенсация = 0.75. Пациент плавно сдвигается на центр кровати, поворачивается головой к подушке (rotation.y = PI/2). Руки слегка разведены (armRotZ ±0.3)
- При выписке: поза → standing, пациент сдвигается обратно на standing position, `recovered=true`

## Consumable System

### Consumable Types
```js
CONSUMABLE_TYPES = {
  strepsils:     { name: 'Стрепсилс',        color: 0xcc3333, size: {x:0.15, y:0.08, z:0.10} },
  painkiller:    { name: 'Обезболивающее',    color: 0x3366cc, size: {x:0.18, y:0.06, z:0.12} },
  antihistamine: { name: 'Антигистаминное',   color: 0x33aa55, size: {x:0.14, y:0.07, z:0.10} }
}
```

### 3D Models (медицинские)
- **Стрепсилс** (0xcc3333) — блистер: плоская пластина + 6 полусфер сверху (2×3) + фольга снизу
- **Обезболивающее** (0x3366cc) — флакон: CylinderGeometry тело + белая крышка + белая этикетка
- **Антигистаминное** (0x33aa55) — коробочка: BoxGeometry + белый крестик "+" на передней грани
- Каждая модель — `THREE.Group` с `userData.consumableType`

### Physics
- Полная 3D физика: `velocity = Vector3(x, y, z)`, гравитация `GRAVITY = -9.8` по Y
- Столкновения через raycasting по каждой оси (X, Y, Z) против `collidables[]`
- При столкновении с поверхностью: трение (velocity *= 0.3), при малой скорости → `grounded = true`
- Fallback: ground plane при `y <= 0`
- Бросок (G): `DROP_FORWARD_SPEED = 4.0`, `DROP_UP_SPEED = 2.0` — предмет летит вперёд от камеры с дугой
- Физика используется как для отдельных препаратов, так и для коробок (общая функция `applyItemPhysics`)

### Ground Item Structure
```js
{ type, mesh, velocity: Vector3(x, y, z), grounded, pickedUp }
```

### Box System (коробки по 10)
- Препараты покупаются коробками по 10 штук ($80 за коробку, бельё — $100)
- При покупке спавнится коробка в зоне доставки (падает с y=3)
- **Box 3D Model**: BoxGeometry (0.8×0.6×0.6), цвет = цвет препарата (roughness 0.6) + тёмная окантовка сверху (цвет × 0.7)
- **Canvas-текстура** (512×512) на передней И задней гранях: белая этикетка, цветной медицинский крест, название (52px bold), "×10" (72px bold), "препараты"
- Надписи помечены `userData.isLabel = true` — пропускаются при highlight (предотвращает пропадание)
- `polygonOffset` на материалах надписей — предотвращает z-fighting
- **ЛКМ** (на коробку на земле) — взять 1 препарат в инвентарь (`remaining--`), не поднимая коробку
- **E (KeyE)** — подобрать коробку в руки (не в инвентарь)
- **ЛКМ** (при удержании коробки) — взять 1 препарат в инвентарь (`remaining--`)
- **G (KeyG)** (при удержании коробки) — бросить коробку (приоритет над дропом из инвентаря)
- Когда `remaining = 0` → коробка исчезает
- Held box следует за камерой (0.6 вперёд, -0.35 вниз, +0.2 вправо)

### Ground Box Structure
```js
{ type, mesh, remaining: 10, velocity: Vector3, grounded, pickedUp }
```

### Box Interaction Hints
- На земле: "ЛКМ — Взять препарат (N шт.) | E — Поднять коробку" (при наведении)
- В руках: "ЛКМ — Взять препарат (осталось: N)" + "G — Бросить коробку"

## Internal State (Game.Patients)
```js
patients[]               // все пациенты (все состояния)
queue[]                  // пациенты в очереди (подмножество patients), максимум 2
patientIdCounter         // автоинкремент ID
hoveredPatient           // текущий пациент под прицелом (или null)
popupPatient             // пациент в открытом попапе (или null)
spawnTimer               // таймер спавна (сбрасывается каждые SPAWN_INTERVAL)
beds[]                   // начальные слоты кроватей — получены из World.setup(), управляются Game.Furniture
waitingChairs[]          // начальные слоты стульев — получены из World.setup(), управляются Game.Furniture
// Для работы с мебелью используются Game.Furniture.getIndoorBeds()/getIndoorChairs()
// isBed проверка: Game.Furniture.isBedSlot(destination)
animations[]             // активные анимации лечения/ошибки
healParticles[]          // активные лечебные частицы [{sprite, life, maxLife, vx, vy, vz}]
healParticleTexture      // кешированная текстура частиц (одна на все)
```

## Staff Integration Flags
На объекте пациента:
```js
patient.staffProcessing = false  // администратор оформляет (блокирует попап)
patient.staffDiagnosing = false  // диагност работает (блокирует мини-игру)
patient.staffTreating = false    // медсестра лечит (блокирует лечение игроком)
```

## Public API (новые для Staff)
```js
Game.Patients.getPatients()     // → массив всех пациентов
Game.Patients.getQueue()        // → массив очереди
Game.Patients.sendPatientByStaff(patient, dest, slot)  // направить без попапа
Game.Patients.summonToDesk(patient, deskPos)            // вызвать к стойке администратора
Game.Patients.treatPatientByStaff(patient, consumableType) // лечить без инвентаря
```

## Constants (Game.Patients)
```js
SPAWN_INTERVAL = 10      // секунды между спавнами
PATIENT_SPEED = 3.5      // базовая ед/сек (умножается на WALK_SPEED[severity])
WALK_SPEED = { severe: 0.35, medium: 0.65, mild: 0.9, normal: 1.0 }
STRIDE_LEN = 1.1         // мировых единиц на полный шаговый цикл
LEG_SWING = 0.4          // амплитуда ног (рад)
ARM_SWING = 0.35         // амплитуда плеча (рад)
ELBOW_SWING = 0.25       // амплитуда локтя (рад)
POSE_TRANSITION_SPEED = 2.5  // скорость перехода поз (1/сек)
BODY_COLORS[]            // 7 цветов одежды
NAMES[], SURNAMES[]      // пулы имён
MEDICAL_DATA{}           // связные кейсы {symptom, diagnosis, complaint} по типам препаратов (8 на тип)
CONSUMABLE_KEYS[]        // ключи типов препаратов
SEVERITIES[]             // [{key, label, startHp}] — тяжесть: severe(30), medium(50), mild(80)
MAX_HP = 100             // максимальное здоровье
HP_DECAY_INTERVAL = 3.0  // секунды между потерей 1 HP
HP_RECOVERY_RATE = 3.0   // HP/сек при восстановлении
PARTICLE_SPAWN_INTERVAL = 0.15
PARTICLE_LIFETIME = 1.2
PARTICLE_SPEED = 0.6
INJURY_POSES{}           // позы травм (holdStomach, holdBack, holdHead, holdThroat, limp)
INJURY_MAP{}             // маппинг consumable type → возможные типы травм
ILLNESS_REGION_MAP{}     // маппинг диагнозов → зона тела (head, back, leg, arm, neck, stomach, teeth, chest, fullBody, throat, both)
// Витальные показатели (generateVitals):
//   severe: temp 38.5-39.8, sys 150-180, dia 95-110, pulse 100-130
//   medium: temp 37.2-38.4, sys 130-150, dia 85-95, pulse 80-100
//   mild:   temp 36.4-37.2, sys 110-130, dia 70-85, pulse 65-80
```

## Internal State (Game.Consumables)
```js
groundItems[]            // все препараты на земле {type, mesh, velocity, grounded, pickedUp}
hoveredItem              // препарат под прицелом (или null)
GRAVITY = -9.8           // ускорение свободного падения
DROP_FORWARD_SPEED = 4.0 // скорость броска вперёд
DROP_UP_SPEED = 2.0      // скорость броска вверх
```
