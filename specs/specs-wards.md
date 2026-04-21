# EmergencyRND V2 — Система палат (Wards)

## Overview
Больница содержит **6 типов палат** (всего 14 кроватей). Каждая палата принимает пациентов определённой сложности (🟢/🟡/🔴) и имеет свою цену. Пациент генерируется с `preferredTier` (basic/improved/vip); при совпадении tier палата платит полную цену, при несовпадении — цена базовой палаты соответствующей сложности.

## Ward Definitions (`js/wards.js` — `Game.Wards.TYPES`)
| id | Название (ru) | Tier | Мест | Цена | Принимает |
|------|---------------|------|------|------|-----------|
| `easy`     | Лёгкая             | basic    | 3 | 30  | 🟢 |
| `easyPlus` | Лёгкая улучшенная  | improved | 2 | 55  | 🟢 🟡 |
| `medium`   | Средняя            | basic    | 3 | 40  | 🟡 |
| `hard`     | Сложная            | basic    | 3 | 60  | 🔴 |
| `hardPlus` | Сложная улучшенная | improved | 2 | 80  | 🟡 🔴 |
| `vip`      | VIP                | vip      | 1 | 100 | 🟢 🟡 🔴 |

## Payment Rule
```js
PREFERRED_PRICE = {
  basic:    { mild: 30,  medium: 40,  severe: 60 },
  improved: { mild: 55,  medium: 55,  severe: 80 },
  vip:      { mild: 100, medium: 100, severe: 100 }
};

Game.Wards.calcPayment(wardId, patient) →
  ward.tier === patient.preferredTier
    ? ward.price
    : min(ward.price, PREFERRED_PRICE[patient.preferredTier][patient.severity.key])
```
При несовпадении tier пациент платит минимум из фактической цены палаты и цены его предпочитаемого тира для этой сложности. Примеры:
- 🟢 вип-пациент в `easy` (30) → `min(30, 100) = 30` (платит как за basic, старое поведение).
- 🟢 basic-пациент в `vip` (100) → `min(100, 30) = 30` (платит как за basic).
- 🟢 improved-пациент в `vip` (100) → `min(100, 55) = 55` (платит как за improved).
- 🔴 improved-пациент в `hard` (60) → `min(60, 80) = 60` (платит как за фактический hard — дешевле preferred).
- 🟡 improved-пациент в `vip` (100) → `min(100, 55) = 55`.

Принцип: штраф всегда в пользу клиента — из двух цен (actual ward vs preferred-tier equivalent) берётся меньшая.

## Public API
```js
Game.Wards.TYPES        // { id: { tier, price, accepts } }
Game.Wards.ORDER        // ['easy','easyPlus','medium','hard','hardPlus','vip']
Game.Wards.setup(wardData)                // принимает { id: { slots:[{pos,occupied}] } } из world.js
Game.Wards.accepts(id, severityKey)       // → boolean
Game.Wards.calcPayment(id, patient)       // → number
Game.Wards.getFreeSlot(id)                // → slot | null
Game.Wards.getFreeCount(id)               // → number
Game.Wards.getCapacity(id)                // → number
Game.Wards.getTotalCapacity()             // → 14
Game.Wards.getAllSlots()                  // → slot[] для подсчёта
Game.Wards.getWardIdBySlot(slot)          // → id
```

## World Layout (`js/world.js`)
Здание расширено до 22×24 (x: −11..11, z: −24..0). Палаты размещены в северной половине (z < −12):
- **Западная колонна** (x=−9 beds / x=−8 patients, rotY=0): easy (z −22/−20/−18) + easyPlus (z −16/−14).
- **Центральная колонна** (x=−2 beds / x=−1 patients, rotY=0): medium (z −22/−20/−18) + vip (z −14).
- **Восточная колонна** (x=9 beds / x=8 patients, rotY=π): hard (z −22/−20/−18) + hardPlus (z −16/−14).

Визуализация зон: полупрозрачные цветные тайлы пола (зелёный/амбер/красный/золотой), без внутренних стен. VIP-зона отделена декоративной стенкой-перегородкой с табличкой.

## Wall Signs
Все таблички крепятся на стены (memory `signs_on_walls`):
- Западная стена: `ward.easy` (z=−20), `ward.easyPlus` (z=−15)
- Восточная стена: `ward.hard` (z=−20), `ward.hardPlus` (z=−16)
- Северная стена: `ward.medium` (x=−1)
- VIP-перегородка (x=2, z=−14): `ward.vip` на западной стороне перегородки

## Popup Buttons
Попап пациента содержит `#popup-wards` — сетка 3×2:
```
[ Лёгкая $30 (2/3) ] [ Лёгк.улучш. $55 (1/2) ] [ Средняя $40 (3/3) ]
[ Сложная $60 (2/3) ] [ Слож.улучш. $80 (2/2) ] [ VIP $100 (1/1) ]
```
- Каждая кнопка: `.ward-name` + `.ward-price` + `.ward-count`.
- Классы состояния: `.ward-match` (tier совпал, полная цена), `.ward-mismatch` (tier не совпал, цена = basic-по-severity + перечёркнутая full), `.ward-disabled` (severity не принимается), `.ward-full` (0 мест).
- Клик по disabled → `popup.err.wardTypeMismatch` / `popup.err.wardFull`.

## Integration
### patients.js
- `spawnPatient` роли́т `preferredTier` (60/30/10).
- `admitToWard(patient, wardId)` → проверка accepts/full → `procedureFee = calcPayment` → `sendPatient`.
- `dischargePatient` освобождает ward slot.

### staff.js
- `findDestinationForPatient(patient)` перебирает `Game.Wards.ORDER`, ищет slot который `accepts(severity)` и предпочитает `tier === preferredTier`, иначе любую совместимую, иначе — стул ожидания.
- `sendPatientByStaff(patient, pos, slot, wardId)` проставляет `procedureFee` если `wardId`.

### index.html
- `Game.Wards.setup(wards)` вызывается **после** `Game.World.setup()` и **до** `Game.Patients.setup()`.
