# EmergencyRND V2 — Туториал (УСТАРЕЛ)

## Статус: DEPRECATED

Туториал и Level 1 удалены. Игра стартует сразу с Level 2 (auto-spawn, ward-based routing).

- Файл `js/tutorial.js` **удалён**.
- DOM `#tutorial-overlay`, `#tutorial-panel`, `#tutorial-spotlight`, `#tutorial-step-num`, `#tutorial-text`, `#tutorial-next` — удалены из `index.html` и `styles.css`.
- Все ссылки `Game.Tutorial.*` вычищены из js/.
- Ключи `tutorial.*` удалены из `js/lang.js`.
- Экран выбора уровня (`#level-select-screen`) и все `levelSelect.*` ключи удалены.
- Пре-хайр 4 медсестёр на старте заменяет роль обучающих шагов.

Новый пайплайн игрока описан в [specs-patient.md](specs-patient.md) и [specs-staff.md](specs-staff.md).
