(function() {
  window.Game = window.Game || {};

  // --- Patient data pools ---
  var NAMES = Game.Lang.t('patients.names.male').concat(Game.Lang.t('patients.names.female'));
  var SURNAMES = Game.Lang.t('patients.surnames.male').concat(Game.Lang.t('patients.surnames.female'));
  // MEDICAL_DATA: complaints are designed to hint at the diagnostic instrument needed
  // painkiller -> instrument_hammer, antihistamine -> instrument_rhinoscope, strepsils -> instrument_stethoscope
  var MEDICAL_DATA = {
    painkiller: { cases: Game.Lang.t('patients.medical.painkiller') },
    antihistamine: { cases: Game.Lang.t('patients.medical.antihistamine') },
    strepsils: { cases: Game.Lang.t('patients.medical.strepsils') }
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
    severe: 1.0, medium: 1.0, mild: 1.0, normal: 1.0
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

  // --- Illness visual region mapping ---
  var ILLNESS_REGION_MAP = Game.Lang.t('patients.illnessRegionMap');

  function getIllnessRegion(consumableType, diagnosis) {
    if (consumableType === 'antihistamine') return 'nose';
    var map = ILLNESS_REGION_MAP[consumableType];
    if (map && diagnosis && map[diagnosis]) return map[diagnosis];
    // fallback
    if (consumableType === 'painkiller') return 'back';
    if (consumableType === 'strepsils') return 'throat';
    return 'fullBody';
  }

  function getIllnessSeverityScale(patient) {
    var k = patient.severity.key;
    if (k === 'severe') return 1.0;
    if (k === 'medium') return 0.6;
    return 0.3;
  }

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
    { key: 'severe', label: Game.Lang.t('severity.severe'), startHp: 29 },
    { key: 'medium', label: Game.Lang.t('severity.medium'), startHp: 50 },
    { key: 'mild',   label: Game.Lang.t('severity.mild'),  startHp: 80 }
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
  var PATIENT_SPEED = 3.5;
  var sequentialSpawnTimer = 0;
  var sequentialSpawnActive = false; // true after first patient is fully paid
  var firstPatientPaid = false; // tracks if the very first patient has been paid
  var animations = [];

  // Wave spawn system — scripted waves with guaranteed severity diversity
  var WAVE_SPAWN_DELAY = 1.5; // seconds between patients within a wave

  // composition: [mild_count, medium_count, severe_count]
  var WAVE_CONFIG = {
    2: {
      waves: [
        { time: 0,   composition: [2, 2, 0] },
        { time: 55,  composition: [1, 2, 0] },
        { time: 120, composition: [2, 2, 0] },
        { time: 200, composition: [1, 2, 0] }
      ]
    },
    3: {
      waves: [
        { time: 0,   composition: [1, 2, 1] },
        { time: 45,  composition: [1, 1, 1] },
        { time: 100, composition: [2, 1, 1] },
        { time: 160, composition: [1, 2, 1] },
        { time: 230, composition: [1, 1, 1] }
      ]
    },
    4: {
      waves: [
        { time: 0,   composition: [1, 2, 1] },
        { time: 35,  composition: [1, 1, 2] },
        { time: 80,  composition: [2, 1, 0] },
        { time: 130, composition: [1, 2, 1] },
        { time: 185, composition: [1, 1, 2] },
        { time: 245, composition: [1, 1, 1] }
      ]
    }
  };

  // Wave state
  var currentWaveIndex = 0;
  var waveSpawnQueue = [];   // array of severity keys to spawn, severe first
  var waveSpawnTimer = 0;
  var waveStarted = false;   // whether wave system has been initialized
  var lastWaveSize = 0;      // how many patients were in the previous wave
  var currentSpawnWaveNumber = 0; // wave number assigned to patients being spawned

  // Shared wave queue timer
  var QUEUE_PATIENCE = 60.0;
  var waveQueueTimer = 0;
  var waveQueueTimerActive = false;
  var activeWaveNumber = -1; // which wave the timer is for

  // Wave banner DOM elements (cached in setup)
  var waveBannerEl, waveTextEl, waveTimerFillEl, waveTimerTextEl;

  // --- UI elements ---
  var hintEl, popupEl, popupName, popupDiagnosis, popupSupply, popupSupplyIcon, popupSeverity;
  var popupAge, popupComplaint, popupTemp, popupPulse, popupBp;
  var popupSeverityBand, popupHpFill, popupHpText;
  var btnBed, btnWait, btnDismiss, bedCount, chairCount;

  // --- Interaction raycaster ---
  var interactRay;
  var screenCenter;

  function getQueuePosition(index) {
    return new THREE.Vector3(-2 + index * 1.2, 0, -7.5);
  }

  function createPatientMesh() {
    var group = new THREE.Group();
    var bodyColor = BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];
    var bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    var skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
    var legMat = new THREE.MeshLambertMaterial({ color: 0x334455 });

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

  // --- Illness visual effects ---
  function addIllnessMesh(patient, mesh, parent) {
    parent.add(mesh);
    patient.mesh.userData.illnessVisuals.push({ mesh: mesh, parent: parent });
  }

  function tintMaterial(patient, targetMesh, tintColor, factor) {
    var origColor = targetMesh.material.color.getHex();
    targetMesh.material.color.lerp(new THREE.Color(tintColor), factor);
    patient.mesh.userData.illnessMaterials.push({ mesh: targetMesh, originalColor: origColor });
  }

  function applyIllnessVisuals(patient) {
    var ud = patient.mesh.userData;
    ud.illnessVisuals = [];
    ud.illnessMaterials = [];

    var cType = patient.hiddenConsumable || patient.requiredConsumable;
    var diag = patient.hiddenDiagnosis || patient.diagnosis;
    if (!cType) return;

    var region = getIllnessRegion(cType, diag);
    var sev = getIllnessSeverityScale(patient);
    var whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });

    // Helper: scale a body part and register for reset
    function swell(mesh, factor) {
      mesh.scale.set(factor, factor, factor);
      ud.illnessVisuals.push({ mesh: mesh, parent: null, resetScale: true });
    }

    if (cType === 'antihistamine') {
      // ===== ALLERGY: red swollen head + red skin everywhere =====
      tintMaterial(patient, ud.headMesh, 0xff0000, 0.5 + 0.35 * sev);
      // Swollen head
      var headSwell = 1.1 + 0.2 * sev;
      swell(ud.headMesh, headSwell);
      // All skin turns reddish (allergic reaction)
      tintMaterial(patient, ud.leftArm.upperArm, 0xff3333, 0.3 + 0.3 * sev);
      tintMaterial(patient, ud.leftArm.forearm, 0xff3333, 0.3 + 0.3 * sev);
      tintMaterial(patient, ud.rightArm.upperArm, 0xff3333, 0.3 + 0.3 * sev);
      tintMaterial(patient, ud.rightArm.forearm, 0xff3333, 0.3 + 0.3 * sev);

    } else if (cType === 'painkiller') {
      // ===== PAIN: affected zone turns red + swells =====

      if (region === 'head') {
        // Red swollen head (migraine, headache)
        tintMaterial(patient, ud.headMesh, 0xff2222, 0.4 + 0.35 * sev);
        swell(ud.headMesh, 1.15 + 0.2 * sev);

      } else if (region === 'back') {
        // Red torso (back pain)
        tintMaterial(patient, ud.bodyMesh, 0xff3333, 0.3 + 0.3 * sev);

      } else if (region === 'leg') {
        // Swollen red legs
        var leftLeg = ud.leftLegPivot.children[0];
        var rightLeg = ud.rightLegPivot.children[0];
        var legSwell = 1.2 + 0.5 * sev;
        swell(leftLeg, legSwell);
        tintMaterial(patient, leftLeg, 0xcc3333, 0.3 + 0.25 * sev);
        tintMaterial(patient, rightLeg, 0xcc3333, 0.15 + 0.15 * sev);

      } else if (region === 'arm') {
        // Swollen arm + bandage
        var forearm = ud.rightArm.forearm;
        var upperArm = ud.rightArm.upperArm;
        swell(forearm, 1.3 + 0.4 * sev);
        swell(upperArm, 1.15 + 0.25 * sev);
        tintMaterial(patient, forearm, 0xcc3333, 0.3 + 0.25 * sev);
        tintMaterial(patient, upperArm, 0xcc3333, 0.2 + 0.2 * sev);
        // White bandage wrap on forearm
        var bandage = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), whiteMat);
        bandage.position.set(0, -0.06, 0);
        bandage.castShadow = true;
        addIllnessMesh(patient, bandage, forearm);

      } else if (region === 'neck') {
        // White neck brace (collar)
        var brace = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 8), whiteMat);
        brace.position.set(0, 1.22, 0);
        brace.castShadow = true;
        addIllnessMesh(patient, brace, ud.bodyContainer);

      } else if (region === 'stomach') {
        // Green nauseous body + face
        tintMaterial(patient, ud.bodyMesh, 0x66cc33, 0.3 + 0.3 * sev);
        tintMaterial(patient, ud.headMesh, 0x88cc44, 0.2 + 0.25 * sev);

      } else if (region === 'teeth') {
        // Swollen head (one-sided cheek effect via scale + red)
        tintMaterial(patient, ud.headMesh, 0xff4444, 0.3 + 0.25 * sev);
        ud.headMesh.scale.set(1.15 + 0.15 * sev, 1, 1.1 + 0.1 * sev);
        ud.illnessVisuals.push({ mesh: ud.headMesh, parent: null, resetScale: true });

      } else if (region === 'chest') {
        // Red chest area
        tintMaterial(patient, ud.bodyMesh, 0xff2222, 0.3 + 0.3 * sev);

      } else if (region === 'fullBody') {
        // Everything red-ish and slightly swollen
        tintMaterial(patient, ud.bodyMesh, 0xff4444, 0.25 + 0.25 * sev);
        tintMaterial(patient, ud.headMesh, 0xff4444, 0.2 + 0.2 * sev);
        tintMaterial(patient, ud.leftArm.upperArm, 0xff4444, 0.2 + 0.2 * sev);
        tintMaterial(patient, ud.rightArm.upperArm, 0xff4444, 0.2 + 0.2 * sev);
        var leftLeg2 = ud.leftLegPivot.children[0];
        var rightLeg2 = ud.rightLegPivot.children[0];
        tintMaterial(patient, leftLeg2, 0xff4444, 0.15 + 0.15 * sev);
        tintMaterial(patient, rightLeg2, 0xff4444, 0.15 + 0.15 * sev);
      }

    } else if (cType === 'strepsils') {
      // ===== THROAT/RESPIRATORY: swollen red neck + red torso =====
      var applyThroat = (region === 'throat' || region === 'both');
      var applyChest = (region === 'chest' || region === 'both');
      var im = region === 'both' ? 0.7 : 1.0;

      if (applyThroat) {
        // Swollen red neck cylinder
        var neckR = 0.1 + 0.05 * sev * im;
        var neckMat = new THREE.MeshLambertMaterial({ color: 0xcc4444 });
        var swollenNeck = new THREE.Mesh(new THREE.CylinderGeometry(neckR, 0.08, 0.12, 8), neckMat);
        swollenNeck.position.set(0, 1.22, 0);
        swollenNeck.castShadow = true;
        addIllnessMesh(patient, swollenNeck, ud.bodyContainer);
        // Red face
        tintMaterial(patient, ud.headMesh, 0xff3333, (0.25 + 0.3 * sev) * im);
      }

      if (applyChest) {
        // Red torso (inflamed chest)
        tintMaterial(patient, ud.bodyMesh, 0xcc2222, (0.3 + 0.3 * sev) * im);
        // Slightly swollen torso
        var chestSwell = 1 + 0.15 * sev * im;
        ud.bodyMesh.scale.set(chestSwell, 1, chestSwell);
        ud.illnessVisuals.push({ mesh: ud.bodyMesh, parent: null, resetScale: true });
      }
    }
  }

  function removeIllnessVisuals(patient) {
    var ud = patient.mesh.userData;
    if (ud.illnessVisuals) {
      for (var i = 0; i < ud.illnessVisuals.length; i++) {
        var entry = ud.illnessVisuals[i];
        if (entry.resetScale) {
          entry.mesh.scale.set(1, 1, 1);
        } else if (entry.parent) {
          entry.parent.remove(entry.mesh);
          if (entry.mesh.geometry) entry.mesh.geometry.dispose();
          if (entry.mesh.material) entry.mesh.material.dispose();
        }
      }
      ud.illnessVisuals = [];
    }
    if (ud.illnessMaterials) {
      for (var j = 0; j < ud.illnessMaterials.length; j++) {
        var m = ud.illnessMaterials[j];
        m.mesh.material.color.setHex(m.originalColor);
      }
      ud.illnessMaterials = [];
    }
  }

  function spawnPatient(instant, explicitSeverityKey) {
    var mesh = createPatientMesh();
    mesh.position.set(0, 0, 1);
    scene.add(mesh);

    var consumableType = randomFrom(CONSUMABLE_KEYS);
    var data = MEDICAL_DATA[consumableType];
    var medCase = randomFrom(data.cases);
    var currentLevel = Game.Levels ? Game.Levels.getLevel() : 1;
    var severity;
    if (explicitSeverityKey) {
      // Wave system provides explicit severity
      for (var si = 0; si < SEVERITIES.length; si++) {
        if (SEVERITIES[si].key === explicitSeverityKey) { severity = SEVERITIES[si]; break; }
      }
      if (!severity) severity = SEVERITIES[2]; // fallback to mild
    } else if (currentLevel === 1) {
      severity = SEVERITIES[2]; // mild only
    } else if (currentLevel === 2) {
      // mild + medium
      var roll = Math.random();
      severity = roll < 0.65 ? SEVERITIES[2] : SEVERITIES[1];
    } else {
      // level 3+: mild + medium + severe
      var roll = Math.random();
      severity = roll < 0.60 ? SEVERITIES[2] : roll < 0.85 ? SEVERITIES[1] : SEVERITIES[0];
    }
    var diagChance = Game.Levels && Game.Levels.getDiagnosisChance ? Game.Levels.getDiagnosisChance() : 0.2;
    var needsDiagnosis = (currentLevel >= 2) ? (Math.random() < diagChance) : false;

    // Build multi-consumable list based on severity
    var requiredConsumables;
    if (severity.key === 'mild') {
      requiredConsumables = [consumableType];
    } else if (severity.key === 'medium') {
      var others = CONSUMABLE_KEYS.filter(function(k) { return k !== consumableType; });
      requiredConsumables = [consumableType, randomFrom(others)];
    } else {
      // severe: all three
      requiredConsumables = CONSUMABLE_KEYS.slice();
    }

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
      requiredConsumables: needsDiagnosis ? null : requiredConsumables,
      pendingConsumables: needsDiagnosis ? null : requiredConsumables.slice(),
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
      indicators: [],
      animating: false,
      hp: severity.startHp,
      maxHp: MAX_HP,
      severity: severity,
      treated: false,
      wasDiagnosed: false,
      hpDecayTimer: 0,
      healthBar: null,
      lastDrawnHp: -1,
      particleTimer: 0,
      waveNumber: currentSpawnWaveNumber,
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
    applyIllnessVisuals(patient);

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
    Game.Outline.setHover([patient.mesh]);
  }

  function unhighlightPatient(patient) {
    Game.Outline.clearHover();
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
      if (hoveredPatient) { unhighlightPatient(hoveredPatient); hoveredPatient = null; }
      return;
    }
    if (Game.Diagnostics && Game.Diagnostics.isActive()) {
      if (hoveredPatient) { unhighlightPatient(hoveredPatient); hoveredPatient = null; }
      return;
    }
    if (!Game.Interaction.isActive('patients')) {
      if (hoveredPatient) { unhighlightPatient(hoveredPatient); hoveredPatient = null; }
      return;
    }

    var hits = Game.Interaction.getHits('patients');
    var newHovered = null;

    if (hits) {
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
        hintEl.textContent = Game.Lang.t('patient.hint.treating');
      } else if (hoveredPatient.needsDiagnosis) {
        hintEl.textContent = Game.Lang.t('patient.hint.diagnose');
      } else {
        var pendingNames = [];
        var hasAny = false;
        if (hoveredPatient.pendingConsumables) {
          for (var pi = 0; pi < hoveredPatient.pendingConsumables.length; pi++) {
            pendingNames.push(Game.Consumables.TYPES[hoveredPatient.pendingConsumables[pi]].name);
            if (Game.Inventory.countType(hoveredPatient.pendingConsumables[pi]) > 0) hasAny = true;
          }
        }
        if (hasAny) {
          hintEl.textContent = Game.Lang.t('patient.hint.treat');
        } else {
          hintEl.textContent = pendingNames.length > 1
            ? Game.Lang.t('patient.hint.needMedicines', [pendingNames.join(', ')])
            : Game.Lang.t('patient.hint.needMedicine', [pendingNames[0]]);
        }
      }
      hintEl.style.display = 'block';
    } else if (hoveredPatient.state === 'waiting') {
      hintEl.textContent = Game.Lang.t('patient.hint.toBed');
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = Game.Lang.t('patient.hint.interact');
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
    popupAge.textContent = Game.Lang.t('patient.age', [patient.age]);

    // Severity
    var sevColors = { severe: '#ff4444', medium: '#ffcc00', mild: '#44cc44' };
    popupSeverity.textContent = patient.severity.label;
    popupSeverity.style.color = sevColors[patient.severity.key] || '#7abfff';
    popupSeverityBand.className = patient.severity.key;

    // Vitals
    var v = patient.vitals;
    popupTemp.textContent = v.temp.toFixed(1) + '\u00B0C';
    popupTemp.className = 'vital-value' + (v.temp >= 39.0 ? ' vital-critical' : v.temp >= 37.5 ? ' vital-warning' : '');
    popupPulse.textContent = Game.Lang.t('patient.pulse', [v.pulse]);
    popupPulse.className = 'vital-value' + (v.pulse >= 110 ? ' vital-critical' : v.pulse >= 90 ? ' vital-warning' : '');
    popupBp.textContent = v.bpSys + '/' + v.bpDia;
    popupBp.className = 'vital-value' + (v.bpSys >= 160 ? ' vital-critical' : v.bpSys >= 140 ? ' vital-warning' : '');

    // HP bar
    var hpRatio = Math.max(0, patient.hp / patient.maxHp);
    var popupSeg = getHealthSegments(hpRatio);
    popupHpText.textContent = '';
    popupHpFill.style.width = (popupSeg.count * 20) + '%';
    var segColor = 'rgb(' + popupSeg.r + ',' + popupSeg.g + ',' + popupSeg.b + ')';
    popupHpFill.style.background = segColor;
    popupHpText.style.color = segColor;

    // Clinical data
    popupComplaint.textContent = '\u00AB' + patient.complaint + '\u00BB';

    var popupInstrumentHint = document.getElementById('popup-instrument-hint');

    if (patient.needsDiagnosis) {
      popupDiagnosis.textContent = '????';
      popupDiagnosis.style.color = '#ff4444';
      popupSupply.textContent = '????';
      popupSupply.style.color = '#ff4444';
      popupSupplyIcon.style.display = 'none';

      // Show diagnosis prompt
      if (popupInstrumentHint) {
        popupInstrumentHint.textContent = Game.Lang.t('patient.needDiagnosis');
        popupInstrumentHint.style.display = 'block';
        popupInstrumentHint.style.color = '#ffaa44';
      }
    } else {
      popupDiagnosis.textContent = patient.diagnosis;
      popupDiagnosis.style.color = '';
      popupSupply.style.color = '';
      popupSupplyIcon.style.display = '';
      if (popupInstrumentHint) popupInstrumentHint.style.display = 'none';

      // Required consumables (show all, mark applied ones)
      if (patient.requiredConsumables && patient.requiredConsumables.length > 1) {
        var parts = [];
        for (var ci = 0; ci < patient.requiredConsumables.length; ci++) {
          var cKey = patient.requiredConsumables[ci];
          var cInfo = Game.Consumables.TYPES[cKey];
          var applied = !patient.pendingConsumables || patient.pendingConsumables.indexOf(cKey) === -1;
          parts.push(applied ? '\u2713 ' + cInfo.name : cInfo.name);
        }
        popupSupply.textContent = parts.join(', ');
        var c = Game.Consumables.TYPES[patient.requiredConsumable].color;
        popupSupplyIcon.style.backgroundColor = 'rgb(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ')';
      } else {
        var typeInfo = Game.Consumables.TYPES[patient.requiredConsumable];
        popupSupply.textContent = typeInfo.name;
        var c = typeInfo.color;
        popupSupplyIcon.style.backgroundColor = 'rgb(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ')';
      }
    }

    popupEl.style.display = 'block';

    // Reset button visibility (may have been hidden by diagnosis reveal)
    btnBed.style.display = '';
    btnDismiss.style.display = '';

    // Bed/chair availability (use dynamic furniture system)
    var indoorBeds = Game.Furniture.getIndoorBeds();
    var indoorChairs = Game.Furniture.getIndoorChairs();
    var freeBeds = indoorBeds.filter(function(b) { return !b.occupied && !Game.Furniture.isBedBroken(b); }).length;
    var freeChairs = indoorChairs.filter(function(c) { return !c.occupied; }).length;
    var outdoorBedCount = Game.Furniture.getOutdoorBedCount();
    var outdoorChairCount = Game.Furniture.getOutdoorChairCount();

    btnBed.disabled = freeBeds === 0;
    btnBed.style.opacity = freeBeds > 0 ? '1' : '0.4';
    bedCount.textContent = '(' + freeBeds + '/' + indoorBeds.length + ')';

    // Hide waiting button if patient is already waiting, show otherwise
    if (wasWaiting) {
      btnWait.style.display = 'none';
    } else {
      btnWait.style.display = '';
      btnWait.disabled = freeChairs === 0;
      btnWait.style.opacity = freeChairs > 0 ? '1' : '0.4';
      chairCount.textContent = '(' + freeChairs + '/' + indoorChairs.length + ')';
    }

    // Outdoor furniture warning
    var outdoorWarning = document.getElementById('outdoor-warning');
    if (outdoorBedCount > 0 || outdoorChairCount > 0) {
      outdoorWarning.textContent = Game.Lang.t('patient.outdoorWarning');
      outdoorWarning.style.display = 'block';
    } else {
      outdoorWarning.style.display = 'none';
    }

    // Broken bed warning
    var brokenWarning = document.getElementById('broken-bed-warning');
    var brokenBedCount = Game.Furniture.getBrokenBedCount();
    if (brokenBedCount > 0) {
      brokenWarning.textContent = Game.Lang.t(brokenBedCount === 1 ? 'patient.brokenWarning1' : 'patient.brokenWarningN', [brokenBedCount]);
      brokenWarning.style.display = 'block';
    } else {
      brokenWarning.style.display = 'none';
    }

    // Show wait/dismiss button
    btnDismiss.style.display = '';

    controls.unlock();
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('popup_opened');
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

  function createSingleIndicatorSprite(itemType) {
    var canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    var ctx = canvas.getContext('2d');

    var bgColor;
    if (Game.Consumables.isInstrument && Game.Consumables.isInstrument(itemType)) {
      var instrInfo = Game.Consumables.INSTRUMENT_TYPES[itemType];
      bgColor = instrInfo.color;
    } else {
      var typeInfo = Game.Consumables.TYPES[itemType];
      bgColor = typeInfo.color;
    }

    var r = (bgColor >> 16) & 255, g = (bgColor >> 8) & 255, b = bgColor & 255;

    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + Math.floor(r * 0.3) + ',' + Math.floor(g * 0.3) + ',' + Math.floor(b * 0.3) + ',0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.lineWidth = 3;
    ctx.stroke();

    drawIndicatorIcon(ctx, itemType);

    var texture = new THREE.CanvasTexture(canvas);
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.4, 0.4, 1);
    sprite.userData = { consumableType: itemType };
    return sprite;
  }

  function createBedIndicators(patient) {
    removeAllIndicators(patient);

    if (patient.needsDiagnosis) {
      // Show single instrument indicator before diagnosis
      var sprite = createSingleIndicatorSprite(patient.requiredInstrument);
      sprite.position.copy(patient.mesh.position);
      sprite.position.y = 2.0;
      scene.add(sprite);
      patient.indicators.push(sprite);
      return;
    }

    if (!patient.pendingConsumables) return;
    var count = patient.pendingConsumables.length;
    for (var i = 0; i < count; i++) {
      var type = patient.pendingConsumables[i];
      var sprite = createSingleIndicatorSprite(type);
      var offsetX = (i - (count - 1) / 2) * 0.45;
      sprite.position.copy(patient.mesh.position);
      sprite.position.x += offsetX;
      sprite.position.y = 2.0;
      scene.add(sprite);
      patient.indicators.push(sprite);
    }
  }

  function removeAllIndicators(patient) {
    if (!patient.indicators) return;
    for (var i = 0; i < patient.indicators.length; i++) {
      scene.remove(patient.indicators[i]);
      if (patient.indicators[i].material.map) patient.indicators[i].material.map.dispose();
      patient.indicators[i].material.dispose();
    }
    patient.indicators = [];
  }

  function removeOneIndicator(patient, consumableType) {
    if (!patient.indicators) return;
    for (var i = 0; i < patient.indicators.length; i++) {
      if (patient.indicators[i].userData.consumableType === consumableType) {
        scene.remove(patient.indicators[i]);
        if (patient.indicators[i].material.map) patient.indicators[i].material.map.dispose();
        patient.indicators[i].material.dispose();
        patient.indicators.splice(i, 1);
        break;
      }
    }
  }

  // --- Health bar ---
  function getHealthSegments(ratio) {
    var pct = ratio * 100;
    if (pct >= 99) return { count: 5, r: 0,   g: 232, b: 0   }; // bright green
    if (pct >= 60) return { count: 4, r: 50,  g: 205, b: 50  }; // green
    if (pct >= 30) return { count: 3, r: 240, g: 200, b: 0   }; // yellow
    if (pct >= 15) return { count: 2, r: 220, g: 40,  b: 40  }; // red
    return                { count: 1, r: 128, g: 0,   b: 32  }; // burgundy
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

    // Draw 5 segments with gaps
    var seg = getHealthSegments(ratio);
    var segW = 24;   // width of each segment
    var gap = 1;     // gap between segments
    var startX = 2;  // left offset
    for (var i = 0; i < 5; i++) {
      var sx = startX + i * (segW + gap);
      if (i < seg.count) {
        ctx.fillStyle = 'rgb(' + seg.r + ',' + seg.g + ',' + seg.b + ')';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      }
      ctx.beginPath();
      ctx.roundRect(sx, 2, segW, 12, 2);
      ctx.fill();
    }

    patient.healthBarTexture.needsUpdate = true;
  }

  // --- Healing particles ---
  var healParticles = [];
  var PARTICLE_SPAWN_INTERVAL = 0.15;
  var PARTICLE_LIFETIME = 1.2;
  var PARTICLE_SPEED = 0.6;
  var PARTICLE_POOL_SIZE = 30;

  var healParticleTexture = null;
  var particlePool = [];
  var activeParticleCount = 0;

  function initParticlePool() {
    if (!healParticleTexture) {
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#00ff88';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(12, 4, 8, 24);
      ctx.fillRect(4, 12, 24, 8);
      var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(100, 255, 160, 0.3)');
      grad.addColorStop(1, 'rgba(100, 255, 160, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      healParticleTexture = new THREE.CanvasTexture(c);
    }
    for (var i = 0; i < PARTICLE_POOL_SIZE; i++) {
      var mat = new THREE.SpriteMaterial({ map: healParticleTexture, transparent: true, depthTest: false });
      var sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.12, 0.12, 1);
      sprite.visible = false;
      scene.add(sprite);
      particlePool.push({
        sprite: sprite,
        life: 0,
        maxLife: PARTICLE_LIFETIME,
        vx: 0, vy: 0, vz: 0
      });
    }
  }

  function spawnHealParticle(patient) {
    if (activeParticleCount >= PARTICLE_POOL_SIZE) return;
    var part = particlePool[activeParticleCount];
    activeParticleCount++;
    var px = patient.mesh.position.x + (Math.random() - 0.5) * 0.5;
    var pz = patient.mesh.position.z + (Math.random() - 0.5) * 0.3;
    var py = patient.mesh.position.y + 0.4 + Math.random() * 0.6;
    part.sprite.position.set(px, py, pz);
    part.sprite.visible = true;
    part.sprite.material.opacity = 1;
    part.sprite.scale.set(0.12, 0.12, 1);
    part.life = PARTICLE_LIFETIME;
    part.maxLife = PARTICLE_LIFETIME;
    part.vx = (Math.random() - 0.5) * 0.2;
    part.vy = PARTICLE_SPEED + Math.random() * 0.3;
    part.vz = (Math.random() - 0.5) * 0.2;
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

    // Update active particles (swap-with-last removal)
    for (var i = activeParticleCount - 1; i >= 0; i--) {
      var part = particlePool[i];
      part.life -= delta;
      if (part.life <= 0) {
        part.sprite.visible = false;
        activeParticleCount--;
        // Swap with last active
        if (i < activeParticleCount) {
          var temp = particlePool[i];
          particlePool[i] = particlePool[activeParticleCount];
          particlePool[activeParticleCount] = temp;
        }
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
      if (p.indicators && p.indicators.length > 0) {
        var count = p.indicators.length;
        for (var j = 0; j < count; j++) {
          var ind = p.indicators[j];
          var offsetX = (j - (count - 1) / 2) * 0.45;
          ind.position.x = p.mesh.position.x + offsetX;
          ind.position.z = p.mesh.position.z;
          ind.position.y = isLying ? 1.5 : 2.0;
          var pulse = 0.4 + Math.sin(t + p.id + j * 0.5) * 0.06;
          ind.scale.set(pulse, pulse, 1);
        }
      }
      if (p.healthBar) {
        p.healthBar.position.x = p.mesh.position.x;
        p.healthBar.position.z = p.mesh.position.z;
        p.healthBar.position.y = isLying ? 1.2 : 1.7;
      }
    }
  }

  // --- Treatment ---
  function applyOneConsumable(patient, consumableType) {
    // Remove from pending list
    var idx = patient.pendingConsumables.indexOf(consumableType);
    if (idx !== -1) patient.pendingConsumables.splice(idx, 1);
    removeOneIndicator(patient, consumableType);

    patient.animating = true;

    if (patient.pendingConsumables.length === 0) {
      // All items applied — fully treated
      patient.treated = true;
      Game.Inventory.showNotification(Game.Lang.t('notify.treatmentStarted'), 'rgba(34, 139, 34, 0.85)');
      for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
        var part = patient.mesh.userData.bodyParts[j];
        part.material.emissive = new THREE.Color(0x00ff44);
        part.material.emissiveIntensity = 0.8;
      }
      animations.push({ patient: patient, type: 'heal', timer: 0.5, maxTime: 0.5 });
    } else {
      // Partial treatment — brief feedback
      Game.Inventory.showNotification(Game.Lang.t('notify.medicineApplied', [patient.pendingConsumables.length]), 'rgba(70, 130, 180, 0.85)');
      for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
        var part = patient.mesh.userData.bodyParts[j];
        part.material.emissive = new THREE.Color(0x4488ff);
        part.material.emissiveIntensity = 0.5;
      }
      animations.push({ patient: patient, type: 'heal', timer: 0.3, maxTime: 0.3 });
    }
  }

  function treatPatient(patient) {
    var activeType = Game.Inventory.getActive();
    Game.Inventory.removeActive();
    applyOneConsumable(patient, activeType);
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('patient_treated');
  }

  function wrongTreatment(patient) {
    patient.animating = true;
    Game.Inventory.showNotification(Game.Lang.t('notify.wrongMedicine'));

    for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
      var part = patient.mesh.userData.bodyParts[j];
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
    removeAllIndicators(patient);
    if (patient.healthBar) {
      scene.remove(patient.healthBar);
      patient.healthBar = null;
    }
    if (patient.destination) {
      patient.destination.occupied = false;
      if (Game.Furniture.isBedSlot(patient.destination)) {
        Game.Furniture.decrementBedHp(patient.destination);
      }
      patient.destination = null;
    }
    patient.treated = false; // Stop recovery logic
    patient.anim.recovered = true;
    removeIllnessVisuals(patient);
    patient.anim.targetPose = 'standing';
    // Track served
    if (Game.Shift) Game.Shift.trackPatientServed();
    // Send to cashier
    Game.Cashier.addPatientToQueue(patient);
  }

  function onPatientPaid() {
    var currentLevel = Game.Levels ? Game.Levels.getLevel() : 1;
    if (currentLevel >= 3) return; // continuous mode handles spawning via timer
    if (!Game.Shift || !Game.Shift.isOpen()) return;
    if (Game.Tutorial && Game.Tutorial.isActive()) return; // no spawning during tutorial

    if (!firstPatientPaid) {
      // First patient just paid — unlock 30s timer and spawn one immediately
      firstPatientPaid = true;
      sequentialSpawnActive = true;
      sequentialSpawnTimer = 0;
      spawnPatient();
    } else {
      // Subsequent payments — spawn immediately
      spawnPatient();
    }
  }

  function removePatient(patient) {
    removeIllnessVisuals(patient);
    removeAllIndicators(patient);
    if (patient.healthBar) {
      scene.remove(patient.healthBar);
      patient.healthBar = null;
    }
    scene.remove(patient.mesh);
    if (patient.destination) {
      patient.destination.occupied = false;
      if (Game.Furniture.isBedSlot(patient.destination)) {
        Game.Furniture.decrementBedHp(patient.destination);
      }
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
          if (anim.patient.treated) {
            removeAllIndicators(anim.patient);
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
          Game.Inventory.showNotification(Game.Lang.t('notify.patientDischarged'), 'rgba(34, 139, 34, 0.85)');
          dischargePatient(p);
          continue;
        }
        updateHealthBarTexture(p);
      } else {
        // Skip decay during tutorial
        if (Game.Tutorial && Game.Tutorial.isActive()) continue;
        // Skip decay while walking to destination or during active minigame
        if (p.state === 'walking') continue;
        if (p.state === 'queued' && p.queueTarget) {
          var dx = p.queueTarget.x - p.mesh.position.x;
          var dz = p.queueTarget.z - p.mesh.position.z;
          if (dx * dx + dz * dz > 0.01) continue;
        }
        if (Game.Diagnostics && Game.Diagnostics.isActive() && Game.Diagnostics.getPatient() === p) continue;
        // Decay: -1 HP every 3 sec (halved for queued/waiting patients)
        p.hpDecayTimer += delta;
        while (p.hpDecayTimer >= HP_DECAY_INTERVAL) {
          p.hpDecayTimer -= HP_DECAY_INTERVAL;
          var decayAmount = (p.state === 'queued' || p.state === 'waiting') ? 0.5 : 1;
          p.hp -= decayAmount;
          if (p.hp <= 0) {
            p.hp = 0;
            updateHealthBarTexture(p);
            Game.Inventory.showNotification(Game.Lang.t('notify.patientLeft'));
            if (Game.Shift) Game.Shift.trackPatientLost();
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
          var isBed = p.destination && Game.Furniture.isBedSlot(p.destination);
          p.state = isBed ? 'atBed' : 'waiting';
          p.targetPos = null;
          p.anim.targetPose = isBed ? 'lying' : 'sitting';
          if (p.state === 'atBed') {
            createBedIndicators(p);
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
              child.material.transparent = true;
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
    patient.wasDiagnosed = true;
    patient.needsDiagnosis = false;
    patient.symptom = null;
    patient.diagnosis = patient.hiddenDiagnosis;
    patient.requiredConsumable = patient.hiddenConsumable;
    patient.requiredInstrument = null;

    // Build multi-consumable lists based on severity
    var primary = patient.requiredConsumable;
    var requiredConsumables;
    if (patient.severity.key === 'mild') {
      requiredConsumables = [primary];
    } else if (patient.severity.key === 'medium') {
      var others = CONSUMABLE_KEYS.filter(function(k) { return k !== primary; });
      requiredConsumables = [primary, randomFrom(others)];
    } else {
      requiredConsumables = CONSUMABLE_KEYS.slice();
    }
    patient.requiredConsumables = requiredConsumables;
    patient.pendingConsumables = requiredConsumables.slice();

    // Update bed indicators to show consumables instead of instrument
    removeAllIndicators(patient);
    if (patient.state === 'atBed') {
      createBedIndicators(patient);
    }
    Game.Inventory.showNotification(Game.Lang.t('notify.diagnosisSet'), 'rgba(34, 139, 34, 0.85)');
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
      okBtn.textContent = Game.Lang.t('popup.btn.ok');
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
    getPatientCount: function() { return patients.length; },
    getActivePatientCount: function() {
      var count = 0;
      for (var i = 0; i < patients.length; i++) {
        if (patients[i].state !== 'leaving') count++;
      }
      return count;
    },
    getHoveredPatient: function() { return hoveredPatient; },
    revealDiagnosis: function(patient) { revealDiagnosis(patient); },
    revealDiagnosisAnimated: function(patient) { revealDiagnosisAnimated(patient); },

    // Staff APIs
    getPatients: function() { return patients; },
    getQueue: function() { return queue; },
    sendPatientByStaff: function(patient, dest, slot) {
      // Same as sendPatient but without closing popup
      // Free current destination (waiting chair) if occupied
      if (patient.state === 'waiting' && patient.destination) {
        patient.destination.occupied = false;
      }
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
    },
    summonToDesk: function(patient, deskPos) {
      // Patient walks from queue to admin desk (stays in 'queued' state with special target)
      removeFromQueue(patient);
      patient.state = 'queued';
      patient.queueTarget = new THREE.Vector3(deskPos.x, 0, deskPos.z);
    },
    treatPatientByStaff: function(patient, consumableType) {
      if (!patient || patient.treated) return;
      if (!patient.pendingConsumables || patient.pendingConsumables.indexOf(consumableType) === -1) return;
      applyOneConsumable(patient, consumableType);
    },

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
      initParticlePool();

      // Cache UI elements
      waveBannerEl = document.getElementById('wave-banner');
      waveTextEl = document.getElementById('wave-text');
      waveTimerFillEl = document.getElementById('wave-timer-fill');
      waveTimerTextEl = document.getElementById('wave-timer-text');
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
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('patient_click') && !Game.Tutorial.isAllowed('treat_patient')) return;

        // Block interaction if admin is processing this patient
        if (hoveredPatient.staffProcessing) {
          Game.Inventory.showNotification(Game.Lang.t('notify.adminProcessing'));
          return;
        }

        if (hoveredPatient.state === 'atBed') {
          if (hoveredPatient.treated) return;

          // Undiagnosed patient — instrument is implicit, minigame starts directly
          if (hoveredPatient.needsDiagnosis) {
            // Check if staff diagnostician is already working
            if (hoveredPatient.staffDiagnosing) {
              Game.Inventory.showNotification(Game.Lang.t('notify.diagAlreadyWorking'));
              return;
            }
            // Start mini-game directly (no inventory check)
            Game.Diagnostics.startMinigame(hoveredPatient, hoveredPatient.requiredInstrument);
            return;
          }

          // Check if staff nurse is already treating
          if (hoveredPatient.staffTreating) {
            Game.Inventory.showNotification(Game.Lang.t('notify.nurseAlreadyTreating'));
            return;
          }
          // Check player has manually selected a matching consumable
          if (!hoveredPatient.pendingConsumables || hoveredPatient.pendingConsumables.length === 0) return;
          var activeType = Game.Inventory.getActive();
          if (!activeType) {
            Game.Inventory.showNotification(Game.Lang.t('notify.noMedicineInInventory'));
            return;
          }
          if (hoveredPatient.pendingConsumables.indexOf(activeType) === -1) {
            wrongTreatment(hoveredPatient);
            Game.Inventory.showNotification(Game.Lang.t('notify.wrongItem', [hoveredPatient.pendingConsumables[0]]));
            return;
          }
          treatPatient(hoveredPatient);
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
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('btn_bed')) return;
        var indoorBeds = Game.Furniture.getIndoorBeds();
        var slot = null;
        for (var i = 0; i < indoorBeds.length; i++) {
          if (!indoorBeds[i].occupied && !Game.Furniture.isBedBroken(indoorBeds[i])) { slot = indoorBeds[i]; break; }
        }
        if (!slot) return;
        sendPatient(popupPatient, slot.pos, slot);
        if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('patient_sent_to_bed');
      });

      btnWait.addEventListener('click', function() {
        if (!popupPatient) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('btn_wait')) return;
        var indoorChairs = Game.Furniture.getIndoorChairs();
        var slot = null;
        for (var i = 0; i < indoorChairs.length; i++) {
          if (!indoorChairs[i].occupied) { slot = indoorChairs[i]; break; }
        }
        if (!slot) return;
        sendPatient(popupPatient, slot.pos, slot);
      });

      btnDismiss.addEventListener('click', function() {
        if (!popupPatient) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('btn_dismiss')) return;
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

      // Don't spawn first patient — shift system controls this

      // Register with central interaction system
      Game.Interaction.register('patients', function() {
        var meshes = [];
        for (var i = 0; i < patients.length; i++) {
          var p = patients[i];
          if (p.animating) continue;
          if (p.state === 'queued' || p.state === 'interacting' || p.state === 'atBed' || p.state === 'waiting') {
            meshes.push(p.mesh);
          }
        }
        return meshes;
      }, true, 5);
    },

    spawnFirstPatient: function() {
      var p = spawnPatient();
      if (Game.Tutorial && Game.Tutorial.isActive() && p) {
        Game.Tutorial.setTutorialPatient(p);
      }
    },
    startFirstCluster: function() {
      // Legacy alias — kept for compatibility
      this.startWaveSystem();
    },
    startWaveSystem: function() {
      currentWaveIndex = 0;
      waveSpawnQueue = [];
      waveSpawnTimer = 0;
      waveStarted = true;
      lastWaveSize = 0;
      currentSpawnWaveNumber = 0;
      waveQueueTimer = 0;
      waveQueueTimerActive = false;
      activeWaveNumber = -1;
      if (waveBannerEl) waveBannerEl.style.display = 'none';
    },
    onPatientPaid: function() {
      onPatientPaid();
    },

    clearAll: function() {
      // Remove all patients from scene
      for (var i = patients.length - 1; i >= 0; i--) {
        var p = patients[i];
        removeIllnessVisuals(p);
        removeAllIndicators(p);
        if (p.healthBar) { scene.remove(p.healthBar); p.healthBar = null; }
        if (p.destination) {
          p.destination.occupied = false;
          if (Game.Furniture.isBedSlot(p.destination)) {
            Game.Furniture.decrementBedHp(p.destination);
          }
        }
        scene.remove(p.mesh);
      }
      patients.length = 0;
      queue.length = 0;
      hoveredPatient = null;
      popupPatient = null;
      spawnTimer = 0;
      sequentialSpawnTimer = 0;
      sequentialSpawnActive = false;
      waveQueueTimerActive = false;
      activeWaveNumber = -1;
      if (waveBannerEl) waveBannerEl.style.display = 'none';
      firstPatientPaid = false;
      // Reset wave state
      currentWaveIndex = 0;
      waveSpawnQueue = [];
      waveSpawnTimer = 0;
      lastWaveSize = 0;
      currentSpawnWaveNumber = 0;
      waveStarted = false;
      // Remove heal particles
      for (var j = healParticles.length - 1; j >= 0; j--) {
        scene.remove(healParticles[j].mesh);
      }
      healParticles.length = 0;
    },

    update: function(delta) {
      // Spawn patients only when shift is open (and not during tutorial)
      if (Game.Shift && Game.Shift.isOpen() && !(Game.Tutorial && Game.Tutorial.isActive())) {
        var currentLevel = Game.Levels ? Game.Levels.getLevel() : 1;
        var spawnMode = Game.Levels ? Game.Levels.getSpawnMode() : 'sequential';

        if (spawnMode === 'wave') {
          // Level 2+: scripted wave spawn with guaranteed severity diversity
          var config = WAVE_CONFIG[currentLevel] || WAVE_CONFIG[4];
          var gameTime = Game.Shift.getGameTime ? Game.Shift.getGameTime() : 0;
          var totalSlots = Game.Furniture.getAllBeds().length + Game.Furniture.getAllChairs().length;
          var maxQueue = Math.min(totalSlots + 2, 12);
          if (maxQueue < 4) maxQueue = 4;

          // Check if next wave should start
          if (currentWaveIndex < config.waves.length && waveSpawnQueue.length === 0) {
            var nextWave = config.waves[currentWaveIndex];
            if (gameTime >= nextWave.time) {
              // First wave always triggers; subsequent waves require at least one patient from prev wave to have left
              var canSpawn = true;
              if (currentWaveIndex > 0 && lastWaveSize > 0) {
                var prevWaveNum = currentSpawnWaveNumber;
                var stillActive = 0;
                for (var wi = 0; wi < patients.length; wi++) {
                  var st = patients[wi].state;
                  if (patients[wi].waveNumber === prevWaveNum && st !== 'leaving' && st !== 'discharged' && st !== 'atRegister') {
                    stillActive++;
                  }
                }
                canSpawn = stillActive < lastWaveSize;
              }
              if (canSpawn) {
                // Build spawn queue: severe first, then medium, then mild
                var comp = nextWave.composition; // [mild, medium, severe]
                waveSpawnQueue = [];
                for (var ws = 0; ws < comp[2]; ws++) waveSpawnQueue.push('severe');
                for (var wm = 0; wm < comp[1]; wm++) waveSpawnQueue.push('medium');
                for (var wl = 0; wl < comp[0]; wl++) waveSpawnQueue.push('mild');
                lastWaveSize = comp[0] + comp[1] + comp[2];
                currentSpawnWaveNumber = currentWaveIndex;
                currentWaveIndex++;
              }
            }
          }

          // Spawn all patients from wave queue at once
          var spawnedThisFrame = false;
          while (waveSpawnQueue.length > 0) {
            if (queue.length >= maxQueue) {
              Game.Inventory.showNotification(Game.Lang.t('notify.queueOverflow'));
              waveSpawnQueue.length = 0;
            } else {
              var severityKey = waveSpawnQueue.shift();
              spawnPatient(false, severityKey);
              spawnedThisFrame = true;
            }
          }
          // Show wave banner when new wave spawns
          if (spawnedThisFrame) {
            waveQueueTimer = QUEUE_PATIENCE;
            waveQueueTimerActive = true;
            activeWaveNumber = currentSpawnWaveNumber;
            if (waveBannerEl) {
              waveTextEl.textContent = Game.Lang.t('wave.arrived');
              waveBannerEl.style.display = 'block';
              waveBannerEl.classList.remove('urgent');
            }
          }

          // Update shared wave queue timer
          if (waveQueueTimerActive) {
            // Count queued patients from active wave
            var queuedFromWave = 0;
            for (var qi = 0; qi < patients.length; qi++) {
              var qs = patients[qi].state;
              if (patients[qi].waveNumber === activeWaveNumber && (qs === 'queued' || qs === 'interacting')) {
                queuedFromWave++;
              }
            }
            if (queuedFromWave === 0) {
              // All patients assigned or gone — hide banner
              waveQueueTimerActive = false;
              if (waveBannerEl) waveBannerEl.style.display = 'none';
            } else {
              waveQueueTimer -= delta;
              // Update banner visuals
              if (waveBannerEl) {
                var ratio = Math.max(0, waveQueueTimer / QUEUE_PATIENCE);
                var showTimer = waveQueueTimer <= 15;
                waveTimerFillEl.parentElement.style.display = showTimer ? '' : 'none';
                waveTimerTextEl.style.display = showTimer ? '' : 'none';
                if (showTimer) {
                  var urgentRatio = Math.max(0, waveQueueTimer / 15);
                  waveTimerFillEl.style.width = (urgentRatio * 100) + '%';
                  waveTimerTextEl.textContent = Math.ceil(Math.max(0, waveQueueTimer)) + 's';
                }
                if (ratio < 0.25) {
                  waveBannerEl.classList.add('urgent');
                } else {
                  waveBannerEl.classList.remove('urgent');
                }
              }
              // Timer expired — remove all queued patients from this wave
              if (waveQueueTimer <= 0) {
                for (var ri = patients.length - 1; ri >= 0; ri--) {
                  if (patients[ri].waveNumber === activeWaveNumber && patients[ri].state === 'queued') {
                    if (Game.Shift) Game.Shift.trackPatientLost();
                    removePatient(patients[ri]);
                  }
                }
                Game.Inventory.showNotification(Game.Lang.t('notify.patientLeft'));
                waveQueueTimerActive = false;
                if (waveBannerEl) waveBannerEl.style.display = 'none';
              }
            }
          }
        } else {
          // Level 1-2: sequential mode
          // After first patient is paid, spawn every 30 seconds
          if (sequentialSpawnActive) {
            sequentialSpawnTimer += delta;
            if (sequentialSpawnTimer >= 30) {
              sequentialSpawnTimer = 0;
              var maxQueue = Math.min(2 + Game.Furniture.getAllBeds().length + Game.Furniture.getAllChairs().length - 5, 10);
              if (maxQueue < 2) maxQueue = 2;
              if (queue.length < maxQueue) {
                spawnPatient();
              }
            }
          }
        }
      } else {
        spawnTimer = 0;
        sequentialPendingSpawn = false;
        sequentialDelay = 0;
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
