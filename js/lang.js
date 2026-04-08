(function() {
  window.Game = window.Game || {};

  var STRINGS = {
    ru: {
      // HTML static text
      'title': 'Частная Клиника',
      'pause.title': 'Пауза',
      'pause.subtitle': 'Нажмите, чтобы продолжить',
      'overlay.title': 'Частная Клиника',
      'overlay.start': 'Нажмите, чтобы начать',
      'overlay.controls1': 'WASD — движение  |  Мышь — камера  |  ESC — пауза',
      'overlay.controls2': 'Q — магазин  |  1-6 — инвентарь  |  E — коробка  |  ЛКМ — взаимодействие',
      'overlay.graphics': 'Графика: ',
      'overlay.language': 'Язык: ',
      'quality.low': 'Низкая',
      'quality.medium': 'Средняя',
      'quality.high': 'Высокая',
      'hint.interact': 'Нажмите ЛКМ для взаимодействия',

      // Patient popup
      'popup.age': 'Возраст:',
      'popup.severity': 'Тяжесть:',
      'popup.temp': 'ТЕМП',
      'popup.pulse': 'ПУЛЬС',
      'popup.bp': 'АД',
      'popup.condition': 'Состояние',
      'popup.complaint': 'Жалоба',
      'popup.diagnosis': 'Диагноз',
      'popup.prescription': 'Назначение',
      'popup.btn.bed': 'На кровать',
      'popup.btn.wait': 'В зону ожидания',
      'popup.btn.dismiss': 'Подождать',
      'popup.btn.ok': 'Понятно',

      // Shop
      'shop.title': 'Магазин',
      'shop.tab.consumables': 'Расходники',
      'shop.tab.instruments': 'Инструменты',
      'shop.tab.furniture': 'Мебель',
      'shop.tab.upgrades': 'Прокачка',
      'shop.tab.staff': 'Сотрудники',
      'shop.buy': 'Купить — ${0}',
      'shop.order.free': 'Заказать — Бесплатно!',
      'shop.purchased': 'Куплено ✓',
      'shop.buyFirst': 'Сначала купите ур. {0}',
      'shop.upgrade1.name': 'Больше препаратов (ур. 1)',
      'shop.upgrade1.desc': '10 шт. в слоте',
      'shop.upgrade2.name': 'Больше препаратов (ур. 2)',
      'shop.upgrade2.desc': '15 шт. в слоте',
      'shop.upgrade3.name': 'Больше препаратов (ур. 3)',
      'shop.upgrade3.desc': '20 шт. в слоте',
      'shop.staffSection.available': 'Доступные',
      'shop.staffSection.hired': 'Нанятые',
      'shop.staffSection.empty': 'Пока никого нет',
      'shop.hire': 'Нанять',
      'shop.fire': 'Уволить — ${0}',
      'shop.salary': '${0}/день',
      'shop.perDay': 'день',

      // HUD
      'hud.balance': 'Баланс:',
      'hud.level': 'Ур.',
      'hud.day': 'День {0}',

      // Shift/Time
      'shift.sign.open': 'ОТКРЫТО',
      'shift.sign.closed': 'ЗАКРЫТО',
      'shift.hint.ongoing': 'Смена идёт...',
      'shift.hint.ending': 'Приём окончен. Дообслужите пациентов.',
      'shift.hint.open': 'ЛКМ — Открыть смену',
      'shift.started': 'Смена началась! День {0}',
      'shift.ended': '20:00 — Приём окончен! Дообслужите оставшихся пациентов.',
      'shift.task.open': 'Откройте смену! Подойдите к табличке у входа.',
      'shift.task.finish': 'Дообслужите оставшихся пациентов! ({0})',
      'shift.task.allDone': 'Все пациенты обслужены!',
      'shift.task.serve': 'Обслуживайте пациентов!',
      'shift.task.openShort': 'Откройте смену!',

      // Day end popup
      'dayEnd.title': 'Итоги дня',
      'dayEnd.served': 'Вылечено пациентов:',
      'dayEnd.lost': 'Потеряно пациентов:',
      'dayEnd.earned': 'Заработано:',
      'dayEnd.spent': 'Потрачено:',
      'dayEnd.salary': 'Зарплата сотрудников:',
      'dayEnd.next': 'Перейти в следующий день',

      // Level up
      'levelUp.title': 'Уровень {0}!',
      'levelUp.close': 'Отлично!',

      // Level select
      'levelSelect.title': 'Частная Клиника',
      'levelSelect.subtitle': 'Выберите начальный уровень',
      'levelSelect.level': 'Уровень {0}',
      'levelSelect.l1.header': 'Уровень 1',
      'levelSelect.l2.header': 'Уровень 2',
      'levelSelect.l3.header': 'Уровень 3',
      'levelSelect.l4.header': 'Уровень 4',
      'levelSelect.start': 'Начать',
      'levelSelect.l1f1': 'Только лёгкие пациенты',
      'levelSelect.l1f2': 'Покупка препаратов и белья',
      'levelSelect.l1f3': 'Без диагностики',
      'levelSelect.l1f4': 'Пациенты приходят по одному',
      'levelSelect.l2f1': '+ Пациенты средней тяжести',
      'levelSelect.l2f2': '+ Покупка инструментов',
      'levelSelect.l2f3': 'Пациентам нужна диагностика',
      'levelSelect.l2f4': 'Пациенты приходят по одному',
      'levelSelect.l3f1': '+ Тяжёлые пациенты',
      'levelSelect.l3f2': '+ Покупка мебели и прокачка',
      'levelSelect.l3f3': 'Поток пациентов каждые 20с',
      'levelSelect.l3f4': 'Диагностика включена',
      'levelSelect.l3f5': '+ Мусор на полу',
      'levelSelect.l4f1': '+ Найм сотрудников',
      'levelSelect.l4f2': 'Всё разблокировано',
      'levelSelect.l4f3': 'Поток пациентов каждые 10с',
      'levelSelect.l4f4': 'Полный хаос!',

      // Ad system
      'ad.offer.title': 'Недостаточно средств!',
      'ad.offer.text': 'Посмотрите рекламу и получите',
      'ad.watch': 'Смотреть рекламу',
      'ad.decline': 'Нет, спасибо',
      'ad.timer': '{0} сек',
      'ad.done': 'Готово!',
      'ad.confirm': 'Если вы закроете рекламу, награда не будет начислена. Закрыть?',
      'ad.confirmYes': 'Да, закрыть',
      'ad.confirmNo': 'Продолжить просмотр',
      'ad.reward': 'Зачислено на баланс!',

      // Cashier
      'cashier.due': 'К оплате:',
      'cashier.entered': 'Введено:',
      'cashier.treatment': 'лечение',
      'cashier.diagnostics': 'диагностика',
      'cashier.xpTreatment': 'XP лечение',
      'cashier.xpDiagnostics': 'XP диагностика',
      'cashier.hint.pay': 'ЛКМ — Оплата  |  Зажми E — Переместить',
      'cashier.hint.move': 'Зажми E — Переместить кассовый стол',
      'cashier.staffWorking': 'Кассир уже работает',

      // Item names
      'item.strepsils': 'Стрепсилс',
      'item.painkiller': 'Обезболивающее',
      'item.antihistamine': 'Антигистаминное',
      'item.linen_clean': 'Постельное бельё',
      'item.linen_dirty': 'Грязное бельё',
      'item.instrument_stethoscope': 'Фонендоскоп',
      'item.instrument_hammer': 'Рефлекс-молоток',
      'item.instrument_rhinoscope': 'Риноскоп',
      'item.default': 'предмет',

      // Furniture names
      'furniture.bed': 'Кровать',
      'furniture.chair': 'Стул',
      'furniture.washingMachine': 'Стиральная машина',
      'furniture.basketClean': 'Корзина (чистое)',
      'furniture.basketDirty': 'Корзина (грязное)',
      'furniture.shelf': 'Стеллаж',
      'furniture.toolPanel': 'Панель инструментов',
      'furniture.cashierDesk': 'Кассовый стол',

      // Staff names
      'staff.administrator': 'Администратор',
      'staff.cashier': 'Кассир',
      'staff.diagnostician': 'Диагност',
      'staff.nurse': 'Медсестра',
      'staff.janitor': 'Уборщик',

      // Staff status labels
      'staff.status.processing': 'Оформление',
      'staff.status.pickInstrument': 'Берёт инструмент',
      'staff.status.diagnosing': 'Диагностика',
      'staff.status.returnInstrument': 'Возвращает',
      'staff.status.pickMedicine': 'Берёт лекарство',
      'staff.status.treating': 'Лечение',
      'staff.status.changingLinen': 'Смена белья',
      'staff.status.cleaningTrash': 'Уборка мусора',
      'staff.status.depositDirty': 'Складывает',
      'staff.status.loadingMachine': 'Загрузка',
      'staff.status.collectClean': 'Собирает бельё',

      // Signs (3D text on canvas)
      'sign.delivery': 'ДОСТАВКА',
      'sign.trash': 'МУСОР',
      'sign.instruments': 'ИНСТРУМЕНТЫ',
      'sign.clean': 'ЧИСТОЕ',
      'sign.dirty': 'ГРЯЗНОЕ',
      'sign.clinic': 'ЧАСТНАЯ КЛИНИКА',
      'sign.waitingArea': 'ЗОНА ОЖИДАНИЯ',
      'sign.examination': 'СМОТРОВАЯ',
      'sign.cashier': 'КАССА',
      'sign.reception': 'РЕСЕПШЕН',
      'sign.laundry': 'СТИРКА',
      'sign.deliveryZone': 'ЗОНА ДОСТАВКИ',

      // Inventory
      'inv.shop': 'Q — Магазин',
      'inv.drop': 'G — Бросить',

      // Notifications
      'notify.inventoryFull': 'Инвентарь полон',
      'notify.insufficientFunds': 'Недостаточно средств!',
      'notify.firstOrderFree': 'Первый заказ бесплатно!',
      'notify.upgradeSlot': 'Теперь можно хранить {0} препаратов в слоте!',
      'notify.unlockLevel': 'Разблокируется на уровне {0}',
      'notify.linenReplaced': 'Бельё заменено!',
      'notify.cannotMove': 'Сейчас нельзя переместить',
      'notify.cannotMoveOccupied': 'Нельзя переместить — предмет занят',
      'notify.cannotPlaceHere': 'Нельзя разместить здесь',
      'notify.furnitureOutdoor': 'Пока {0} на улице — её нельзя использовать',
      'notify.treatmentStarted': 'Лечение начато!',
      'notify.medicineApplied': 'Препарат применён! Осталось: {0}',
      'notify.wrongMedicine': 'Неправильный препарат!',
      'notify.patientDischarged': 'Пациент выписан! Направлен на оплату.',
      'notify.patientLeft': 'Пациент ушел, не дождавшись помощи',
      'notify.diagnosisSet': 'Диагноз установлен!',
      'notify.adminProcessing': 'Администратор оформляет пациента',
      'notify.diagAlreadyWorking': 'Диагност уже проводит обследование',
      'notify.needInstrument': 'Нужен: {0}',
      'notify.nurseAlreadyTreating': 'Медсестра уже лечит этого пациента',
      'notify.noMedicineInInventory': 'Нет нужных препаратов в инвентаре',
      'notify.queueOverflow': 'Пациент не смог зайти из-за того, что очередь переполнена',
      'wave.arrived': 'Скорая привезла пациентов! Определите каждого — решите, кого спасать первым.',
      'notify.instrumentsToPanel': 'Инструменты вешайте на панель',
      'notify.putInBasket': 'Положено в корзину',
      'notify.alreadyHired': '{0} уже нанят(а)!',
      'notify.hired': '{0} нанят(а)!',
      'notify.fired': '{0} уволен(а). Выплачено ${1}',
      'notify.wrongItem': 'Это не тот препарат! Нужен: {0}',

      // Levels (unlock descriptions)
      'levels.unlock2.0': 'Покупка инструментов для диагностики',
      'levels.unlock2.1': 'У пациентов появилась необходимость диагностики',
      'levels.unlock2.2': 'Инструменты уже висят на панели — берите и используйте!',
      'levels.unlock3.0': 'Покупка мебели',
      'levels.unlock3.1': 'Прокачка инвентаря (слоты)',
      'levels.unlock3.2': 'Пациенты теперь идут потоком!',
      'levels.unlock3.3': 'На полу появляется мусор — убирайте!',
      'levels.unlock4.0': 'Найм сотрудников',
      'levels.xp.treatment': 'XP лечение',
      'levels.xp.diagnostics': 'XP диагностика',

      // Diagnostics
      'diag.steth.title': 'Фонендоскоп — Найдите точку аускультации',
      'diag.steth.status': 'Наведите на точку и удерживайте 3 секунды',
      'diag.steth.wrong': 'Здесь ничего не слышно. Попробуйте другую точку.',
      'diag.hammer.title': 'Рефлекс-молоток — Проверьте рефлексы',
      'diag.hammer.status': 'Кликните по точке на колене когда шкала в зелёной зоне ({0}/{1})',
      'diag.hammer.tooWeak': 'Слишком слабо!',
      'diag.hammer.tooStrong': 'Слишком сильно!',
      'diag.hammer.reflex': 'Рефлекс!',
      'diag.hammer.done': 'Рефлексы проверены! ({0}/{1})',
      'diag.hammer.reflexPoint': 'Рефлекторная точка',
      'diag.hammer.power': 'СИЛА',
      'diag.hammer.weak': 'слабо',
      'diag.hammer.strong': 'сильно',
      'diag.rhino.title': 'Риноскоп — Пройдите к очагу воспаления',
      'diag.rhino.status': 'Проведите прибор через носовой проход к красной точке',
      'diag.start': 'СТАРТ',
      'diag.target': 'ОЧАГ',
      'diag.bodyPart.heart': 'Сердце',
      'diag.bodyPart.leftLung': 'Левое лёгкое',
      'diag.bodyPart.rightLung': 'Правое лёгкое',
      'diag.bodyPart.abdomen': 'Живот',
      'diag.bodyPart.throat': 'Горло',

      // Stethoscope keyword matching
      'diag.steth.keywords': {
        throat: ['горл', 'голос', 'глотать', 'глота', 'перш', 'сипит', 'гнусав', 'ангин', 'миндал', 'лающий', 'слюну', 'рот'],
        leftLung: ['слева', 'в боку', 'справа', 'плевр'],
        rightLung: ['свист', 'хрип', 'булькает', 'мокрот', 'задых', 'обструкт'],
        heart: ['за грудин', 'грудь', 'сжалось', 'груди'],
        abdomen: ['до рвоты', 'живот']
      },

      // Consumables/Box hints
      'box.held.trash': 'G — Выбросить в мусорку',
      'box.held.take': 'ЛКМ — Взять: {0} (осталось: {1})<br>G — Бросить коробку',
      'box.hover.empty': 'E — Поднять пустую коробку',
      'box.hover.full': 'ЛКМ — Взять: {0} ({1} шт.)  |  E — Поднять коробку',
      'box.ground.pickup': 'Поднять на ЛКМ',
      'box.label.consumables': 'расходники',
      'box.label.medications': 'препараты',

      // Patient hints
      'patient.hint.treating': 'Пациент лечится...',
      'patient.hint.diagnose': 'ЛКМ — Диагностика ({0})',
      'patient.hint.needInstrument': 'Нужен инструмент ({0})',
      'patient.hint.treat': 'ЛКМ — Лечить',
      'patient.hint.needMedicines': 'Нужны препараты: {0}',
      'patient.hint.needMedicine': 'Нужен препарат ({0})',
      'patient.hint.toBed': 'ЛКМ — Перевести на кровать',
      'patient.hint.interact': 'Нажмите ЛКМ для взаимодействия',
      'patient.age': '{0} лет',
      'patient.pulse': '{0} уд/м',
      'patient.needInstrument': 'Необходим: {0}',
      'patient.outdoorWarning': 'Пока кровать/стул на улице — их нельзя использовать',
      'patient.dirtyWarning1': 'Грязное бельё на {0} кровати — замените бельё',
      'patient.dirtyWarningN': 'Грязное бельё на {0} кроватях — замените бельё',

      // Severity labels
      'severity.severe': 'Тяжёлое',
      'severity.medium': 'Среднее',
      'severity.mild': 'Лёгкое',

      // Furniture hints
      'furniture.hint.replaceLinen': 'ЛКМ — Заменить бельё',
      'furniture.hint.needCleanLinen': 'Нужно чистое бельё для замены',
      'furniture.hint.move': 'Зажми E — Переместить {0}',
      'furniture.hint.place': 'E — Поставить {0}  |  Колёсико — Поворот',

      // Washing machine
      'wash.hint.washing': 'Стирка... {0} сек.',
      'wash.hint.loadDirty': 'Загрузите грязное бельё (ЛКМ)',
      'wash.hint.loadAndStart': 'ЛКМ — Загрузить бельё ({0}/{1})  |  E — Запустить стирку',
      'wash.hint.load': 'ЛКМ — Загрузить бельё ({0}/{1})',
      'wash.hint.fullStart': 'Машинка полная ({0}/{1})  |  E — Запустить стирку',
      'wash.hint.start': 'E — Запустить стирку ({0} шт.)',
      'wash.started': 'Стирка запущена! ({0} шт.)',
      'wash.finished': 'Стирка завершена! Заберите бельё.',
      'wash.full': 'Машинка полная ({0}/{1})',
      'wash.loaded': 'Загружено бельё ({0}/{1})',
      'wash.loadFirst': 'Сначала загрузите грязное бельё',

      // Trash
      'trash.hint': 'Убрать мусор (ЛКМ)',

      // Shelf hints
      'shelf.hint.take': 'Взять {0} на ЛКМ',
      'shelf.hint.place': 'Положить на E',

      // Tool panel hints
      'panel.hint.take': 'Взять {0} на ЛКМ',
      'panel.hint.hang': 'Повесить на E',

      // Staff basket hints
      'basket.cleanLinen': 'Чистое бельё',
      'basket.dirtyLinen': 'Грязное бельё',
      'basket.take': 'ЛКМ — Взять ({0})',
      'basket.put': 'E — Положить',

      // Staff warnings
      'staff.diagWarning': 'Диагносту не хватает инструментов:',
      'staff.nurseWarning': 'Медсестре не хватает на стеллаже:',

      // Shop count labels
      'shop.count': '(есть: {0})',

      // Tutorial steps
      'tutorial.stepOf': 'Шаг {0} из {1}',
      'tutorial.next': 'Далее',
      'tutorial.start': 'Начать!',
      'tutorial.step0': 'Добро пожаловать в Частную Клинику!\nЯ проведу вас по основам работы.\nДавайте начнём!',
      'tutorial.step1': 'Подойдите к табличке с надписью "ЗАКРЫТО" у входа и нажмите ЛКМ, чтобы открыть смену.',
      'tutorial.step2': 'Первый пациент пришёл!\nПодойдите к нему и нажмите ЛКМ, чтобы посмотреть его медкарту.',
      'tutorial.step3': 'Это медицинская карта пациента:\n\n\u2022 Имя, возраст и тяжесть состояния\n\u2022 Витальные показатели: температура, пульс, давление\n\u2022 Жалоба пациента — что его беспокоит\n\u2022 Диагноз и назначенный препарат\n\u2022 Полоска здоровья — текущее состояние',
      'tutorial.step4': '\u00ABВ зону ожидания\u00BB — пациент ждёт на стуле, пока вы заняты другими.\n\n\u00ABНа кровать\u00BB — пациент ложится, и вы можете начать лечение.\n\nНажмите \u00ABНа кровать\u00BB!',
      'tutorial.step5html': 'Пациенту нужен препарат. Откройте магазин, нажав <b>Q</b>, и закажите:<br><br>{0}<b>{1}</b><br><br>Первый заказ каждого вида — <span style="color:#4ade80">бесплатный</span>!',
      'tutorial.step6html': 'Нажмите кнопку \u00ABЗаказать\u00BB напротив:<br><br>{0}<b>{1}</b>',
      'tutorial.step7': 'Отлично! Товар уже в пути.\nЗакройте магазин кнопкой \u2715 или клавишей Q.',
      'tutorial.step8': 'Коробка с препаратом появилась в зоне доставки у входа.\nПодойдите к ней и нажмите ЛКМ, чтобы взять препарат.',
      'tutorial.step9': 'Теперь подойдите к пациенту на кровати и нажмите ЛКМ, чтобы применить препарат.',
      'tutorial.step10': 'Препарат применён! Пациент выздоравливает — полоска здоровья заполняется.\n\nКогда он полностью выздоровеет, он сам пойдёт к кассе для оплаты.',
      'tutorial.step11': 'Пациент выздоровел и идёт к кассе!\nПодойдите к терминалу оплаты (справа от стойки) и нажмите ЛКМ.',
      'tutorial.step12': 'Введите сумму к оплате, используя клавиатуру терминала, и нажмите OK.',
      'tutorial.step13': 'Оплата принята!\n\nОбратите внимание: после ухода пациента кровать стала грязной. На грязную кровать нельзя положить нового пациента!\n\nДавайте научимся менять бельё.',
      'tutorial.step14': 'Откройте магазин (Q) и закажите чистое постельное бельё.',
      'tutorial.step15html': 'Нажмите кнопку \u00ABЗаказать\u00BB напротив:<br><br><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:#dde4f0;vertical-align:middle;margin-right:6px;border:1px solid #aab;"></span><b>{0}</b>',
      'tutorial.step16': 'Отлично! Закройте магазин.',
      'tutorial.step17': 'Подойдите к коробке с бельём в зоне доставки и возьмите чистое бельё на ЛКМ.',
      'tutorial.step18': 'Теперь подойдите к грязной кровати и нажмите ЛКМ, чтобы заменить бельё.',
      'tutorial.step19': 'Кровать снова чистая!\n\nНо у вас в инвентаре осталось грязное бельё. Его можно постирать в стиральной машине!\n\nВыберите грязное бельё в инвентаре (клавиши 1-6) и подойдите к стиральной машине.',
      'tutorial.step20': 'Выберите грязное бельё в инвентаре и нажмите ЛКМ на стиральной машине, чтобы загрузить.',
      'tutorial.step21': 'Бельё загружено! Нажмите E, чтобы запустить стирку.',
      'tutorial.step22': 'Стирка запущена! Подождите, пока машинка закончит...\n\nЭто займёт 5 секунд.',
      'tutorial.step23': 'Стирка завершена! Чистое бельё появилось на машинке.\nПодберите его на ЛКМ.',
      'tutorial.step24': 'Отлично! Теперь у вас снова есть чистое бельё.\n\nВы изучили все основы!\nТеперь управляйте клиникой самостоятельно.\n\nУдачи!',
      'tutorial.defaultMedicine': 'препарат',

      // Patient medical data
      'patients.names.male': ['Иван','Алексей','Дмитрий','Сергей','Андрей','Михаил','Николай','Павел','Олег','Виктор'],
      'patients.names.female': ['Мария','Анна','Елена','Ольга','Наталья','Татьяна','Светлана','Ирина','Екатерина','Юлия'],
      'patients.surnames.male': ['Иванов','Петров','Сидоров','Козлов','Новиков','Морозов','Волков','Соколов','Лебедев','Попов'],
      'patients.surnames.female': ['Иванова','Петрова','Сидорова','Козлова','Новикова','Морозова','Волкова','Соколова','Лебедева','Попова'],

      // Medical cases
      'patients.medical.painkiller': [
        { diagnosis: 'Мигрень с аурой', complaint: 'Голова раскалывается, свет режет глаза, уже второй час не отпускает' },
        { diagnosis: 'Люмбаго', complaint: 'Наклонился за сумкой — спину заклинило, не могу разогнуться' },
        { diagnosis: 'Острый бурсит', complaint: 'Колено распухло после пробежки, согнуть ногу не получается' },
        { diagnosis: 'Пульпит', complaint: 'Зуб разболелся среди ночи, боль отдаёт в ухо, терпеть невозможно' },
        { diagnosis: 'Межрёберная невралгия', complaint: 'При повороте простреливает между лопатками, больно дышать' },
        { diagnosis: 'Ишиас', complaint: 'Ногу тянет от поясницы до самой пятки, не могу ни сидеть ни стоять' },
        { diagnosis: 'Шейный миозит', complaint: 'Продуло шею, голову повернуть вообще не могу' },
        { diagnosis: 'Жёлчная колика', complaint: 'После жирной еды скрутило живот справа, тошнит' },
        { diagnosis: 'Тендинит ахиллова сухожилия', complaint: 'Пятка болит при каждом шаге, утром вообще встать не могу' },
        { diagnosis: 'Плантарный фасциит', complaint: 'Стопа горит огнём, особенно после сна — первые шаги невыносимы' },
        { diagnosis: 'Защемление локтевого нерва', complaint: 'Пальцы на руке немеют и покалывают, локоть ноет' },
        { diagnosis: 'Острый радикулит', complaint: 'Стреляет в пояснице при каждом движении, ногу тянет вниз' },
        { diagnosis: 'Миофасциальный синдром', complaint: 'Мышцы на спине как каменные, при нажатии простреливает в руку' },
        { diagnosis: 'Артрит лучезапястного сустава', complaint: 'Запястье опухло и болит, не могу взять даже кружку' },
        { diagnosis: 'Посттравматическая невропатия', complaint: 'После удара рука плохо слушается, пальцы немеют' },
        { diagnosis: 'Головная боль напряжения', complaint: 'Голову как тисками сдавило, обруч на лбу, ноет уже с утра' },
        { diagnosis: 'Цервикобрахиалгия', complaint: 'Шея заболела и отдаёт в плечо, рука тяжёлая и немеет' },
        { diagnosis: 'Эпикондилит', complaint: 'Локоть болит при каждом повороте ручки двери, не могу ничего поднять' },
        { diagnosis: 'Коксартроз', complaint: 'Тазобедренный сустав ноет постоянно, хромаю уже неделю' },
        { diagnosis: 'Фибромиалгия', complaint: 'Всё тело ломит, мышцы болят везде, особенно по утрам' }
      ],
      'patients.medical.antihistamine': [
        { diagnosis: 'Сезонный аллергический ринит', complaint: 'Чихаю без остановки, нос заложен полностью, не продохнуть' },
        { diagnosis: 'Вазомоторный ринит', complaint: 'Нос течёт ручьём без причины, постоянно заложен то с одной стороны, то с другой' },
        { diagnosis: 'Аллергический синусит', complaint: 'Нос забит, давит над бровями и в переносице, голова тяжёлая' },
        { diagnosis: 'Полипозный риносинусит', complaint: 'В носу как будто что-то мешает дышать, запахи не чувствую вообще' },
        { diagnosis: 'Круглогодичный ринит', complaint: 'Нос не дышит уже месяц, капли не помогают, всё время слизь в горле' },
        { diagnosis: 'Острый аллергический ринит', complaint: 'Погладил кошку — нос тут же заложило, глаза слезятся, чихаю' },
        { diagnosis: 'Аллергический фронтит', complaint: 'Лоб давит, нос забит, наклонюсь — боль в пазухах усиливается' },
        { diagnosis: 'Медикаментозный ринит', complaint: 'Подсел на капли для носа, без них вообще не дышу, а с ними всё хуже' },
        { diagnosis: 'Аллергический этмоидит', complaint: 'Между глаз давит, нос заложен, из носа густая слизь' },
        { diagnosis: 'Гипертрофический ринит', complaint: 'Одна ноздря не дышит совсем уже давно, вторая еле-еле' },
        { diagnosis: 'Аллергический ринофарингит', complaint: 'Нос заложен, слизь стекает в горло, из-за этого подкашливаю' },
        { diagnosis: 'Сфеноидит', complaint: 'Боль глубоко в носу, отдаёт в затылок, нос заложен постоянно' },
        { diagnosis: 'Аллергический гайморит', complaint: 'Щёки болят, нос не дышит, высмаркиваюсь — но заложенность не проходит' },
        { diagnosis: 'Атрофический ринит', complaint: 'В носу сухо и корки, дышать больно, иногда кровит' },
        { diagnosis: 'Пылевая аллергия', complaint: 'Дома нос закладывает, чихаю от пыли, на улице легче' },
        { diagnosis: 'Реактивная ринопатия', complaint: 'На холоде нос сразу течёт и закладывает, в тепле проходит' },
        { diagnosis: 'Аллергия на плесень', complaint: 'В сыром помещении нос забивается, чихаю, глаза чешутся' },
        { diagnosis: 'Озена', complaint: 'Из носа неприятный запах, корки, нос сухой и не дышит' },
        { diagnosis: 'Аллергический пансинусит', complaint: 'Вся голова как в тисках, нос заложен, давит на лоб и щёки' },
        { diagnosis: 'Профессиональный ринит', complaint: 'На работе нос закладывает от химикатов, дома нормально' }
      ],
      'patients.medical.strepsils': [
        { diagnosis: 'Гнойная ангина', complaint: 'Горло огнём горит, глотать невозможно, в горле что-то хрипит' },
        { diagnosis: 'Острый ларингит', complaint: 'Голос пропал полностью, в груди першит и сипит при дыхании' },
        { diagnosis: 'Острый трахеит', complaint: 'Кашляю без остановки, за грудиной саднит, дыхание с хрипом' },
        { diagnosis: 'Острый фарингит', complaint: 'Горло красное, больно даже воду пить, при дыхании чувствую хрип' },
        { diagnosis: 'Паратонзиллярный инфильтрат', complaint: 'С одной стороны горла всё опухло, рот открыть не могу, дышу с трудом' },
        { diagnosis: 'Ларингофарингеальный рефлюкс', complaint: 'Постоянно першит в горле, после еды ком и жжение за грудиной' },
        { diagnosis: 'Инфекционный мононуклеоз', complaint: 'Горло болит уже неделю, шея опухла, дышать тяжело' },
        { diagnosis: 'Гранулёзный фарингит', complaint: 'К вечеру голос садится, горло сухое, кашель сиплый' },
        { diagnosis: 'Острый бронхит', complaint: 'Кашель глубокий, в груди булькает, мокрота не отходит' },
        { diagnosis: 'Бронхоспазм', complaint: 'Дышать тяжело, на выдохе свист, грудь сдавило' },
        { diagnosis: 'Пневмония (начальная)', complaint: 'Кашель с мокротой, в груди справа что-то хрипит, температура' },
        { diagnosis: 'Плеврит', complaint: 'При глубоком вдохе колет в боку, дышу поверхностно, боюсь вдохнуть' },
        { diagnosis: 'Ларинготрахеит', complaint: 'Голос сел, кашель лающий, в горле свербит, за грудиной жжёт' },
        { diagnosis: 'Обструктивный бронхит', complaint: 'Дыхание со свистом, кашель не проходит, задыхаюсь при ходьбе' },
        { diagnosis: 'Трахеобронхит', complaint: 'Кашель сухой надрывный, саднит от горла до середины груди' },
        { diagnosis: 'Эпиглоттит', complaint: 'Горло болит так сильно что слюну сглотнуть не могу, голос гнусавый' },
        { diagnosis: 'Бронхиальная астма (приступ)', complaint: 'Вдохнуть не могу, на выдохе свист, в груди всё сжалось' },
        { diagnosis: 'Коклюш', complaint: 'Приступы кашля до рвоты, между ними свистящий вдох, не могу остановиться' },
        { diagnosis: 'Катаральная ангина', complaint: 'Горло покраснело, глотать больно, дышу ртом — нос свободен' },
        { diagnosis: 'Аденоидит', complaint: 'Дышу ртом, храплю ночью, голос гнусавый, в горле слизь' }
      ],

      // Injury pose map
      'patients.illnessRegionMap': {
        'Мигрень с аурой': 'head', 'Головная боль напряжения': 'head',
        'Люмбаго': 'back', 'Острый радикулит': 'back', 'Миофасциальный синдром': 'back',
        'Острый бурсит': 'leg', 'Коксартроз': 'leg',
        'Ишиас': 'leg', 'Тендинит ахиллова сухожилия': 'leg', 'Плантарный фасциит': 'leg',
        'Защемление локтевого нерва': 'arm', 'Артрит лучезапястного сустава': 'arm',
        'Посттравматическая невропатия': 'arm', 'Эпикондилит': 'arm', 'Цервикобрахиалгия': 'arm',
        'Шейный миозит': 'neck',
        'Жёлчная колика': 'stomach',
        'Пульпит': 'teeth',
        'Межрёберная невралгия': 'chest',
        'Фибромиалгия': 'fullBody',
        'Гнойная ангина': 'throat', 'Острый фарингит': 'throat',
        'Паратонзиллярный инфильтрат': 'throat', 'Ларингофарингеальный рефлюкс': 'throat',
        'Инфекционный мононуклеоз': 'throat', 'Гранулёзный фарингит': 'throat',
        'Эпиглоттит': 'throat', 'Катаральная ангина': 'throat', 'Аденоидит': 'throat',
        'Острый бронхит': 'chest', 'Бронхоспазм': 'chest',
        'Пневмония (начальная)': 'chest', 'Плеврит': 'chest',
        'Обструктивный бронхит': 'chest', 'Трахеобронхит': 'chest',
        'Бронхиальная астма (приступ)': 'chest', 'Коклюш': 'chest',
        'Острый ларингит': 'both', 'Острый трахеит': 'both', 'Ларинготрахеит': 'both'
      }
    },

    en: {
      // HTML static text
      'title': 'Private Clinic',
      'pause.title': 'Paused',
      'pause.subtitle': 'Click to continue',
      'overlay.title': 'Private Clinic',
      'overlay.start': 'Click to start',
      'overlay.controls1': 'WASD — movement  |  Mouse — camera  |  ESC — pause',
      'overlay.controls2': 'Q — shop  |  1-6 — inventory  |  E — box  |  LMB — interact',
      'overlay.graphics': 'Graphics: ',
      'overlay.language': 'Language: ',
      'quality.low': 'Low',
      'quality.medium': 'Medium',
      'quality.high': 'High',
      'hint.interact': 'Press LMB to interact',

      // Patient popup
      'popup.age': 'Age:',
      'popup.severity': 'Severity:',
      'popup.temp': 'TEMP',
      'popup.pulse': 'PULSE',
      'popup.bp': 'BP',
      'popup.condition': 'Condition',
      'popup.complaint': 'Complaint',
      'popup.diagnosis': 'Diagnosis',
      'popup.prescription': 'Prescription',
      'popup.btn.bed': 'To bed',
      'popup.btn.wait': 'To waiting area',
      'popup.btn.dismiss': 'Wait',
      'popup.btn.ok': 'OK',

      // Shop
      'shop.title': 'Shop',
      'shop.tab.consumables': 'Consumables',
      'shop.tab.instruments': 'Instruments',
      'shop.tab.furniture': 'Furniture',
      'shop.tab.upgrades': 'Upgrades',
      'shop.tab.staff': 'Staff',
      'shop.buy': 'Buy — ${0}',
      'shop.order.free': 'Order — Free!',
      'shop.purchased': 'Purchased \u2713',
      'shop.buyFirst': 'Buy level {0} first',
      'shop.upgrade1.name': 'More medications (lvl. 1)',
      'shop.upgrade1.desc': '10 per slot',
      'shop.upgrade2.name': 'More medications (lvl. 2)',
      'shop.upgrade2.desc': '15 per slot',
      'shop.upgrade3.name': 'More medications (lvl. 3)',
      'shop.upgrade3.desc': '20 per slot',
      'shop.staffSection.available': 'Available',
      'shop.staffSection.hired': 'Hired',
      'shop.staffSection.empty': 'No one yet',
      'shop.hire': 'Hire',
      'shop.fire': 'Fire — ${0}',
      'shop.salary': '${0}/day',
      'shop.perDay': 'day',

      // HUD
      'hud.balance': 'Balance:',
      'hud.level': 'Lvl.',
      'hud.day': 'Day {0}',

      // Shift/Time
      'shift.sign.open': 'OPEN',
      'shift.sign.closed': 'CLOSED',
      'shift.hint.ongoing': 'Shift in progress...',
      'shift.hint.ending': 'Admission closed. Finish remaining patients.',
      'shift.hint.open': 'LMB — Open shift',
      'shift.started': 'Shift started! Day {0}',
      'shift.ended': '20:00 — Admission closed! Finish remaining patients.',
      'shift.task.open': 'Open your shift! Go to the sign at the entrance.',
      'shift.task.finish': 'Finish remaining patients! ({0})',
      'shift.task.allDone': 'All patients served!',
      'shift.task.serve': 'Serve patients!',
      'shift.task.openShort': 'Open your shift!',

      // Day end popup
      'dayEnd.title': 'Day Summary',
      'dayEnd.served': 'Patients treated:',
      'dayEnd.lost': 'Patients lost:',
      'dayEnd.earned': 'Earned:',
      'dayEnd.spent': 'Spent:',
      'dayEnd.salary': 'Staff salary:',
      'dayEnd.next': 'Go to next day',

      // Level up
      'levelUp.title': 'Level {0}!',
      'levelUp.close': 'Great!',

      // Level select
      'levelSelect.title': 'Private Clinic',
      'levelSelect.subtitle': 'Choose starting level',
      'levelSelect.level': 'Level {0}',
      'levelSelect.l1.header': 'Level 1',
      'levelSelect.l2.header': 'Level 2',
      'levelSelect.l3.header': 'Level 3',
      'levelSelect.l4.header': 'Level 4',
      'levelSelect.start': 'Start',
      'levelSelect.l1f1': 'Only mild patients',
      'levelSelect.l1f2': 'Buy medications and linen',
      'levelSelect.l1f3': 'No diagnostics',
      'levelSelect.l1f4': 'Patients come one at a time',
      'levelSelect.l2f1': '+ Medium severity patients',
      'levelSelect.l2f2': '+ Buy instruments',
      'levelSelect.l2f3': 'Patients need diagnostics',
      'levelSelect.l2f4': 'Patients come one at a time',
      'levelSelect.l3f1': '+ Severe patients',
      'levelSelect.l3f2': '+ Buy furniture and upgrades',
      'levelSelect.l3f3': 'Patient stream every 20s',
      'levelSelect.l3f4': 'Diagnostics enabled',
      'levelSelect.l3f5': '+ Trash on floor',
      'levelSelect.l4f1': '+ Hire staff',
      'levelSelect.l4f2': 'Everything unlocked',
      'levelSelect.l4f3': 'Patient stream every 10s',
      'levelSelect.l4f4': 'Total chaos!',

      // Ad system
      'ad.offer.title': 'Insufficient funds!',
      'ad.offer.text': 'Watch an ad and get',
      'ad.watch': 'Watch ad',
      'ad.decline': 'No, thanks',
      'ad.timer': '{0} sec',
      'ad.done': 'Done!',
      'ad.confirm': 'If you close the ad, the reward will not be granted. Close?',
      'ad.confirmYes': 'Yes, close',
      'ad.confirmNo': 'Continue watching',
      'ad.reward': 'Credited to balance!',

      // Cashier
      'cashier.due': 'Total due:',
      'cashier.entered': 'Entered:',
      'cashier.treatment': 'treatment',
      'cashier.diagnostics': 'diagnostics',
      'cashier.xpTreatment': 'XP treatment',
      'cashier.xpDiagnostics': 'XP diagnostics',
      'cashier.hint.pay': 'LMB — Payment  |  Hold E — Move',
      'cashier.hint.move': 'Hold E — Move cashier desk',
      'cashier.staffWorking': 'Cashier is already working',

      // Item names
      'item.strepsils': 'Strepsils',
      'item.painkiller': 'Painkiller',
      'item.antihistamine': 'Antihistamine',
      'item.linen_clean': 'Bed linen',
      'item.linen_dirty': 'Dirty linen',
      'item.instrument_stethoscope': 'Stethoscope',
      'item.instrument_hammer': 'Reflex hammer',
      'item.instrument_rhinoscope': 'Rhinoscope',
      'item.default': 'item',

      // Furniture names
      'furniture.bed': 'Bed',
      'furniture.chair': 'Chair',
      'furniture.washingMachine': 'Washing machine',
      'furniture.basketClean': 'Basket (clean)',
      'furniture.basketDirty': 'Basket (dirty)',
      'furniture.shelf': 'Shelf',
      'furniture.toolPanel': 'Tool panel',
      'furniture.cashierDesk': 'Cashier desk',

      // Staff names
      'staff.administrator': 'Administrator',
      'staff.cashier': 'Cashier',
      'staff.diagnostician': 'Diagnostician',
      'staff.nurse': 'Nurse',
      'staff.janitor': 'Janitor',

      // Staff status labels
      'staff.status.processing': 'Processing',
      'staff.status.pickInstrument': 'Picking instrument',
      'staff.status.diagnosing': 'Diagnosing',
      'staff.status.returnInstrument': 'Returning',
      'staff.status.pickMedicine': 'Picking medicine',
      'staff.status.treating': 'Treating',
      'staff.status.changingLinen': 'Changing linen',
      'staff.status.cleaningTrash': 'Cleaning trash',
      'staff.status.depositDirty': 'Depositing',
      'staff.status.loadingMachine': 'Loading',
      'staff.status.collectClean': 'Collecting linen',

      // Signs (3D text on canvas)
      'sign.delivery': 'DELIVERY',
      'sign.trash': 'TRASH',
      'sign.instruments': 'INSTRUMENTS',
      'sign.clean': 'CLEAN',
      'sign.dirty': 'DIRTY',
      'sign.clinic': 'PRIVATE CLINIC',
      'sign.waitingArea': 'WAITING AREA',
      'sign.examination': 'EXAMINATION',
      'sign.cashier': 'CASHIER',
      'sign.reception': 'RECEPTION',
      'sign.laundry': 'LAUNDRY',
      'sign.deliveryZone': 'DELIVERY ZONE',

      // Inventory
      'inv.shop': 'Q — Shop',
      'inv.drop': 'G — Drop',

      // Notifications
      'notify.inventoryFull': 'Inventory full',
      'notify.insufficientFunds': 'Insufficient funds!',
      'notify.firstOrderFree': 'First order free!',
      'notify.upgradeSlot': 'Now you can store {0} medications per slot!',
      'notify.unlockLevel': 'Unlocks at level {0}',
      'notify.linenReplaced': 'Linen replaced!',
      'notify.cannotMove': 'Cannot move now',
      'notify.cannotMoveOccupied': 'Cannot move — item is occupied',
      'notify.cannotPlaceHere': 'Cannot place here',
      'notify.furnitureOutdoor': 'While {0} is outside — it cannot be used',
      'notify.treatmentStarted': 'Treatment started!',
      'notify.medicineApplied': 'Medicine applied! Remaining: {0}',
      'notify.wrongMedicine': 'Wrong medication!',
      'notify.patientDischarged': 'Patient discharged! Sent to payment.',
      'notify.patientLeft': 'Patient left without receiving help',
      'notify.diagnosisSet': 'Diagnosis confirmed!',
      'notify.adminProcessing': 'Administrator is processing the patient',
      'notify.diagAlreadyWorking': 'Diagnostician is already examining',
      'notify.needInstrument': 'Need: {0}',
      'notify.nurseAlreadyTreating': 'Nurse is already treating this patient',
      'notify.noMedicineInInventory': 'No required medications in inventory',
      'notify.queueOverflow': 'Patient could not enter because the queue is full',
      'wave.arrived': 'Ambulance brought patients! Assign each one — decide who to save first.',
      'notify.instrumentsToPanel': 'Hang instruments on the panel',
      'notify.putInBasket': 'Put in basket',
      'notify.alreadyHired': '{0} is already hired!',
      'notify.hired': '{0} hired!',
      'notify.fired': '{0} fired. Paid ${1}',
      'notify.wrongItem': 'Wrong medication! Need: {0}',

      // Levels (unlock descriptions)
      'levels.unlock2.0': 'Purchase diagnostic instruments',
      'levels.unlock2.1': 'Patients now require diagnostics',
      'levels.unlock2.2': 'Instruments are on the panel — use them!',
      'levels.unlock3.0': 'Buy furniture',
      'levels.unlock3.1': 'Inventory upgrades (slots)',
      'levels.unlock3.2': 'Patients now come in streams!',
      'levels.unlock3.3': 'Trash appears on the floor — clean up!',
      'levels.unlock4.0': 'Hire staff',
      'levels.xp.treatment': 'XP treatment',
      'levels.xp.diagnostics': 'XP diagnostics',

      // Diagnostics
      'diag.steth.title': 'Stethoscope — Find the auscultation point',
      'diag.steth.status': 'Hover over the point and hold for 3 seconds',
      'diag.steth.wrong': 'Nothing heard here. Try another point.',
      'diag.hammer.title': 'Reflex hammer — Check reflexes',
      'diag.hammer.status': 'Click the knee point when the bar is in the green zone ({0}/{1})',
      'diag.hammer.tooWeak': 'Too weak!',
      'diag.hammer.tooStrong': 'Too strong!',
      'diag.hammer.reflex': 'Reflex!',
      'diag.hammer.done': 'Reflexes checked! ({0}/{1})',
      'diag.hammer.reflexPoint': 'Reflex point',
      'diag.hammer.power': 'POWER',
      'diag.hammer.weak': 'weak',
      'diag.hammer.strong': 'strong',
      'diag.rhino.title': 'Rhinoscope — Navigate to the inflammation site',
      'diag.rhino.status': 'Guide the device through the nasal passage to the red point',
      'diag.start': 'START',
      'diag.target': 'TARGET',
      'diag.bodyPart.heart': 'Heart',
      'diag.bodyPart.leftLung': 'Left lung',
      'diag.bodyPart.rightLung': 'Right lung',
      'diag.bodyPart.abdomen': 'Abdomen',
      'diag.bodyPart.throat': 'Throat',

      // Stethoscope keyword matching
      'diag.steth.keywords': {
        throat: ['throat', 'voice', 'swallow', 'tickle', 'wheez', 'hoarse', 'nasal', 'tonsil', 'bark', 'saliva', 'mouth'],
        leftLung: ['left', 'side', 'right side', 'pleur'],
        rightLung: ['whistl', 'wheez', 'gurgl', 'phlegm', 'short of breath', 'obstruct'],
        heart: ['sternum', 'chest', 'constrict', 'compress'],
        abdomen: ['vomit', 'abdomen', 'stomach']
      },

      // Consumables/Box hints
      'box.held.trash': 'G — Throw in trash',
      'box.held.take': 'LMB — Take: {0} (remaining: {1})<br>G — Drop box',
      'box.hover.empty': 'E — Pick up empty box',
      'box.hover.full': 'LMB — Take: {0} ({1} pcs.)  |  E — Pick up box',
      'box.ground.pickup': 'Pick up with LMB',
      'box.label.consumables': 'consumables',
      'box.label.medications': 'medications',

      // Patient hints
      'patient.hint.treating': 'Patient is being treated...',
      'patient.hint.diagnose': 'LMB — Diagnose ({0})',
      'patient.hint.needInstrument': 'Need instrument ({0})',
      'patient.hint.treat': 'LMB — Treat',
      'patient.hint.needMedicines': 'Need medications: {0}',
      'patient.hint.needMedicine': 'Need medication ({0})',
      'patient.hint.toBed': 'LMB — Send to bed',
      'patient.hint.interact': 'Press LMB to interact',
      'patient.age': '{0} y.o.',
      'patient.pulse': '{0} bpm',
      'patient.needInstrument': 'Required: {0}',
      'patient.outdoorWarning': 'Beds/chairs cannot be used while outside',
      'patient.dirtyWarning1': 'Dirty linen on {0} bed — replace linen',
      'patient.dirtyWarningN': 'Dirty linen on {0} beds — replace linen',

      // Severity labels
      'severity.severe': 'Severe',
      'severity.medium': 'Moderate',
      'severity.mild': 'Mild',

      // Furniture hints
      'furniture.hint.replaceLinen': 'LMB — Replace linen',
      'furniture.hint.needCleanLinen': 'Need clean linen to replace',
      'furniture.hint.move': 'Hold E — Move {0}',
      'furniture.hint.place': 'E — Place {0}  |  Scroll — Rotate',

      // Washing machine
      'wash.hint.washing': 'Washing... {0} sec.',
      'wash.hint.loadDirty': 'Load dirty linen (LMB)',
      'wash.hint.loadAndStart': 'LMB — Load linen ({0}/{1})  |  E — Start wash',
      'wash.hint.load': 'LMB — Load linen ({0}/{1})',
      'wash.hint.fullStart': 'Machine full ({0}/{1})  |  E — Start wash',
      'wash.hint.start': 'E — Start wash ({0} pcs.)',
      'wash.started': 'Wash started! ({0} pcs.)',
      'wash.finished': 'Wash finished! Pick up linen.',
      'wash.full': 'Machine full ({0}/{1})',
      'wash.loaded': 'Linen loaded ({0}/{1})',
      'wash.loadFirst': 'Load dirty linen first',

      // Trash
      'trash.hint': 'Clean trash (LMB)',

      // Shelf hints
      'shelf.hint.take': 'Take {0} with LMB',
      'shelf.hint.place': 'Place with E',

      // Tool panel hints
      'panel.hint.take': 'Take {0} with LMB',
      'panel.hint.hang': 'Hang with E',

      // Staff basket hints
      'basket.cleanLinen': 'Clean linen',
      'basket.dirtyLinen': 'Dirty linen',
      'basket.take': 'LMB — Take ({0})',
      'basket.put': 'E — Put',

      // Staff warnings
      'staff.diagWarning': 'Diagnostician needs instruments:',
      'staff.nurseWarning': 'Nurse needs on shelf:',

      // Shop count labels
      'shop.count': '(have: {0})',

      // Tutorial steps
      'tutorial.stepOf': 'Step {0} of {1}',
      'tutorial.next': 'Next',
      'tutorial.start': 'Start!',
      'tutorial.step0': 'Welcome to Private Clinic!\nI will guide you through the basics.\nLet\'s begin!',
      'tutorial.step1': 'Go to the "CLOSED" sign at the entrance and click LMB to open your shift.',
      'tutorial.step2': 'Your first patient has arrived!\nApproach them and click LMB to view their medical card.',
      'tutorial.step3': 'This is the patient\'s medical card:\n\n\u2022 Name, age and condition severity\n\u2022 Vital signs: temperature, pulse, blood pressure\n\u2022 Patient complaint — what bothers them\n\u2022 Diagnosis and prescribed medication\n\u2022 Health bar — current condition',
      'tutorial.step4': '"To waiting area" — patient waits on a chair while you\'re busy.\n\n"To bed" — patient lies down and you can start treatment.\n\nClick "To bed"!',
      'tutorial.step5html': 'The patient needs medication. Open the shop by pressing <b>Q</b> and order:<br><br>{0}<b>{1}</b><br><br>First order of each type is <span style="color:#4ade80">free</span>!',
      'tutorial.step6html': 'Click the "Order" button next to:<br><br>{0}<b>{1}</b>',
      'tutorial.step7': 'Great! The item is on its way.\nClose the shop with \u2715 or press Q.',
      'tutorial.step8': 'A box with medication appeared in the delivery zone at the entrance.\nGo to it and click LMB to take the medication.',
      'tutorial.step9': 'Now go to the patient on the bed and click LMB to apply the medication.',
      'tutorial.step10': 'Medication applied! The patient is recovering — the health bar is filling up.\n\nWhen fully recovered, they will go to the cashier to pay.',
      'tutorial.step11': 'The patient has recovered and is heading to the cashier!\nGo to the payment terminal (right of the desk) and click LMB.',
      'tutorial.step12': 'Enter the payment amount using the terminal keypad and press OK.',
      'tutorial.step13': 'Payment accepted!\n\nNote: after the patient left, the bed became dirty. You cannot place a new patient on a dirty bed!\n\nLet\'s learn to change the linen.',
      'tutorial.step14': 'Open the shop (Q) and order clean bed linen.',
      'tutorial.step15html': 'Click the "Order" button next to:<br><br><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:#dde4f0;vertical-align:middle;margin-right:6px;border:1px solid #aab;"></span><b>{0}</b>',
      'tutorial.step16': 'Great! Close the shop.',
      'tutorial.step17': 'Go to the linen box in the delivery zone and take clean linen with LMB.',
      'tutorial.step18': 'Now go to the dirty bed and click LMB to replace the linen.',
      'tutorial.step19': 'The bed is clean again!\n\nBut you have dirty linen in your inventory. You can wash it in the washing machine!\n\nSelect dirty linen in inventory (keys 1-6) and go to the washing machine.',
      'tutorial.step20': 'Select dirty linen in inventory and click LMB on the washing machine to load it.',
      'tutorial.step21': 'Linen loaded! Press E to start the wash.',
      'tutorial.step22': 'Wash started! Wait for the machine to finish...\n\nThis will take 5 seconds.',
      'tutorial.step23': 'Wash complete! Clean linen appeared on the machine.\nPick it up with LMB.',
      'tutorial.step24': 'Great! Now you have clean linen again.\n\nYou\'ve learned all the basics!\nNow manage the clinic on your own.\n\nGood luck!',
      'tutorial.defaultMedicine': 'medication',

      // Patient medical data
      'patients.names.male': ['Ivan','Alexei','Dmitry','Sergei','Andrei','Mikhail','Nikolai','Pavel','Oleg','Viktor'],
      'patients.names.female': ['Maria','Anna','Elena','Olga','Natalia','Tatiana','Svetlana','Irina','Ekaterina','Julia'],
      'patients.surnames.male': ['Smith','Johnson','Williams','Brown','Jones','Davis','Miller','Wilson','Moore','Taylor'],
      'patients.surnames.female': ['Smith','Johnson','Williams','Brown','Jones','Davis','Miller','Wilson','Moore','Taylor'],

      // Medical cases
      'patients.medical.painkiller': [
        { diagnosis: 'Migraine with aura', complaint: 'Splitting headache, light hurts my eyes, it\'s been going on for two hours' },
        { diagnosis: 'Lumbago', complaint: 'Bent down for a bag — my back locked up, can\'t straighten up' },
        { diagnosis: 'Acute bursitis', complaint: 'Knee swelled up after jogging, can\'t bend my leg' },
        { diagnosis: 'Pulpitis', complaint: 'Tooth started aching in the middle of the night, pain radiates to the ear, unbearable' },
        { diagnosis: 'Intercostal neuralgia', complaint: 'Sharp shooting pain between shoulder blades when turning, hurts to breathe' },
        { diagnosis: 'Sciatica', complaint: 'Leg pulls from lower back to the heel, can\'t sit or stand' },
        { diagnosis: 'Cervical myositis', complaint: 'Neck got chilled, can\'t turn my head at all' },
        { diagnosis: 'Biliary colic', complaint: 'Stomach cramped on the right side after fatty food, nauseous' },
        { diagnosis: 'Achilles tendinitis', complaint: 'Heel hurts with every step, can\'t even stand up in the morning' },
        { diagnosis: 'Plantar fasciitis', complaint: 'Foot burns like fire, especially after sleep — first steps are unbearable' },
        { diagnosis: 'Ulnar nerve entrapment', complaint: 'Fingers go numb and tingle, elbow aches' },
        { diagnosis: 'Acute radiculitis', complaint: 'Shooting pain in lower back with every movement, leg pulls down' },
        { diagnosis: 'Myofascial syndrome', complaint: 'Back muscles are rock-hard, pressing triggers shooting pain in the arm' },
        { diagnosis: 'Wrist arthritis', complaint: 'Wrist is swollen and painful, can\'t even hold a cup' },
        { diagnosis: 'Post-traumatic neuropathy', complaint: 'After the hit, my arm barely responds, fingers go numb' },
        { diagnosis: 'Tension headache', complaint: 'Head feels squeezed in a vice, band around forehead, aching since morning' },
        { diagnosis: 'Cervicobrachialgia', complaint: 'Neck hurts and radiates to shoulder, arm feels heavy and numb' },
        { diagnosis: 'Epicondylitis', complaint: 'Elbow hurts with every door handle turn, can\'t lift anything' },
        { diagnosis: 'Coxarthrosis', complaint: 'Hip joint aches constantly, been limping for a week' },
        { diagnosis: 'Fibromyalgia', complaint: 'Whole body aches, muscles hurt everywhere, especially in the morning' }
      ],
      'patients.medical.antihistamine': [
        { diagnosis: 'Seasonal allergic rhinitis', complaint: 'Sneezing non-stop, nose completely blocked, can\'t breathe' },
        { diagnosis: 'Vasomotor rhinitis', complaint: 'Nose runs like a faucet for no reason, constantly blocked on one side then the other' },
        { diagnosis: 'Allergic sinusitis', complaint: 'Nose is stuffed, pressure above eyebrows and bridge of nose, head feels heavy' },
        { diagnosis: 'Polypous rhinosinusitis', complaint: 'Something in my nose blocks breathing, can\'t smell anything at all' },
        { diagnosis: 'Perennial rhinitis', complaint: 'Nose hasn\'t breathed for a month, drops don\'t help, constant mucus in throat' },
        { diagnosis: 'Acute allergic rhinitis', complaint: 'Petted a cat — nose blocked immediately, eyes tearing, sneezing' },
        { diagnosis: 'Allergic frontal sinusitis', complaint: 'Forehead pressure, nose blocked, bending makes sinus pain worse' },
        { diagnosis: 'Drug-induced rhinitis', complaint: 'Got hooked on nose drops, can\'t breathe without them, getting worse' },
        { diagnosis: 'Allergic ethmoiditis', complaint: 'Pressure between eyes, nose blocked, thick mucus from nose' },
        { diagnosis: 'Hypertrophic rhinitis', complaint: 'One nostril hasn\'t breathed at all for a long time, the other barely' },
        { diagnosis: 'Allergic rhinopharyngitis', complaint: 'Nose blocked, mucus drips into throat, causing me to cough' },
        { diagnosis: 'Sphenoiditis', complaint: 'Deep pain in nose, radiates to back of head, nose constantly blocked' },
        { diagnosis: 'Allergic maxillary sinusitis', complaint: 'Cheeks hurt, nose doesn\'t breathe, blowing doesn\'t clear the congestion' },
        { diagnosis: 'Atrophic rhinitis', complaint: 'Nose is dry with crusts, painful to breathe, sometimes bleeds' },
        { diagnosis: 'Dust allergy', complaint: 'Nose gets blocked at home, sneeze from dust, better outside' },
        { diagnosis: 'Reactive rhinopathy', complaint: 'In cold weather nose immediately runs and blocks, clears in warmth' },
        { diagnosis: 'Mold allergy', complaint: 'In damp rooms nose gets stuffed, sneezing, eyes itch' },
        { diagnosis: 'Ozena', complaint: 'Unpleasant smell from nose, crusts, nose dry and can\'t breathe' },
        { diagnosis: 'Allergic pansinusitis', complaint: 'Whole head feels squeezed, nose blocked, pressure on forehead and cheeks' },
        { diagnosis: 'Occupational rhinitis', complaint: 'Nose blocks from chemicals at work, fine at home' }
      ],
      'patients.medical.strepsils': [
        { diagnosis: 'Purulent tonsillitis', complaint: 'Throat burns like fire, impossible to swallow, something wheezes in throat' },
        { diagnosis: 'Acute laryngitis', complaint: 'Voice completely gone, chest feels scratchy and wheezy when breathing' },
        { diagnosis: 'Acute tracheitis', complaint: 'Coughing non-stop, rawness behind sternum, wheezing breath' },
        { diagnosis: 'Acute pharyngitis', complaint: 'Throat is red, painful to even drink water, wheezing when breathing' },
        { diagnosis: 'Peritonsillar infiltrate', complaint: 'One side of throat is all swollen, can\'t open mouth, breathing with difficulty' },
        { diagnosis: 'Laryngopharyngeal reflux', complaint: 'Constant throat tickle, lump and burning behind sternum after eating' },
        { diagnosis: 'Infectious mononucleosis', complaint: 'Throat has been hurting for a week, neck swollen, hard to breathe' },
        { diagnosis: 'Granular pharyngitis', complaint: 'Voice gets hoarse by evening, throat is dry, raspy cough' },
        { diagnosis: 'Acute bronchitis', complaint: 'Deep cough, gurgling in chest, phlegm won\'t come up' },
        { diagnosis: 'Bronchospasm', complaint: 'Hard to breathe, whistling on exhale, chest feels compressed' },
        { diagnosis: 'Pneumonia (early stage)', complaint: 'Cough with phlegm, something wheezes in right chest, fever' },
        { diagnosis: 'Pleurisy', complaint: 'Sharp pain in side on deep breath, breathing shallowly, afraid to inhale' },
        { diagnosis: 'Laryngotracheitis', complaint: 'Voice is hoarse, barking cough, throat itches, burning behind sternum' },
        { diagnosis: 'Obstructive bronchitis', complaint: 'Wheezing breath, cough won\'t stop, short of breath when walking' },
        { diagnosis: 'Tracheobronchitis', complaint: 'Dry tearing cough, rawness from throat to middle of chest' },
        { diagnosis: 'Epiglottitis', complaint: 'Throat hurts so bad can\'t swallow saliva, voice is nasal' },
        { diagnosis: 'Bronchial asthma (attack)', complaint: 'Can\'t inhale, whistling on exhale, everything in chest is constricted' },
        { diagnosis: 'Whooping cough', complaint: 'Coughing fits to the point of vomiting, whistling inhale between them, can\'t stop' },
        { diagnosis: 'Catarrhal tonsillitis', complaint: 'Throat is red, painful to swallow, breathing through mouth — nose is clear' },
        { diagnosis: 'Adenoiditis', complaint: 'Breathing through mouth, snoring at night, nasal voice, mucus in throat' }
      ],

      // Injury pose map
      'patients.illnessRegionMap': {
        'Migraine with aura': 'head', 'Tension headache': 'head',
        'Lumbago': 'back', 'Acute radiculitis': 'back', 'Myofascial syndrome': 'back',
        'Acute bursitis': 'leg', 'Coxarthrosis': 'leg',
        'Sciatica': 'leg', 'Achilles tendinitis': 'leg', 'Plantar fasciitis': 'leg',
        'Ulnar nerve entrapment': 'arm', 'Wrist arthritis': 'arm',
        'Post-traumatic neuropathy': 'arm', 'Epicondylitis': 'arm', 'Cervicobrachialgia': 'arm',
        'Cervical myositis': 'neck',
        'Biliary colic': 'stomach',
        'Pulpitis': 'teeth',
        'Intercostal neuralgia': 'chest',
        'Fibromyalgia': 'fullBody',
        'Purulent tonsillitis': 'throat', 'Acute pharyngitis': 'throat',
        'Peritonsillar infiltrate': 'throat', 'Laryngopharyngeal reflux': 'throat',
        'Infectious mononucleosis': 'throat', 'Granular pharyngitis': 'throat',
        'Epiglottitis': 'throat', 'Catarrhal tonsillitis': 'throat', 'Adenoiditis': 'throat',
        'Acute bronchitis': 'chest', 'Bronchospasm': 'chest',
        'Pneumonia (early stage)': 'chest', 'Pleurisy': 'chest',
        'Obstructive bronchitis': 'chest', 'Tracheobronchitis': 'chest',
        'Bronchial asthma (attack)': 'chest', 'Whooping cough': 'chest',
        'Acute laryngitis': 'both', 'Acute tracheitis': 'both', 'Laryngotracheitis': 'both'
      }
    }
  };

  // --- Current language ---
  var _lang = localStorage.getItem('gameLang') || 'ru';

  /**
   * Get a translated string by key, with optional placeholder substitution.
   * Supports {0}, {1}, ... placeholders.
   * For array/object values, returns them directly (no substitution).
   * @param {string} key
   * @param {...*} params - replacement values for {0}, {1}, etc.
   * @returns {*}
   */
  function t(key, params) {
    var dict = STRINGS[_lang] || STRINGS['ru'];
    var val = dict[key];
    if (val === undefined) {
      // Fallback to Russian
      val = STRINGS['ru'][key];
    }
    if (val === undefined) return key;

    // For non-string values (arrays, objects), return directly
    if (typeof val !== 'string') return val;

    // Substitute placeholders
    if (params !== undefined) {
      var args = Array.isArray(params) ? params : [params];
      for (var i = 0; i < args.length; i++) {
        val = val.split('{' + i + '}').join(String(args[i]));
      }
    }
    return val;
  }

  /**
   * Update all DOM elements with [data-lang-key] attribute.
   * Uses innerHTML if element has [data-lang-html], otherwise textContent.
   */
  function applyAll() {
    var elements = document.querySelectorAll('[data-lang-key]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var key = el.getAttribute('data-lang-key');
      var val = t(key);
      if (typeof val !== 'string') continue;
      if (el.hasAttribute('data-lang-html')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  }

  /**
   * Set the active language, save to localStorage, and reload the page.
   * @param {string} code - 'ru' or 'en'
   */
  function setLang(code) {
    localStorage.setItem('gameLang', code);
    location.reload();
  }

  /**
   * Get the current language code.
   * @returns {string}
   */
  function getLang() {
    return _lang;
  }

  // Apply translations on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    applyAll();
    // Update page title
    document.title = t('title');
    document.documentElement.lang = _lang === 'ru' ? 'ru' : 'en';
    // Highlight active language button
    var langBtns = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < langBtns.length; i++) {
      if (langBtns[i].dataset.lang === _lang) {
        langBtns[i].classList.add('active');
      } else {
        langBtns[i].classList.remove('active');
      }
      langBtns[i].addEventListener('click', function() {
        setLang(this.dataset.lang);
      });
    }
  });

  // --- Public API ---
  window.Game.Lang = {
    t: t,
    applyAll: applyAll,
    setLang: setLang,
    getLang: getLang
  };
})();
