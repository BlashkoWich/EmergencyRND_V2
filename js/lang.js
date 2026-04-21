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
      'popup.complaint': 'Жалоба',
      'popup.diagnosis': 'Диагноз',
      'popup.prescription': 'Назначение',
      'popup.btn.wait': 'В зону ожидания',
      'popup.btn.reject': 'Отказать',
      'popup.btn.defer': 'Отложить',
      'popup.err.wardTypeMismatch': 'Эта палата не принимает пациентов такого типа сложности',
      'popup.err.wardFull': 'В этой палате нет свободных мест',
      'popup.btn.sendHome': 'Отпустить домой',
      'popup.btn.ok': 'Понятно',

      // Wards
      'ward.name.easy': 'Лёгкая',
      'ward.name.easyPlus': 'Лёгкая улучшенная',
      'ward.name.medium': 'Средняя',
      'ward.name.hard': 'Сложная',
      'ward.name.hardPlus': 'Сложная улучшенная',
      'ward.name.vip': 'VIP',
      'patient.tier.basic': 'Обычная',
      'patient.tier.improved': 'Улучшенная',
      'patient.tier.vip': 'VIP',
      'patient.tierPrefers': 'Хочет в палату: {0}',

      // Signs
      'sign.ward.easy': 'ЛЁГКАЯ',
      'sign.ward.easyPlus': 'ЛЁГКАЯ+',
      'sign.ward.medium': 'СРЕДНЯЯ',
      'sign.ward.hard': 'СЛОЖНАЯ',
      'sign.ward.hardPlus': 'СЛОЖНАЯ+',
      'sign.ward.vip': 'VIP',

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
      'shop.fire': 'Уволить',

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
      'dayEnd.next': 'Перейти в следующий день',

      // Level up
      'levelUp.title': 'Уровень {0}!',
      'levelUp.close': 'Отлично!',

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

      // Self-service register
      'register.hint.withdraw': 'Удерживай E — Забрать деньги',
      'register.hint.move': 'Зажми E — Переместить кассу',
      'register.hint.empty': 'Касса пуста',
      'register.hint.busy': 'Идёт обслуживание пациента',

      // Item names
      'item.strepsils': 'Стрепсилс',
      'item.painkiller': 'Обезболивающее',
      'item.antihistamine': 'Антигистаминное',
      'item.instrument_stethoscope': 'Фонендоскоп',
      'item.instrument_hammer': 'Рефлекс-молоток',
      'item.instrument_rhinoscope': 'Риноскоп',
      'item.default': 'предмет',

      // Furniture names
      'furniture.bed': 'Кровать',
      'furniture.chair': 'Стул',
      'furniture.shelf': 'Стеллаж',
      'furniture.toolPanel': 'Панель инструментов',
      'furniture.cashierDesk': 'Касса самообслуживания',

      // Staff names
      'staff.administrator': 'Администратор',
      'staff.nurse': 'Медсестра',

      // Staff status labels
      'staff.status.processing': 'Оформление',
      'staff.status.pickMedicine': 'Берёт лекарство',
      'staff.status.treating': 'Лечение',
      'staff.status.cleaningTrash': 'Уборка мусора',
      'patient.status.recovering': 'Восстановление',

      // Signs (3D text on canvas)
      'sign.delivery': 'ДОСТАВКА',
      'sign.trash': 'МУСОР',
      'sign.clinic': 'ЧАСТНАЯ КЛИНИКА',
      'sign.waitingArea': 'ЗОНА ОЖИДАНИЯ',
      'sign.selfService': 'САМООБСЛУЖИВАНИЕ',
      'sign.reception': 'РЕСЕПШЕН',
      'sign.deliveryZone': 'ЗОНА ДОСТАВКИ',

      // Inventory
      'inv.shop': 'Q — Магазин',
      'inv.wrench': 'R — Ремонтный ключ',
      'inv.drop': 'G — Бросить',

      // Notifications
      'notify.inventoryFull': 'Инвентарь полон',
      'notify.insufficientFunds': 'Недостаточно средств!',
      'notify.firstOrderFree': 'Первый заказ бесплатно!',
      'notify.upgradeSlot': 'Теперь можно хранить {0} препаратов в слоте!',
      'notify.unlockLevel': 'Разблокируется на уровне {0}',
      'notify.bedRepaired': 'Кровать отремонтирована!',
      'notify.cannotMove': 'Сейчас нельзя переместить',
      'notify.cannotMoveOccupied': 'Нельзя переместить — предмет занят',
      'notify.cannotPlaceHere': 'Нельзя разместить здесь',
      'notify.furnitureOutdoor': 'Пока {0} на улице — её нельзя использовать',
      'notify.treatmentStarted': 'Лечение начато!',
      'notify.medicineApplied': 'Препарат применён! Осталось: {0}',
      'notify.wrongMedicine': 'Неправильный препарат!',
      'notify.patientDischarged': 'Пациент выписан! Направлен на оплату.',
      'notify.patientLeft': 'Пациент ушел, не дождавшись помощи',
      'notify.patientRejected': 'Пациент отклонён и ушёл',
      'notify.adminProcessing': 'Администратор оформляет пациента',
      'notify.nurseAlreadyTreating': 'Медсестра уже лечит этого пациента',
      'notify.noMedicineInInventory': 'Нет нужных препаратов в инвентаре',
      'notify.queueOverflow': 'Пациент не смог зайти из-за того, что очередь переполнена',
      'wave.arrived': 'Скорая привезла пациентов! Определите каждого — решите, кого спасать первым.',
      'notify.alreadyHired': '{0} уже нанят(а)!',
      'notify.hired': '{0} нанят(а)!',
      'notify.fired': '{0} уволен(а)',
      'notify.wrongItem': 'Это не тот препарат! Нужен: {0}',
      'notify.newWave': 'Пришла новая группа пациентов!',

      // Levels (unlock descriptions — levels 3+ only; L1/L2 start state)
      'levels.unlock3.0': 'Покупка мебели',
      'levels.unlock3.1': 'Прокачка инвентаря (слоты)',
      'levels.unlock3.2': 'Пациенты теперь идут потоком!',
      'levels.unlock3.3': 'На полу появляется мусор — убирайте!',
      'levels.unlock4.0': 'Найм сотрудников',
      'levels.xp.treatment': 'XP лечение',

      // Consumables/Box hints
      'box.held.trash': 'G — Выбросить в мусорку',
      'box.held.take': 'ЛКМ — Взять: {0} (осталось: {1})<br>G — Бросить коробку',
      'box.hover.empty': 'E — Поднять пустую коробку',
      'box.hover.full': 'ЛКМ — Взять: {0} ({1} шт.)  |  E — Поднять коробку',
      'box.ground.pickup': 'Поднять на ЛКМ',
      'box.label.consumables': 'расходники',
      'box.label.medications': 'препараты',

      // Patient hints (player only interacts with head-of-queue)
      'patient.hint.interact': 'ЛКМ — Осмотреть',
      'patient.age': '{0} лет',
      'patient.pulse': '{0} уд/м',
      'patient.outdoorWarning': 'Пока мебель на улице — её нельзя использовать',

      // Severity labels
      'severity.severe': 'Тяжёлое',
      'severity.medium': 'Среднее',
      'severity.mild': 'Лёгкое',

      // Furniture hints
      'furniture.hint.move': 'Зажми E — Переместить {0}',
      'furniture.hint.place': 'E — Поставить {0}  |  Колёсико — Поворот',

      // Wrench / bed repair
      'wrench.equipped': 'Ремонтный ключ в руке',
      'wrench.unequipped': 'Ремонтный ключ убран',
      'wrench.hint.bedHp': 'Кровать: {0}/{1} HP — зажмите E для ремонта',
      'wrench.hint.broken': 'Кровать сломана ({0}/{1}) — зажмите E для ремонта',
      'controls.wrench': 'R — взять ремонтный ключ',

      // Trash
      'trash.hint': 'Убрать мусор (ЛКМ)',

      // Shelf hints
      'shelf.hint.take': 'Взять {0} на ЛКМ',
      'shelf.hint.place': 'Положить на E',

      // Tool panel hints
      'panel.hint.take': 'Взять {0} на ЛКМ',
      'panel.hint.hang': 'Повесить на E',

      // Staff warnings
      'staff.nurseWarning': 'Медсестре не хватает на стеллаже:',

      // Shop count labels
      'shop.count': '(есть: {0})',

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
      'popup.complaint': 'Complaint',
      'popup.diagnosis': 'Diagnosis',
      'popup.prescription': 'Prescription',
      'popup.btn.wait': 'To waiting area',
      'popup.btn.reject': 'Reject',
      'popup.btn.defer': 'Defer',
      'popup.err.wardTypeMismatch': 'This ward does not admit patients of this complexity',
      'popup.err.wardFull': 'No free beds in this ward',
      'popup.btn.sendHome': 'Send home',
      'popup.btn.ok': 'OK',

      // Wards
      'ward.name.easy': 'Basic',
      'ward.name.easyPlus': 'Basic+',
      'ward.name.medium': 'Standard',
      'ward.name.hard': 'Critical',
      'ward.name.hardPlus': 'Critical+',
      'ward.name.vip': 'VIP',
      'patient.tier.basic': 'Basic',
      'patient.tier.improved': 'Improved',
      'patient.tier.vip': 'VIP',
      'patient.tierPrefers': 'Prefers ward: {0}',

      // Signs
      'sign.ward.easy': 'BASIC',
      'sign.ward.easyPlus': 'BASIC+',
      'sign.ward.medium': 'STANDARD',
      'sign.ward.hard': 'CRITICAL',
      'sign.ward.hardPlus': 'CRITICAL+',
      'sign.ward.vip': 'VIP',

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
      'shop.fire': 'Fire',

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
      'dayEnd.next': 'Go to next day',

      // Level up
      'levelUp.title': 'Level {0}!',
      'levelUp.close': 'Great!',

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
      'register.hint.withdraw': 'Hold E — Withdraw money',
      'register.hint.move': 'Hold E — Move register',
      'register.hint.empty': 'Register is empty',
      'register.hint.busy': 'Patient is checking out',

      // Item names
      'item.strepsils': 'Strepsils',
      'item.painkiller': 'Painkiller',
      'item.antihistamine': 'Antihistamine',
      'item.instrument_stethoscope': 'Stethoscope',
      'item.instrument_hammer': 'Reflex hammer',
      'item.instrument_rhinoscope': 'Rhinoscope',
      'item.default': 'item',

      // Furniture names
      'furniture.bed': 'Bed',
      'furniture.chair': 'Chair',
      'furniture.shelf': 'Shelf',
      'furniture.toolPanel': 'Tool panel',
      'furniture.cashierDesk': 'Self-checkout',

      // Staff names
      'staff.administrator': 'Administrator',
      'staff.nurse': 'Nurse',

      // Staff status labels
      'staff.status.processing': 'Processing',
      'staff.status.pickMedicine': 'Picking medicine',
      'staff.status.treating': 'Treating',
      'staff.status.cleaningTrash': 'Cleaning trash',
      'patient.status.recovering': 'Recovering',

      // Signs (3D text on canvas)
      'sign.delivery': 'DELIVERY',
      'sign.trash': 'TRASH',
      'sign.clinic': 'PRIVATE CLINIC',
      'sign.waitingArea': 'WAITING AREA',
      'sign.selfService': 'SELF CHECKOUT',
      'sign.reception': 'RECEPTION',
      'sign.deliveryZone': 'DELIVERY ZONE',

      // Inventory
      'inv.shop': 'Q — Shop',
      'inv.wrench': 'R — Wrench',
      'inv.drop': 'G — Drop',

      // Notifications
      'notify.inventoryFull': 'Inventory full',
      'notify.insufficientFunds': 'Insufficient funds!',
      'notify.firstOrderFree': 'First order free!',
      'notify.upgradeSlot': 'Now you can store {0} medications per slot!',
      'notify.unlockLevel': 'Unlocks at level {0}',
      'notify.bedRepaired': 'Bed repaired!',
      'notify.cannotMove': 'Cannot move now',
      'notify.cannotMoveOccupied': 'Cannot move — item is occupied',
      'notify.cannotPlaceHere': 'Cannot place here',
      'notify.furnitureOutdoor': 'While {0} is outside — it cannot be used',
      'notify.treatmentStarted': 'Treatment started!',
      'notify.medicineApplied': 'Medicine applied! Remaining: {0}',
      'notify.wrongMedicine': 'Wrong medication!',
      'notify.patientDischarged': 'Patient discharged! Sent to payment.',
      'notify.patientLeft': 'Patient left without receiving help',
      'notify.patientRejected': 'Patient rejected and left',
      'notify.adminProcessing': 'Administrator is processing the patient',
      'notify.nurseAlreadyTreating': 'Nurse is already treating this patient',
      'notify.noMedicineInInventory': 'No required medications in inventory',
      'notify.queueOverflow': 'Patient could not enter because the queue is full',
      'wave.arrived': 'Ambulance brought patients! Assign each one — decide who to save first.',
      'notify.alreadyHired': '{0} is already hired!',
      'notify.hired': '{0} hired!',
      'notify.fired': '{0} fired',
      'notify.wrongItem': 'Wrong medication! Need: {0}',
      'notify.newWave': 'A new group of patients has arrived!',

      // Levels (unlock descriptions)
      'levels.unlock3.0': 'Buy furniture',
      'levels.unlock3.1': 'Inventory upgrades (slots)',
      'levels.unlock3.2': 'Patients now come in streams!',
      'levels.unlock3.3': 'Trash appears on the floor — clean up!',
      'levels.unlock4.0': 'Hire staff',
      'levels.xp.treatment': 'XP treatment',

      // Consumables/Box hints
      'box.held.trash': 'G — Throw in trash',
      'box.held.take': 'LMB — Take: {0} (remaining: {1})<br>G — Drop box',
      'box.hover.empty': 'E — Pick up empty box',
      'box.hover.full': 'LMB — Take: {0} ({1} pcs.)  |  E — Pick up box',
      'box.ground.pickup': 'Pick up with LMB',
      'box.label.consumables': 'consumables',
      'box.label.medications': 'medications',

      // Patient hints (player only interacts with head-of-queue)
      'patient.hint.interact': 'LMB — Examine',
      'patient.age': '{0} y.o.',
      'patient.pulse': '{0} bpm',
      'patient.outdoorWarning': 'Furniture cannot be used while outside',

      // Severity labels
      'severity.severe': 'Severe',
      'severity.medium': 'Moderate',
      'severity.mild': 'Mild',

      // Furniture hints
      'furniture.hint.move': 'Hold E — Move {0}',
      'furniture.hint.place': 'E — Place {0}  |  Scroll — Rotate',

      // Wrench / bed repair
      'wrench.equipped': 'Wrench equipped',
      'wrench.unequipped': 'Wrench stowed',
      'wrench.hint.bedHp': 'Bed: {0}/{1} HP — hold E to repair',
      'wrench.hint.broken': 'Bed broken ({0}/{1}) — hold E to repair',
      'controls.wrench': 'R — equip wrench',

      // Trash
      'trash.hint': 'Clean trash (LMB)',

      // Shelf hints
      'shelf.hint.take': 'Take {0} with LMB',
      'shelf.hint.place': 'Place with E',

      // Tool panel hints
      'panel.hint.take': 'Take {0} with LMB',
      'panel.hint.hang': 'Hang with E',

      // Staff warnings
      'staff.nurseWarning': 'Nurse needs on shelf:',

      // Shop count labels
      'shop.count': '(have: {0})',

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
