(function() {
  window.Game = window.Game || {};

  // --- Patient data pools ---
  var NAMES = ['Иван','Алексей','Дмитрий','Сергей','Андрей','Михаил','Николай','Павел','Олег','Виктор',
               'Мария','Анна','Елена','Ольга','Наталья','Татьяна','Светлана','Ирина','Екатерина','Юлия'];
  var SURNAMES = ['Иванов','Петров','Сидоров','Козлов','Новиков','Морозов','Волков','Соколов','Лебедев','Попов',
                  'Иванова','Петрова','Сидорова','Козлова','Новикова','Морозова','Волкова','Соколова','Лебедева','Попова'];
  // MEDICAL_DATA: complaints are designed to hint at the diagnostic instrument needed
  // painkiller → рефлекс-молоток: боль, нервы, рефлексы, суставы, мышцы
  // antihistamine → риноскоп: нос, пазухи, заложенность, отёки слизистой
  // strepsils → фонендоскоп: горло, дыхание, хрипы, кашель, грудная клетка
  var MEDICAL_DATA = {
    painkiller: { cases: [
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
    ]},
    antihistamine: { cases: [
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
    ]},
    strepsils: { cases: [
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
    ]}
  };
  var CONSUMABLE_KEYS = Object.keys(MEDICAL_DATA);

  var INSTRUMENT_MAP = {
    painkiller:    'instrument_hammer',
    antihistamine: 'instrument_rhinoscope',
    strepsils:     'instrument_stethoscope'
  };
  var BODY_COLORS = [0x4477aa, 0x44aa77, 0xaa7744, 0x7744aa, 0xaa4466, 0x5599bb, 0x88aa44];

  // --- Walk speed multiplier per severity ---
  var WALK_SPEED = {
    severe: 0.35, medium: 0.65, mild: 0.9, normal: 1.0
  };

  // --- Injury poses ---
  // shoulder/elbow: rotation X for upper arm pivot / forearm pivot
  // All values are at severity=1.0, scaled down by getSeverityFactor()
  var INJURY_POSES = {
    holdStomach: {   // both arms wrap to stomach, hunched
      hunch: 0.3, headDroop: 0.2, limp: false,
      lShoulder: -0.8, lElbow: -1.6,
      rShoulder: -0.8, rElbow: -1.6
    },
    holdBack: {      // one arm reaches behind to lower back, limping
      hunch: 0.25, headDroop: 0.15, limp: true,
      lShoulder: 0.5, lElbow: -1.0,
      rShoulder: 0, rElbow: -0.3
    },
    holdHead: {      // hands up near face/temples
      hunch: 0.1, headDroop: 0.15, limp: false,
      lShoulder: -1.8, lElbow: -2.0,
      rShoulder: -1.8, rElbow: -2.0
    },
    holdThroat: {    // one hand at throat level
      hunch: 0.15, headDroop: 0.2, limp: false,
      lShoulder: -1.4, lElbow: -2.2,
      rShoulder: 0, rElbow: 0
    },
    limp: {          // just limping, arms mostly free
      hunch: 0.12, headDroop: 0.08, limp: true,
      lShoulder: 0, lElbow: 0,
      rShoulder: 0, rElbow: 0
    }
  };

  var INJURY_MAP = {
    painkiller:    ['holdStomach', 'holdBack', 'limp'],
    antihistamine: ['holdHead'],
    strepsils:     ['holdThroat']
  };

  // --- Pose target values ---
  var POSE_VALUES = {
    standing: { poseRotX: 0, posePosY: 0, posePosZ: 0, bodyOffsetY: 0, legPivotY: 0.5, legRotX: 0, leftArmRotZ: 0, rightArmRotZ: 0 },
    sitting:  { poseRotX: 0, posePosY: 0, posePosZ: 0, bodyOffsetY: -0.30, legPivotY: 0.20, legRotX: -Math.PI / 2, leftArmRotZ: 0, rightArmRotZ: 0 },
    lying:    { poseRotX: -Math.PI / 2, posePosY: 0.62, posePosZ: 0.75, bodyOffsetY: 0, legPivotY: 0.5, legRotX: 0, leftArmRotZ: 0.3, rightArmRotZ: -0.3 }
  };
  var POSE_TRANSITION_SPEED = 2.5;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }

  function getPatientSpeed(patient) {
    var mult = patient.anim.recovered ? WALK_SPEED.normal : (WALK_SPEED[patient.severity.key] || WALK_SPEED.mild);
    return PATIENT_SPEED * mult;
  }

  // Severity effect multiplier: 0 for normal/mild, partial for medium, full for severe
  function getSeverityFactor(patient) {
    if (patient.anim.recovered) return 0;
    var key = patient.severity.key;
    if (key === 'severe') return 1.0;
    if (key === 'medium') return 0.5;
    return 0.15;
  }

  // --- Health system constants ---
  var SEVERITIES = [
    { key: 'severe', label: 'Тяжёлое', startHp: 30 },
    { key: 'medium', label: 'Среднее', startHp: 50 },
    { key: 'mild',   label: 'Лёгкое',  startHp: 80 }
  ];
  var MAX_HP = 100;
  var HP_DECAY_INTERVAL = 3.0;
  var HP_RECOVERY_RATE = 3.0;

  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomRange(min, max) { return min + Math.random() * (max - min); }
  function randomInt(min, max) { return Math.floor(randomRange(min, max + 1)); }

  function generateVitals(severityKey) {
    var ranges = {
      severe: { tempMin: 38.5, tempMax: 39.8, sysMin: 150, sysMax: 180, diaMin: 95, diaMax: 110, pulseMin: 100, pulseMax: 130 },
      medium: { tempMin: 37.2, tempMax: 38.4, sysMin: 130, sysMax: 150, diaMin: 85, diaMax: 95, pulseMin: 80, pulseMax: 100 },
      mild:   { tempMin: 36.4, tempMax: 37.2, sysMin: 110, sysMax: 130, diaMin: 70, diaMax: 85, pulseMin: 65, pulseMax: 80 }
    };
    var r = ranges[severityKey] || ranges.mild;
    return {
      temp: Math.round(randomRange(r.tempMin, r.tempMax) * 10) / 10,
      bpSys: randomInt(r.sysMin, r.sysMax),
      bpDia: randomInt(r.diaMin, r.diaMax),
      pulse: randomInt(r.pulseMin, r.pulseMax)
    };
  }

  // --- Module state ---
  var THREE, scene, camera, controls;
  var beds, waitingChairs;
  var patients = [];
  var queue = [];
  var patientIdCounter = 0;
  var hoveredPatient = null;
  var popupPatient = null;
  var spawnTimer = 0;
  var SPAWN_INTERVAL = 10;
  var PATIENT_SPEED = 2.0;
  var animations = [];

  // --- UI elements ---
  var hintEl, popupEl, popupName, popupDiagnosis, popupSupply, popupSupplyIcon, popupSeverity;
  var popupAge, popupComplaint, popupTemp, popupPulse, popupBp;
  var popupSeverityBand, popupHpFill, popupHpText;
  var btnBed, btnWait, btnDismiss, bedCount, chairCount;

  // --- Interaction raycaster ---
  var interactRay;
  var screenCenter;

  function getQueuePosition(index) {
    return new THREE.Vector3(0, 0, -7.5 + index);
  }

  function createPatientMesh() {
    var group = new THREE.Group();
    var bodyColor = BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];
    var bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.6 });
    var legMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.7 });

    // Hierarchy: group > poseContainer > bodyContainer + legPivots
    var poseContainer = new THREE.Group();
    group.add(poseContainer);

    var bodyContainer = new THREE.Group();
    poseContainer.add(bodyContainer);

    // Body (torso)
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.25), bodyMat);
    body.position.y = 0.85; body.castShadow = true; bodyContainer.add(body);

    // Head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skinMat);
    head.position.y = 1.35; head.castShadow = true; bodyContainer.add(head);

    // Arms: shoulder pivot > upper arm > elbow pivot > forearm
    function createArm(xSide) {
      var shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(xSide * 0.28, 1.15, 0);
      bodyContainer.add(shoulderPivot);

      var upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.09), skinMat.clone());
      upperArm.position.y = -0.12; upperArm.castShadow = true;
      shoulderPivot.add(upperArm);

      var elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -0.24, 0);
      shoulderPivot.add(elbowPivot);

      var forearm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), skinMat.clone());
      forearm.position.y = -0.11; forearm.castShadow = true;
      elbowPivot.add(forearm);

      return { shoulderPivot: shoulderPivot, elbowPivot: elbowPivot, upperArm: upperArm, forearm: forearm };
    }

    var leftArm = createArm(-1);
    var rightArm = createArm(1);

    // Legs (pivots at hip, mesh hangs down)
    var leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.1, 0.5, 0);
    poseContainer.add(leftLegPivot);
    var leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.18), legMat);
    leftLeg.position.y = -0.25; leftLeg.castShadow = true; leftLegPivot.add(leftLeg);

    var rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.1, 0.5, 0);
    poseContainer.add(rightLegPivot);
    var rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.18), legMat);
    rightLeg.position.y = -0.25; rightLeg.castShadow = true; rightLegPivot.add(rightLeg);

    // Store references
    var ud = group.userData;
    ud.poseContainer = poseContainer;
    ud.bodyContainer = bodyContainer;
    ud.bodyMesh = body;
    ud.headMesh = head;
    ud.leftArm = leftArm;   // { shoulderPivot, elbowPivot, upperArm, forearm }
    ud.rightArm = rightArm;
    // Keep old names for pose transitions (lying/sitting)
    ud.leftArmPivot = leftArm.shoulderPivot;
    ud.rightArmPivot = rightArm.shoulderPivot;
    ud.leftLegPivot = leftLegPivot;
    ud.rightLegPivot = rightLegPivot;
    ud.bodyParts = [body, head, leftArm.upperArm, leftArm.forearm, rightArm.upperArm, rightArm.forearm, leftLeg, rightLeg];

    return group;
  }

  function spawnPatient(instant) {
    var mesh = createPatientMesh();
    mesh.position.set(0, 0, 1);
    scene.add(mesh);

    var consumableType = randomFrom(CONSUMABLE_KEYS);
    var data = MEDICAL_DATA[consumableType];
    var medCase = randomFrom(data.cases);
    var roll = Math.random();
    var severity = roll < 0.60 ? SEVERITIES[2] : roll < 0.85 ? SEVERITIES[1] : SEVERITIES[0];
    var needsDiagnosis = Math.random() < 0.2;

    var patient = {
      id: patientIdCounter++,
      name: randomFrom(NAMES),
      surname: randomFrom(SURNAMES),
      age: randomInt(18, 75),
      symptom: null,
      diagnosis: needsDiagnosis ? null : medCase.diagnosis,
      complaint: medCase.complaint,
      vitals: generateVitals(severity.key),
      requiredConsumable: needsDiagnosis ? null : consumableType,
      needsDiagnosis: needsDiagnosis,
      requiredInstrument: needsDiagnosis ? INSTRUMENT_MAP[consumableType] : null,
      hiddenSymptom: null,
      hiddenDiagnosis: needsDiagnosis ? medCase.diagnosis : null,
      hiddenConsumable: needsDiagnosis ? consumableType : null,
      mesh: mesh,
      state: 'queued',
      targetPos: null,
      queueTarget: null,
      destination: null,
      indicator: null,
      animating: false,
      hp: severity.startHp,
      maxHp: MAX_HP,
      severity: severity,
      treated: false,
      hpDecayTimer: 0,
      healthBar: null,
      lastDrawnHp: -1,
      particleTimer: 0,
      anim: {
        walkPhase: 0,
        walkBlend: 0,
        pose: 'standing',
        targetPose: 'standing',
        poseTransition: 1,
        poseFrom: 'standing',
        recovered: false,
        injuryType: randomFrom(INJURY_MAP[consumableType] || ['limp'])
      }
    };

    patients.push(patient);
    queue.push(patient);
    updateQueueTargets();
    createHealthBar(patient);

    if (instant && patient.queueTarget) {
      mesh.position.copy(patient.queueTarget);
      mesh.rotation.y = Math.PI;
    }

    return patient;
  }

  function updateQueueTargets() {
    for (var i = 0; i < queue.length; i++) {
      queue[i].queueTarget = getQueuePosition(i);
    }
  }

  function removeFromQueue(patient) {
    var idx = queue.indexOf(patient);
    if (idx !== -1) {
      queue.splice(idx, 1);
      updateQueueTargets();
    }
  }

  function highlightPatient(patient) {
    for (var i = 0; i < patient.mesh.userData.bodyParts.length; i++) {
      var part = patient.mesh.userData.bodyParts[i];
      part.material = part.material.clone();
      part.material.emissive = new THREE.Color(0x00ff44);
      part.material.emissiveIntensity = 0.35;
    }
  }

  function unhighlightPatient(patient) {
    for (var i = 0; i < patient.mesh.userData.bodyParts.length; i++) {
      var part = patient.mesh.userData.bodyParts[i];
      part.material.emissive = new THREE.Color(0x000000);
      part.material.emissiveIntensity = 0;
    }
  }

  function getPatientFromMesh(object) {
    var current = object;
    while (current) {
      if (current.userData && current.userData.bodyParts) {
        for (var i = 0; i < patients.length; i++) {
          if (patients[i].mesh === current) return patients[i];
        }
        return null;
      }
      current = current.parent;
    }
    return null;
  }

  function updateInteraction() {
    if (!controls.isLocked || popupPatient || Game.Cashier.isPopupOpen()) {
      hintEl.style.display = 'none';
      return;
    }
    if (Game.Diagnostics && Game.Diagnostics.isActive()) {
      hintEl.style.display = 'none';
      return;
    }

    interactRay.setFromCamera(screenCenter, camera);

    var meshes = [];
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      if (p.animating) continue;
      if (p.state === 'queued' || p.state === 'interacting' || p.state === 'atBed' || p.state === 'waiting') {
        p.mesh.traverse(function(child) {
          if (child.isMesh) meshes.push(child);
        });
      }
    }

    var hits = interactRay.intersectObjects(meshes);
    var newHovered = null;

    if (hits.length > 0) {
      newHovered = getPatientFromMesh(hits[0].object);
      if (newHovered && newHovered.animating) newHovered = null;
    }

    if (newHovered !== hoveredPatient) {
      if (hoveredPatient) unhighlightPatient(hoveredPatient);
      if (newHovered) highlightPatient(newHovered);
      hoveredPatient = newHovered;
    }

    if (!hoveredPatient) {
      hintEl.style.display = 'none';
    } else if (hoveredPatient.state === 'atBed') {
      if (hoveredPatient.treated) {
        hintEl.textContent = 'Пациент лечится...';
      } else if (hoveredPatient.needsDiagnosis) {
        var activeType = Game.Inventory.getActive();
        if (activeType && activeType === hoveredPatient.requiredInstrument) {
          var instrName = Game.Consumables.INSTRUMENT_TYPES[activeType].name;
          hintEl.textContent = 'ЛКМ — Диагностика (' + instrName + ')';
        } else if (activeType && Game.Consumables.isInstrument(activeType)) {
          var neededInstr = Game.Consumables.INSTRUMENT_TYPES[hoveredPatient.requiredInstrument];
          hintEl.textContent = 'Нужен инструмент (' + neededInstr.name + ')';
        } else {
          var neededInstr = Game.Consumables.INSTRUMENT_TYPES[hoveredPatient.requiredInstrument];
          hintEl.textContent = 'Нужен инструмент (' + neededInstr.name + ')';
        }
      } else {
        var activeType = Game.Inventory.getActive();
        if (activeType && !Game.Consumables.isInstrument(activeType)) {
          var typeName = Game.Consumables.TYPES[activeType].name;
          hintEl.textContent = 'ЛКМ — Применить ' + typeName;
        } else {
          var neededConsumable = Game.Consumables.TYPES[hoveredPatient.requiredConsumable];
          hintEl.textContent = 'Нужен препарат (' + neededConsumable.name + ')';
        }
      }
      hintEl.style.display = 'block';
    } else if (hoveredPatient.state === 'waiting') {
      hintEl.textContent = 'ЛКМ — Перевести на кровать';
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = 'Нажмите ЛКМ для взаимодействия';
      hintEl.style.display = 'block';
    }
  }

  function openPopup(patient) {
    popupPatient = patient;
    var wasWaiting = patient.state === 'waiting';
    patient.state = 'interacting';
    patient._wasWaiting = wasWaiting;

    // Header
    popupName.textContent = patient.name + ' ' + patient.surname;
    popupAge.textContent = patient.age + ' лет';

    // Severity
    var sevColors = { severe: '#ff4444', medium: '#ffcc00', mild: '#44cc44' };
    popupSeverity.textContent = patient.severity.label;
    popupSeverity.style.color = sevColors[patient.severity.key] || '#7abfff';
    popupSeverityBand.className = patient.severity.key;

    // Vitals
    var v = patient.vitals;
    popupTemp.textContent = v.temp.toFixed(1) + '\u00B0C';
    popupTemp.className = 'vital-value' + (v.temp >= 39.0 ? ' vital-critical' : v.temp >= 37.5 ? ' vital-warning' : '');
    popupPulse.textContent = v.pulse + ' уд/м';
    popupPulse.className = 'vital-value' + (v.pulse >= 110 ? ' vital-critical' : v.pulse >= 90 ? ' vital-warning' : '');
    popupBp.textContent = v.bpSys + '/' + v.bpDia;
    popupBp.className = 'vital-value' + (v.bpSys >= 160 ? ' vital-critical' : v.bpSys >= 140 ? ' vital-warning' : '');

    // HP bar
    var hpPct = Math.max(0, Math.round(patient.hp / patient.maxHp * 100));
    popupHpText.textContent = hpPct + '%';
    popupHpFill.style.width = hpPct + '%';
    var hpColor = hpPct > 60 ? '#32cd32' : hpPct > 30 ? '#ffc800' : '#dc2828';
    popupHpFill.style.background = hpColor;
    popupHpText.style.color = hpColor;

    // Clinical data
    popupComplaint.textContent = '\u00AB' + patient.complaint + '\u00BB';

    var popupInstrumentHint = document.getElementById('popup-instrument-hint');

    if (patient.needsDiagnosis) {
      popupDiagnosis.textContent = '????';
      popupDiagnosis.style.color = '#ff4444';
      popupSupply.textContent = '????';
      popupSupply.style.color = '#ff4444';
      popupSupplyIcon.style.display = 'none';

      // Show required instrument
      if (popupInstrumentHint) {
        var instrInfo = Game.Consumables.INSTRUMENT_TYPES[patient.requiredInstrument];
        popupInstrumentHint.textContent = 'Необходим: ' + instrInfo.name;
        popupInstrumentHint.style.display = 'block';
        popupInstrumentHint.style.color = '#ffaa44';
      }
    } else {
      popupDiagnosis.textContent = patient.diagnosis;
      popupDiagnosis.style.color = '';
      popupSupply.style.color = '';
      popupSupplyIcon.style.display = '';
      if (popupInstrumentHint) popupInstrumentHint.style.display = 'none';

      // Required consumable
      var typeInfo = Game.Consumables.TYPES[patient.requiredConsumable];
      popupSupply.textContent = typeInfo.name;
      var c = typeInfo.color;
      popupSupplyIcon.style.backgroundColor = 'rgb(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ')';
    }

    popupEl.style.display = 'block';

    // Bed/chair availability
    var freeBeds = beds.filter(function(b) { return !b.occupied; }).length;
    var freeChairs = waitingChairs.filter(function(c) { return !c.occupied; }).length;
    btnBed.disabled = freeBeds === 0;
    btnBed.style.opacity = freeBeds > 0 ? '1' : '0.4';
    bedCount.textContent = '(' + freeBeds + '/' + beds.length + ')';

    // Hide waiting button if patient is already waiting, show otherwise
    if (wasWaiting) {
      btnWait.style.display = 'none';
    } else {
      btnWait.style.display = '';
      btnWait.disabled = freeChairs === 0;
      btnWait.style.opacity = freeChairs > 0 ? '1' : '0.4';
      chairCount.textContent = '(' + freeChairs + '/' + waitingChairs.length + ')';
    }

    // Show wait/dismiss button
    btnDismiss.style.display = '';

    controls.unlock();
  }

  function closePopup() {
    popupEl.style.display = 'none';
    popupPatient = null;
    controls.lock();
  }

  function sendPatient(patient, dest, slot) {
    // Free old destination if moving from waiting chair
    if (patient._wasWaiting && patient.destination) {
      patient.destination.occupied = false;
    }
    patient._wasWaiting = false;
    patient.state = 'walking';
    patient.targetPos = dest.clone();
    patient.targetPos.y = 0;
    patient.destination = slot;
    slot.occupied = true;
    patient.anim.targetPose = 'standing';
    removeFromQueue(patient);
    closePopup();
  }

  function moveToward(pos, target, maxDist) {
    var dx = target.x - pos.x;
    var dz = target.z - pos.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= maxDist || dist < 0.05) {
      pos.x = target.x;
      pos.z = target.z;
      return true;
    }
    pos.x += (dx / dist) * maxDist;
    pos.z += (dz / dist) * maxDist;
    return false;
  }

  // --- Bed indicator ---
  function drawIndicatorIcon(ctx, type) {
    // Draw specific item icon on a 64x64 canvas (centered)
    ctx.save();
    if (type === 'strepsils') {
      // Blister pack with pills
      ctx.fillStyle = '#cc3333';
      ctx.beginPath();
      ctx.roundRect(10, 20, 44, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#ee5555';
      for (var row = 0; row < 2; row++) {
        for (var col = 0; col < 3; col++) {
          ctx.beginPath();
          ctx.arc(19 + col * 13, 27 + row * 11, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'painkiller') {
      // Pill bottle
      ctx.fillStyle = '#3366cc';
      ctx.beginPath();
      ctx.roundRect(20, 14, 24, 38, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(18, 10, 28, 10, 2);
      ctx.fill();
      ctx.fillStyle = '#dde';
      ctx.beginPath();
      ctx.roundRect(23, 30, 18, 12, 2);
      ctx.fill();
      ctx.fillStyle = '#3366cc';
      ctx.font = 'bold 9px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Rx', 32, 37);
    } else if (type === 'antihistamine') {
      // Green box with white cross
      ctx.fillStyle = '#33aa55';
      ctx.beginPath();
      ctx.roundRect(12, 12, 40, 40, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(26, 16, 12, 32, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(16, 26, 32, 12, 2);
      ctx.fill();
    } else if (type === 'instrument_stethoscope') {
      // Stethoscope
      ctx.strokeStyle = '#8866cc';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(32, 48);
      ctx.lineTo(32, 28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(32, 28);
      ctx.lineTo(22, 18);
      ctx.moveTo(32, 28);
      ctx.lineTo(42, 18);
      ctx.stroke();
      // Chest piece
      ctx.beginPath();
      ctx.arc(32, 50, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#aaa';
      ctx.fill();
      // Ear tips
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(20, 16, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(44, 16, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'instrument_hammer') {
      // Reflex hammer
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(32, 20);
      ctx.lineTo(32, 50);
      ctx.stroke();
      ctx.fillStyle = '#cc8844';
      ctx.beginPath();
      ctx.ellipse(32, 18, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#aa6622';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (type === 'instrument_rhinoscope') {
      // Rhinoscope
      ctx.fillStyle = '#44aacc';
      ctx.beginPath();
      ctx.roundRect(26, 20, 12, 28, 2);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.roundRect(25, 42, 14, 10, 2);
      ctx.fill();
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(26, 20);
      ctx.lineTo(38, 20);
      ctx.lineTo(32, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffaa';
      ctx.beginPath();
      ctx.arc(32, 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function createBedIndicator(patient) {
    var canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    var ctx = canvas.getContext('2d');

    var itemType, bgColor;
    if (patient.needsDiagnosis) {
      itemType = patient.requiredInstrument;
      var instrInfo = Game.Consumables.INSTRUMENT_TYPES[itemType];
      bgColor = instrInfo.color;
    } else {
      itemType = patient.requiredConsumable;
      var typeInfo = Game.Consumables.TYPES[itemType];
      bgColor = typeInfo.color;
    }

    var r = (bgColor >> 16) & 255, g = (bgColor >> 8) & 255, b = bgColor & 255;

    // Background circle with slight dark tint
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + Math.floor(r * 0.3) + ',' + Math.floor(g * 0.3) + ',' + Math.floor(b * 0.3) + ',0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw the actual item icon
    drawIndicatorIcon(ctx, itemType);

    var texture = new THREE.CanvasTexture(canvas);
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.4, 0.4, 1);
    sprite.position.copy(patient.mesh.position);
    sprite.position.y = 2.0;
    scene.add(sprite);
    patient.indicator = sprite;
  }

  // --- Health bar ---
  function getHealthColor(ratio) {
    if (ratio > 0.6) return { r: 50, g: 205, b: 50 };
    if (ratio > 0.3) return { r: 255, g: 200, b: 0 };
    return { r: 220, g: 40, b: 40 };
  }

  function createHealthBar(patient) {
    var canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 16;
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.6, 0.08, 1);
    sprite.position.copy(patient.mesh.position);
    sprite.position.y = 1.7;
    scene.add(sprite);
    patient.healthBar = sprite;
    patient.healthBarCanvas = canvas;
    patient.healthBarTexture = texture;
    updateHealthBarTexture(patient);
  }

  function updateHealthBarTexture(patient) {
    var hpInt = Math.floor(patient.hp);
    if (hpInt === patient.lastDrawnHp) return;
    patient.lastDrawnHp = hpInt;

    var canvas = patient.healthBarCanvas;
    var ctx = canvas.getContext('2d');
    var ratio = patient.hp / patient.maxHp;

    // Background
    ctx.clearRect(0, 0, 128, 16);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 128, 16, 4);
    ctx.fill();

    // Fill
    var fillW = Math.max(0, Math.min(126, ratio * 126));
    if (fillW > 0) {
      var col = getHealthColor(ratio);
      ctx.fillStyle = 'rgb(' + col.r + ',' + col.g + ',' + col.b + ')';
      ctx.beginPath();
      ctx.roundRect(1, 1, fillW, 14, 3);
      ctx.fill();
    }

    // HP text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hpInt + '/' + patient.maxHp, 64, 9);

    patient.healthBarTexture.needsUpdate = true;
  }

  // --- Healing particles ---
  var healParticles = [];
  var PARTICLE_SPAWN_INTERVAL = 0.15;
  var PARTICLE_LIFETIME = 1.2;
  var PARTICLE_SPEED = 0.6;

  function createParticleSprite() {
    if (!healParticleTexture) {
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var ctx = c.getContext('2d');
      // Green cross particle
      ctx.fillStyle = '#00ff88';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(12, 4, 8, 24);
      ctx.fillRect(4, 12, 24, 8);
      // Soft glow
      var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(100, 255, 160, 0.3)');
      grad.addColorStop(1, 'rgba(100, 255, 160, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      healParticleTexture = new THREE.CanvasTexture(c);
    }
    var mat = new THREE.SpriteMaterial({ map: healParticleTexture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.12, 0.12, 1);
    return sprite;
  }

  var healParticleTexture = null;

  function spawnHealParticle(patient) {
    var sprite = createParticleSprite();
    var px = patient.mesh.position.x + (Math.random() - 0.5) * 0.5;
    var pz = patient.mesh.position.z + (Math.random() - 0.5) * 0.3;
    var py = patient.mesh.position.y + 0.4 + Math.random() * 0.6;
    sprite.position.set(px, py, pz);
    scene.add(sprite);
    healParticles.push({
      sprite: sprite,
      life: PARTICLE_LIFETIME,
      maxLife: PARTICLE_LIFETIME,
      vx: (Math.random() - 0.5) * 0.2,
      vy: PARTICLE_SPEED + Math.random() * 0.3,
      vz: (Math.random() - 0.5) * 0.2
    });
  }

  function updateHealParticles(delta) {
    // Spawn particles for treated patients
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      if (p.treated && !p.animating) {
        if (!p.particleTimer) p.particleTimer = 0;
        p.particleTimer += delta;
        while (p.particleTimer >= PARTICLE_SPAWN_INTERVAL) {
          p.particleTimer -= PARTICLE_SPAWN_INTERVAL;
          spawnHealParticle(p);
        }
      }
    }

    // Update existing particles
    for (var i = healParticles.length - 1; i >= 0; i--) {
      var part = healParticles[i];
      part.life -= delta;
      if (part.life <= 0) {
        scene.remove(part.sprite);
        healParticles.splice(i, 1);
        continue;
      }
      part.sprite.position.x += part.vx * delta;
      part.sprite.position.y += part.vy * delta;
      part.sprite.position.z += part.vz * delta;
      var alpha = part.life / part.maxLife;
      part.sprite.material.opacity = alpha;
      var s = 0.12 * (0.5 + 0.5 * alpha);
      part.sprite.scale.set(s, s, 1);
    }
  }

  // --- Walking animation ---
  var STRIDE_LEN = 1.1;
  var LEG_SWING = 0.4;
  var ARM_SWING = 0.35;
  var ELBOW_SWING = 0.25;

  function updateWalkAnimation(patient, delta, isMoving) {
    var anim = patient.anim;
    if (anim.pose !== 'standing' || anim.poseTransition < 1) return;

    var ud = patient.mesh.userData;
    var sev = getSeverityFactor(patient);
    var pose = INJURY_POSES[anim.injuryType] || INJURY_POSES.limp;

    // --- Phase & blend ---
    if (isMoving) {
      var dist = getPatientSpeed(patient) * delta;
      anim.walkPhase += (dist / STRIDE_LEN) * Math.PI * 2;
      anim.walkBlend = Math.min(1, anim.walkBlend + delta * 5);
    } else {
      anim.walkBlend = Math.max(0, anim.walkBlend - delta * 4);
      if (anim.walkBlend <= 0) anim.walkPhase = 0;
    }

    var wb = anim.walkBlend;
    var ph = anim.walkPhase;
    var sinPh = Math.sin(ph);
    var sinPhOpp = Math.sin(ph + Math.PI);

    // --- Body hunch (forward lean) ---
    var hunch = pose.hunch * sev;
    ud.bodyMesh.rotation.x = hunch;
    ud.bodyMesh.rotation.y = 0;
    ud.bodyMesh.rotation.z = 0;
    ud.bodyMesh.position.y = 0.85;

    // --- Head droop ---
    ud.headMesh.rotation.x = pose.headDroop * sev;

    // --- Legs ---
    var legAmp = LEG_SWING * wb;
    if (pose.limp && sev > 0.1) {
      // Limp: right leg shorter swing, slight delay
      ud.leftLegPivot.rotation.x = sinPh * legAmp;
      ud.rightLegPivot.rotation.x = Math.sin(ph + Math.PI + 0.5 * sev) * legAmp * (1 - 0.4 * sev);
    } else {
      ud.leftLegPivot.rotation.x = sinPh * legAmp;
      ud.rightLegPivot.rotation.x = sinPhOpp * legAmp;
    }

    // --- Arms ---
    // Normal walk swing: shoulder swings, elbow bends slightly on backswing
    var normalLShoulderX = sinPhOpp * ARM_SWING * wb;
    var normalRShoulderX = sinPh * ARM_SWING * wb;
    var normalLElbowX = Math.min(0, sinPhOpp) * ELBOW_SWING * wb; // only bend on backswing
    var normalRElbowX = Math.min(0, sinPh) * ELBOW_SWING * wb;

    // Injury pose targets (scaled by severity)
    var injLShoulder = pose.lShoulder * sev;
    var injLElbow = pose.lElbow * sev;
    var injRShoulder = pose.rShoulder * sev;
    var injRElbow = pose.rElbow * sev;

    // Blend: sev=0 -> normal swing, sev=1 -> full injury pose with subtle sway
    var sway = sinPh * 0.04 * sev; // tiny rhythmic movement even in injury pose
    ud.leftArm.shoulderPivot.rotation.x = lerp(normalLShoulderX, injLShoulder, sev) + sway;
    ud.leftArm.elbowPivot.rotation.x = lerp(normalLElbowX, injLElbow, sev);
    ud.rightArm.shoulderPivot.rotation.x = lerp(normalRShoulderX, injRShoulder, sev) + sway;
    ud.rightArm.elbowPivot.rotation.x = lerp(normalRElbowX, injRElbow, sev);

    // Reset Z rotations (pose transition might set them)
    ud.leftArm.shoulderPivot.rotation.z = 0;
    ud.rightArm.shoulderPivot.rotation.z = 0;
  }

  // --- Pose transitions ---
  function updatePoseTransition(patient, delta) {
    var anim = patient.anim;
    if (anim.pose === anim.targetPose && anim.poseTransition >= 1) return;

    // Start new transition if target changed
    if (anim.pose !== anim.targetPose) {
      anim.poseFrom = anim.pose;
      anim.pose = anim.targetPose;
      anim.poseTransition = 0;

      // When lying down, move patient onto the bed center and align with bed
      if (anim.pose === 'lying' && patient.destination) {
        var bedPos = patient.destination.pos;
        // Bed center is 1 unit to the left of standing pos (bed at x=-5.5, patient at x=-4.5)
        anim.bedTargetX = bedPos.x - 1.0;
        anim.bedTargetZ = bedPos.z;
        anim.bedStartX = patient.mesh.position.x;
        anim.bedStartZ = patient.mesh.position.z;
        anim.bedStartRotY = patient.mesh.rotation.y;
        // Face along bed: head toward pillow/rail at -X side
        anim.bedTargetRotY = Math.PI / 2;
      }
      // When standing up from lying, save start position to restore standing pos
      if (anim.poseFrom === 'lying' && patient.destination) {
        var standPos = patient.destination.pos;
        anim.bedStartX = patient.mesh.position.x;
        anim.bedStartZ = patient.mesh.position.z;
        anim.bedStartRotY = patient.mesh.rotation.y;
        anim.bedTargetX = standPos.x;
        anim.bedTargetZ = standPos.z;
        anim.bedTargetRotY = 0;
      }
    }

    anim.poseTransition = Math.min(1, anim.poseTransition + delta * POSE_TRANSITION_SPEED);
    var t = smoothstep(anim.poseTransition);

    var from = POSE_VALUES[anim.poseFrom] || POSE_VALUES.standing;
    var to = POSE_VALUES[anim.pose] || POSE_VALUES.standing;
    var ud = patient.mesh.userData;

    // Pose container (lying rotation + height + Z compensation)
    ud.poseContainer.rotation.x = lerp(from.poseRotX, to.poseRotX, t);
    ud.poseContainer.position.y = lerp(from.posePosY, to.posePosY, t);
    ud.poseContainer.position.z = lerp(from.posePosZ, to.posePosZ, t);

    // Smoothly move root mesh onto/off bed during lying transition
    if (anim.bedTargetX !== undefined) {
      patient.mesh.position.x = lerp(anim.bedStartX, anim.bedTargetX, t);
      patient.mesh.position.z = lerp(anim.bedStartZ, anim.bedTargetZ, t);
      patient.mesh.rotation.y = lerp(anim.bedStartRotY, anim.bedTargetRotY, t);
      if (anim.poseTransition >= 1) {
        delete anim.bedTargetX;
        delete anim.bedTargetZ;
        delete anim.bedStartX;
        delete anim.bedStartZ;
        delete anim.bedStartRotY;
        delete anim.bedTargetRotY;
      }
    }

    // Body container (sitting offset)
    ud.bodyContainer.position.y = lerp(from.bodyOffsetY, to.bodyOffsetY, t);

    // Leg pivots vertical position (for sitting)
    var legY = lerp(from.legPivotY, to.legPivotY, t);
    ud.leftLegPivot.position.y = legY;
    ud.rightLegPivot.position.y = legY;

    // Leg rotation (for sitting)
    ud.leftLegPivot.rotation.x = lerp(from.legRotX, to.legRotX, t);
    ud.rightLegPivot.rotation.x = lerp(from.legRotX, to.legRotX, t);

    // Arm spread (for lying)
    ud.leftArmPivot.rotation.z = lerp(from.leftArmRotZ, to.leftArmRotZ, t);
    ud.rightArmPivot.rotation.z = lerp(from.rightArmRotZ, to.rightArmRotZ, t);

    // Reset walk-related rotations during transition
    ud.leftArmPivot.rotation.x = 0;
    ud.rightArmPivot.rotation.x = 0;
    if (ud.leftArm) ud.leftArm.elbowPivot.rotation.x = 0;
    if (ud.rightArm) ud.rightArm.elbowPivot.rotation.x = 0;
    ud.bodyMesh.position.y = 0.85;
    ud.bodyMesh.rotation.x = 0;
    ud.bodyMesh.rotation.z = 0;
    ud.headMesh.rotation.x = 0;
  }

  function updateIndicators() {
    var t = Date.now() * 0.003;
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      var isLying = p.anim.pose === 'lying';
      if (p.indicator) {
        p.indicator.position.x = p.mesh.position.x;
        p.indicator.position.z = p.mesh.position.z;
        p.indicator.position.y = isLying ? 1.5 : 2.0;
        var pulse = 0.4 + Math.sin(t + p.id) * 0.06;
        p.indicator.scale.set(pulse, pulse, 1);
      }
      if (p.healthBar) {
        p.healthBar.position.x = p.mesh.position.x;
        p.healthBar.position.z = p.mesh.position.z;
        p.healthBar.position.y = isLying ? 1.2 : 1.7;
      }
    }
  }

  // --- Treatment ---
  function treatPatient(patient) {
    Game.Inventory.removeActive();
    patient.animating = true;
    patient.treated = true;
    Game.Inventory.showNotification('Лечение начато!', 'rgba(34, 139, 34, 0.85)');

    // Clone materials for animation
    for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
      var part = patient.mesh.userData.bodyParts[j];
      part.material = part.material.clone();
      part.material.emissive = new THREE.Color(0x00ff44);
      part.material.emissiveIntensity = 0.8;
    }

    animations.push({ patient: patient, type: 'heal', timer: 0.5, maxTime: 0.5 });
  }

  function wrongTreatment(patient) {
    patient.animating = true;
    Game.Inventory.showNotification('Неправильный препарат!');

    // Clone materials for red flash
    for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
      var part = patient.mesh.userData.bodyParts[j];
      part.material = part.material.clone();
      part.material.emissive = new THREE.Color(0xff2222);
      part.material.emissiveIntensity = 0.5;
    }

    animations.push({
      patient: patient,
      type: 'shake',
      timer: 0.3,
      maxTime: 0.3,
      originX: patient.mesh.position.x
    });
  }

  function dischargePatient(patient) {
    // Free the bed/chair
    if (patient.indicator) {
      scene.remove(patient.indicator);
      patient.indicator = null;
    }
    if (patient.healthBar) {
      scene.remove(patient.healthBar);
      patient.healthBar = null;
    }
    if (patient.destination) {
      patient.destination.occupied = false;
      patient.destination = null;
    }
    patient.treated = false; // Stop recovery logic
    patient.anim.recovered = true;
    patient.anim.targetPose = 'standing';
    // Send to cashier
    Game.Cashier.addPatientToQueue(patient);
  }

  function removePatient(patient) {
    if (patient.indicator) {
      scene.remove(patient.indicator);
      patient.indicator = null;
    }
    if (patient.healthBar) {
      scene.remove(patient.healthBar);
      patient.healthBar = null;
    }
    scene.remove(patient.mesh);
    if (patient.destination) {
      patient.destination.occupied = false;
    }
    var idx = patients.indexOf(patient);
    if (idx !== -1) patients.splice(idx, 1);
    if (hoveredPatient === patient) {
      hoveredPatient = null;
    }
  }

  function updateAnimations(delta) {
    for (var i = animations.length - 1; i >= 0; i--) {
      var anim = animations[i];
      anim.timer -= delta;

      if (anim.type === 'heal') {
        var intensity = Math.max(0, anim.timer / anim.maxTime) * 0.8;
        for (var j = 0; j < anim.patient.mesh.userData.bodyParts.length; j++) {
          anim.patient.mesh.userData.bodyParts[j].material.emissiveIntensity = intensity;
        }
        if (anim.timer <= 0) {
          for (var j = 0; j < anim.patient.mesh.userData.bodyParts.length; j++) {
            var part = anim.patient.mesh.userData.bodyParts[j];
            part.material.emissive.setHex(0x000000);
            part.material.emissiveIntensity = 0;
          }
          anim.patient.animating = false;
          if (anim.patient.indicator) {
            scene.remove(anim.patient.indicator);
            anim.patient.indicator = null;
          }
          animations.splice(i, 1);
        }
      }

      if (anim.type === 'shake') {
        var progress = 1 - (anim.timer / anim.maxTime);
        var offset = Math.sin(progress * Math.PI * 8) * 0.05 * (1 - progress);
        anim.patient.mesh.position.x = anim.originX + offset;

        var redIntensity = Math.max(0, anim.timer / anim.maxTime) * 0.5;
        for (var j = 0; j < anim.patient.mesh.userData.bodyParts.length; j++) {
          anim.patient.mesh.userData.bodyParts[j].material.emissiveIntensity = redIntensity;
        }

        if (anim.timer <= 0) {
          anim.patient.mesh.position.x = anim.originX;
          for (var j = 0; j < anim.patient.mesh.userData.bodyParts.length; j++) {
            var part = anim.patient.mesh.userData.bodyParts[j];
            part.material.emissive.setHex(0x000000);
            part.material.emissiveIntensity = 0;
          }
          anim.patient.animating = false;
          animations.splice(i, 1);
        }
      }
    }
  }

  function updateHealthTimers(delta) {
    for (var i = patients.length - 1; i >= 0; i--) {
      var p = patients[i];
      if (p.treated) {
        // Recovery: 3 HP/sec
        p.hp += HP_RECOVERY_RATE * delta;
        if (p.hp >= MAX_HP) {
          p.hp = MAX_HP;
          updateHealthBarTexture(p);
          Game.Inventory.showNotification('Пациент выписан! Направлен на оплату.', 'rgba(34, 139, 34, 0.85)');
          dischargePatient(p);
          continue;
        }
        updateHealthBarTexture(p);
      } else {
        // Decay: -1 HP every 3 sec
        p.hpDecayTimer += delta;
        while (p.hpDecayTimer >= HP_DECAY_INTERVAL) {
          p.hpDecayTimer -= HP_DECAY_INTERVAL;
          p.hp -= 1;
          if (p.hp <= 0) {
            p.hp = 0;
            updateHealthBarTexture(p);
            Game.Inventory.showNotification('Пациент ушел, не дождавшись помощи');
            removePatient(p);
            break;
          }
          updateHealthBarTexture(p);
        }
      }
    }
  }

  function updatePatients(delta) {
    for (var i = patients.length - 1; i >= 0; i--) {
      var p = patients[i];
      var isMoving = false;
      var speed = getPatientSpeed(p) * delta;

      if (p.state === 'queued' && p.queueTarget) {
        var qDx = p.queueTarget.x - p.mesh.position.x;
        var qDz = p.queueTarget.z - p.mesh.position.z;
        isMoving = (qDx * qDx + qDz * qDz) > 0.01;
        moveToward(p.mesh.position, p.queueTarget, speed);
        p.mesh.rotation.y = Math.PI;
      }
      if (p.state === 'walking' && p.targetPos) {
        var arrived = moveToward(p.mesh.position, p.targetPos, speed);
        var dir = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
        isMoving = !arrived;
        if (arrived) {
          var isBed = p.destination && beds.indexOf(p.destination) !== -1;
          p.state = isBed ? 'atBed' : 'waiting';
          p.targetPos = null;
          p.anim.targetPose = isBed ? 'lying' : 'sitting';
          if (p.state === 'atBed') {
            createBedIndicator(p);
          }
        }
      }
      // Discharged: walking to cashier
      if (p.state === 'discharged' && p.targetPos) {
        var dir2 = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir2.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir2.x, dir2.z);
        }
        moveToward(p.mesh.position, p.targetPos, speed);
        isMoving = true;
      }
      // Leaving: walk to exit then beyond
      if (p.state === 'leaving' && p.targetPos) {
        var dir3 = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir3.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir3.x, dir3.z);
        }
        var arrived3 = moveToward(p.mesh.position, p.targetPos, speed);
        isMoving = true;
        if (arrived3) {
          if (p.leavePhase === 'toExit') {
            p.leavePhase = 'toStreet';
            p.targetPos = new THREE.Vector3(0, 0, 25);
          }
        }
        // Fade out when far enough
        if (p.mesh.position.z > 18) {
          if (!p.fadeTimer) p.fadeTimer = 0;
          p.fadeTimer += delta;
          var opacity = Math.max(0, 1 - p.fadeTimer / 0.8);
          p.mesh.traverse(function(child) {
            if (child.isMesh && child.material) {
              if (!child.material.transparent) {
                child.material = child.material.clone();
                child.material.transparent = true;
              }
              child.material.opacity = opacity;
            }
          });
          if (opacity <= 0) {
            removePatient(p);
          }
        }
      }

      // Animation updates
      updateWalkAnimation(p, delta, isMoving);
      updatePoseTransition(p, delta);
    }
  }

  function revealDiagnosis(patient) {
    patient.needsDiagnosis = false;
    patient.symptom = null;
    patient.diagnosis = patient.hiddenDiagnosis;
    patient.requiredConsumable = patient.hiddenConsumable;
    patient.requiredInstrument = null;
    // Update bed indicator to show consumable instead of instrument
    if (patient.indicator) {
      scene.remove(patient.indicator);
      patient.indicator = null;
    }
    if (patient.state === 'atBed') {
      createBedIndicator(patient);
    }
    Game.Inventory.showNotification('Диагноз установлен!', 'rgba(34, 139, 34, 0.85)');
  }

  // Animated reveal: open popup showing ???? then animate to real data
  function revealDiagnosisAnimated(patient) {
    // First show popup with ???? (needsDiagnosis still true visually)
    var savedState = patient.state;
    // Temporarily keep needsDiagnosis true for popup display
    openPopup(patient);

    // Hide action buttons during reveal animation
    btnBed.style.display = 'none';
    btnWait.style.display = 'none';
    btnDismiss.style.display = 'none';

    var popupInstrumentHint = document.getElementById('popup-instrument-hint');

    // Elements to animate: diagnosis, supply
    var fields = [
      { el: popupDiagnosis, newText: patient.hiddenDiagnosis },
      { el: popupSupply, newText: Game.Consumables.TYPES[patient.hiddenConsumable].name }
    ];

    // Phase 1 (after 0.4s): fade out ????
    setTimeout(function() {
      for (var i = 0; i < fields.length; i++) {
        if (fields[i].el) {
          fields[i].el.style.transition = 'opacity 0.4s';
          fields[i].el.style.opacity = '0';
        }
      }
      if (popupInstrumentHint) {
        popupInstrumentHint.style.transition = 'opacity 0.4s';
        popupInstrumentHint.style.opacity = '0';
      }
    }, 400);

    // Phase 2 (after 0.9s): swap text, set color, fade in
    setTimeout(function() {
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (f.el) {
          f.el.textContent = f.newText;
          f.el.style.color = '#44ff88';
        }
      }
      // Show supply icon
      var typeInfo = Game.Consumables.TYPES[patient.hiddenConsumable];
      var c = typeInfo.color;
      popupSupplyIcon.style.display = '';
      popupSupplyIcon.style.backgroundColor = 'rgb(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ')';

      if (popupInstrumentHint) popupInstrumentHint.style.display = 'none';

      for (var i = 0; i < fields.length; i++) {
        if (fields[i].el) {
          fields[i].el.style.opacity = '1';
        }
      }
    }, 900);

    // Phase 3 (after 2s): apply real data, show close button
    setTimeout(function() {
      // Temporarily restore state so revealDiagnosis can create the bed indicator
      patient.state = savedState;
      revealDiagnosis(patient);
      patient.state = 'interacting';

      // Reset color transitions
      for (var i = 0; i < fields.length; i++) {
        if (fields[i].el) {
          fields[i].el.style.transition = '';
          fields[i].el.style.color = '';
        }
      }

      // Show "Понятно" button
      var buttonsDiv = popupEl.querySelector('.buttons');
      btnBed.style.display = 'none';
      btnWait.style.display = 'none';
      btnDismiss.style.display = 'none';

      var okBtn = document.createElement('button');
      okBtn.textContent = 'Понятно';
      okBtn.style.cssText = 'flex:1; padding:10px 0; border:none; border-radius:6px; font-size:0.88rem; font-weight:600; cursor:pointer; background:#1a6b42; color:#fff;';
      buttonsDiv.appendChild(okBtn);

      okBtn.addEventListener('click', function() {
        buttonsDiv.removeChild(okBtn);
        closePopup();
        patient.state = savedState;
      });
    }, 2000);
  }

  window.Game.Patients = {
    hasInteraction: function() { return !!hoveredPatient || !!popupPatient; },
    isPopupOpen: function() { return !!popupPatient; },
    getHoveredPatient: function() { return hoveredPatient; },
    revealDiagnosis: function(patient) { revealDiagnosis(patient); },
    revealDiagnosisAnimated: function(patient) { revealDiagnosisAnimated(patient); },

    setup: function(_THREE, _scene, _camera, _controls, _beds, _waitingChairs) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;
      beds = _beds;
      waitingChairs = _waitingChairs;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);

      // Cache UI elements
      hintEl = document.getElementById('interact-hint');
      popupEl = document.getElementById('patient-popup');
      popupName = document.getElementById('popup-name');
      popupDiagnosis = document.getElementById('popup-diagnosis');
      popupSupply = document.getElementById('popup-supply');
      popupSupplyIcon = document.getElementById('popup-supply-icon');
      popupSeverity = document.getElementById('popup-severity');
      popupAge = document.getElementById('popup-age');
      popupComplaint = document.getElementById('popup-complaint');
      popupTemp = document.getElementById('popup-temp');
      popupPulse = document.getElementById('popup-pulse');
      popupBp = document.getElementById('popup-bp');
      popupSeverityBand = document.getElementById('popup-severity-band');
      popupHpFill = document.getElementById('popup-hp-fill');
      popupHpText = document.getElementById('popup-hp-text');
      btnBed = document.getElementById('btn-bed');
      btnWait = document.getElementById('btn-wait');
      btnDismiss = document.getElementById('btn-dismiss');
      bedCount = document.getElementById('bed-count');
      chairCount = document.getElementById('chair-count');

      // Click to interact
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (popupPatient) return;
        if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
        if (!hoveredPatient) return;

        if (hoveredPatient.state === 'atBed') {
          if (hoveredPatient.treated) return;

          // Undiagnosed patient — need instrument first
          if (hoveredPatient.needsDiagnosis) {
            var activeType = Game.Inventory.getActive();
            if (!activeType || !Game.Consumables.isInstrument(activeType)) {
              Game.Inventory.showNotification('Нужен диагностический инструмент');
              return;
            }
            if (activeType !== hoveredPatient.requiredInstrument) {
              Game.Inventory.showNotification('Нужен другой инструмент');
              return;
            }
            // Start mini-game (instrument NOT consumed)
            Game.Diagnostics.startMinigame(hoveredPatient, activeType);
            return;
          }

          var activeType = Game.Inventory.getActive();
          if (!activeType || Game.Consumables.isInstrument(activeType)) {
            Game.Inventory.showNotification('Выберите препарат в инвентаре');
            return;
          }
          if (activeType === hoveredPatient.requiredConsumable) {
            treatPatient(hoveredPatient);
          } else {
            wrongTreatment(hoveredPatient);
          }
          return;
        }

        if (hoveredPatient.state === 'waiting') {
          openPopup(hoveredPatient);
          return;
        }

        openPopup(hoveredPatient);
      });

      // Popup buttons
      btnBed.addEventListener('click', function() {
        if (!popupPatient) return;
        var slot = null;
        for (var i = 0; i < beds.length; i++) {
          if (!beds[i].occupied) { slot = beds[i]; break; }
        }
        if (!slot) return;
        sendPatient(popupPatient, slot.pos, slot);
      });

      btnWait.addEventListener('click', function() {
        if (!popupPatient) return;
        var slot = null;
        for (var i = 0; i < waitingChairs.length; i++) {
          if (!waitingChairs[i].occupied) { slot = waitingChairs[i]; break; }
        }
        if (!slot) return;
        sendPatient(popupPatient, slot.pos, slot);
      });

      btnDismiss.addEventListener('click', function() {
        if (!popupPatient) return;
        var patient = popupPatient;
        // Return patient to previous state
        if (patient._wasWaiting) {
          patient.state = 'waiting';
        } else {
          patient.state = 'queued';
        }
        patient._wasWaiting = false;
        closePopup();
      });

      // Spawn first patient immediately
      spawnPatient(true);
    },

    update: function(delta) {
      // Spawn patients
      spawnTimer += delta;
      if (spawnTimer >= SPAWN_INTERVAL) {
        spawnTimer = 0;
        if (queue.length >= 2) {
          Game.Inventory.showNotification('Пациент не смог зайти из-за того, что очередь переполнена');
        } else {
          spawnPatient();
        }
      }

      updatePatients(delta);
      updateHealthTimers(delta);
      updateAnimations(delta);
      updateHealParticles(delta);
      updateIndicators();
      updateInteraction();
    }
  };
})();
