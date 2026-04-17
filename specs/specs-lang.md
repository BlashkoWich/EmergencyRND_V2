# EmergencyRND V2 — Локализация (Game.Lang)

## Overview
Игра поддерживает два языка: русский (ru) и английский (en). Все пользовательские тексты хранятся в едином файле `js/lang.js` и доступны через `Game.Lang.t('key')`. Язык выбирается на стартовом экране и сохраняется в `localStorage('gameLang')`. По умолчанию — `ru`.

## Файл: `js/lang.js`

### Архитектура
IIFE-модуль `Game.Lang`. Загружается **первым** (до всех остальных модулей). Содержит:
- Объект `STRINGS` с ключами `ru` и `en`
- Функции API: `t()`, `applyAll()`, `setLang()`, `getLang()`
- Автоматический вызов `applyAll()` на `DOMContentLoaded`
- Автоматическая подсветка активной кнопки языка и привязка обработчиков

### Порядок загрузки
```
lang.js → interaction.js → helpers.js → ... → tutorial.js → inline module
```
`lang.js` должен быть первым `<script src>` в `index.html`, чтобы `Game.Lang.t()` был доступен всем модулям при инициализации.

## Public API

### `Game.Lang.t(key)`
Возвращает перевод для текущего языка. Тип возврата зависит от значения:
- **string** — для обычных строк
- **array** — для массивов (имена, медицинские данные)
- **object** — для объектов (карты поз, карты ключевых слов)

Fallback: если ключ не найден в текущем языке → ищет в `ru` → возвращает сам ключ.

### `Game.Lang.t(key, [param1, param2, ...])`
Подстановка параметров. Плейсхолдеры `{0}`, `{1}`, `{2}` в строке заменяются на элементы массива.

```js
Game.Lang.t('shift.task.finish', [3])  // → "Finish remaining patients! (3)"
Game.Lang.t('box.hover.full', ['Strepsils', 10])  // → "LMB — Take: Strepsils (10 pcs.) | E — Pick up box"
```

### `Game.Lang.setLang(code)`
Сохраняет язык в `localStorage('gameLang')` и вызывает `location.reload()`.

### `Game.Lang.getLang()`
Возвращает текущий код языка: `'ru'` или `'en'`.

### `Game.Lang.applyAll()`
Обновляет все DOM-элементы с атрибутом `[data-lang-key]`:
- По умолчанию устанавливает `textContent`
- Если элемент имеет атрибут `data-lang-html` — устанавливает `innerHTML`

## HTML-локализация

### Атрибут `data-lang-key`
Любой DOM-элемент с этим атрибутом автоматически получает текст из `Game.Lang.t(key)` при вызове `applyAll()`.

```html
<button data-lang-key="popup.btn.bed"></button>
<span data-lang-key="hud.balance"></span>
<div data-lang-key="ad.confirm" data-lang-html></div>
```

### `data-lang-html`
Для элементов, содержащих HTML-разметку (например, tutorial steps с `<b>`, `<span>`). Устанавливает `innerHTML` вместо `textContent`.

## JS-локализация

### Статические строки
```js
hintEl.textContent = Game.Lang.t('shift.hint.open');
Game.Inventory.showNotification(Game.Lang.t('notify.treatmentStarted'));
```

### Строки с параметрами
```js
Game.Inventory.showNotification(Game.Lang.t('shift.started', [dayNumber]));
taskTextEl.textContent = Game.Lang.t('shift.task.finish', [remaining]);
```

### Имена предметов
Все `CONSUMABLE_TYPES`, `INSTRUMENT_TYPES`, `FURNITURE_TYPES`, `STAFF_TYPES` используют `Game.Lang.t()` в свойстве `name`:
```js
strepsils: { name: Game.Lang.t('item.strepsils'), color: 0xcc3333, ... }
```
Это значит `info.name` автоматически возвращает локализованное имя.

### Canvas-текстуры (3D надписи)
```js
ctx.fillText(Game.Lang.t('shift.sign.open'), 128, 80);
ctx.fillText(Game.Lang.t('sign.delivery'), 128, 85);
```

### Массивы и объекты
```js
var NAMES = Game.Lang.t('patients.names.male').concat(Game.Lang.t('patients.names.female'));
var MEDICAL_DATA = { painkiller: { cases: Game.Lang.t('patients.medical.painkiller') } };
var keywords = Game.Lang.t('diag.steth.keywords');  // → object с массивами ключевых слов
```

## UI выбора языка

### Расположение
В `#overlay` (первый экран при загрузке), под переключателем графики:
```html
<div id="language-selector">
  <span data-lang-key="overlay.language"></span>
  <button class="lang-btn" data-lang="ru">Русский</button>
  <button class="lang-btn" data-lang="en">English</button>
</div>
```

### Стиль
CSS-класс `.lang-btn` — идентичен `.quality-btn` (полупрозрачный фон, белый текст, скруглённые углы). Активная кнопка получает класс `.active` (зелёная подсветка).

### Поведение
- При загрузке: `Game.Lang` читает `localStorage('gameLang')`, устанавливает `.active` на соответствующую кнопку
- При клике: `Game.Lang.setLang(code)` → сохранение → reload
- Названия языков НЕ переводятся: всегда "Русский" и "English"

## Структура ключей перевода

| Префикс | Область | Пример |
|---------|---------|--------|
| `title` | Заголовок страницы | `title` |
| `overlay.*` | Стартовый экран | `overlay.start` |
| `pause.*` | Экран паузы | `pause.title`, `pause.subtitle` |
| `quality.*` | Настройки графики | `quality.low` |
| `hint.*` | Подсказки взаимодействия | `hint.interact` |
| `popup.*` | Попап пациента | `popup.age`, `popup.btn.bed` |
| `shop.*` | Магазин | `shop.title`, `shop.tab.consumables` |
| `hud.*` | HUD элементы | `hud.balance`, `hud.day` |
| `shift.*` | Система смен | `shift.sign.open`, `shift.task.serve` |
| `dayEnd.*` | Итоги дня | `dayEnd.title`, `dayEnd.served` |
| `levelUp.*` | Повышение уровня | `levelUp.title` |
| `levelSelect.*` | Выбор уровня | `levelSelect.subtitle` |
| `ad.*` | Рекламная система | `ad.watch`, `ad.timer` |
| `cashier.*` | Касса | `cashier.due`, `cashier.hint.pay` |
| `item.*` | Названия предметов | `item.strepsils`, `item.instrument_hammer` |
| `furniture.*` | Мебель | `furniture.bed`, `furniture.hint.move` |
| `staff.*` | Сотрудники | `staff.administrator`, `staff.status.treating` |
| `sign.*` | 3D надписи | `sign.delivery`, `sign.deliveryZone`, `sign.clinic`, `sign.cashier` |
| `inv.*` | Инвентарь | `inv.shop`, `inv.wrench`, `inv.drop` |
| `notify.*` | Уведомления | `notify.inventoryFull`, `notify.treatmentStarted` |
| `levels.*` | Уровни/разблокировки | `levels.unlock2.0`, `levels.xp.treatment` |
| `diag.*` | Диагностика | `diag.steth.title`, `diag.bodyPart.heart` |
| `box.*` | Коробки доставки | `box.hover.full`, `box.held.take` |
| `patient.*` | Хинты пациентов | `patient.hint.treat`, `patient.age` |
| `severity.*` | Тяжесть заболевания | `severity.severe`, `severity.mild` |
| `wrench.*` | Ремонтный ключ | `wrench.equipped`, `wrench.hint.bedHp` |
| `controls.*` | Подсказки управления | `controls.wrench` |
| `trash.*` | Мусор | `trash.hint` |
| `shelf.*` | Стеллажи | `shelf.hint.take` |
| `panel.*` | Панель инструментов | `panel.hint.take` |
| `tutorial.*` | Туториал | `tutorial.step0`, `tutorial.stepOf` |
| `patients.*` | Данные пациентов (массивы/объекты) | `patients.names.male`, `patients.medical.painkiller` |

## Правила добавления новых текстов

1. **Определить ключ** по структуре выше (префикс + описательное имя)
2. **Добавить в оба языка** в `js/lang.js`: секция `ru` и секция `en`
3. **Для HTML** — добавить `data-lang-key="key"` на элемент, убрать хардкод-текст
4. **Для JS** — использовать `Game.Lang.t('key')` или `Game.Lang.t('key', [params])`
5. **Для canvas** — использовать `Game.Lang.t('sign.xxx')` в `fillText()`
6. **Тестирование** — переключить язык на стартовом экране, убедиться что текст отображается на обоих языках

## localStorage
| Ключ | Значения | По умолчанию |
|------|----------|-------------|
| `gameLang` | `'ru'` / `'en'` | `'ru'` |
