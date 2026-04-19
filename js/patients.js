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

  // --- Severity definitions ---
  var SEVERITIES = [
    { key: 'severe', label: Game.Lang.t('severity.severe') },
    { key: 'medium', label: Game.Lang.t('severity.medium') },
    { key: 'mild',   label: Game.Lang.t('severity.mild') }
  ];

  // --- Pricing (moved from cashier.js) ---
  var BASE_PRICES = { mild: 35, medium: 50, severe: 70 };
  var PRICE_VARIANCE = 5;
  var DIAGNOSIS_FEE = 15;

  // Recovery phase: after applying all meds, patient lies treated on the bed for
  // this many seconds before the discharge-form indicator appears.
  var RECOVERY_DURATION = 4.0;

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

  // Hold-to-treat mechanic
  var TREAT_HOLD_DURATION = 0.75; // seconds
  var treatHold = null; // { patient, consumableType, timer } | null
  var treatHoldEl = null;   // container div for SVG ring
  var treatHoldRing = null; // <circle> element (strokeDashoffset)
  var TREAT_HOLD_CIRC = 2 * Math.PI * 16; // r=16

  // Smiley reaction textures (lazy-built, shared)
  var SMILEY_COUNT = 10;
  var SMILEY_LIFETIME = 1.4; // seconds
  var SMILEY_RISE = 0.5;     // units
  var smileyTextures = null;
  var lastSmileyIndex = -1;
  var prevSmileyIndex = -2;

  // Slot-based auto-spawn (Level 2+). Each freed hospital slot schedules its
  // OWN independent countdown in `pendingSpawns`, so healing several patients
  // at once queues up several incoming arrivals instead of serialising through
  // a single shared timer. Initial burst fills all available slots with 1-3s
  // stagger (chained); steady-state arrivals: each freed slot adds a 10-20s
  // timer. Spawn also gated by queue cap of 2.
  var autoSpawnActive = false;      // true after startWaveSystem() is called
  var initialSpawnCount = 0;        // how many initial-burst patients have spawned
  var initialBurstTarget = 0;       // captured at startWaveSystem(): beds + diagQueueSlots
  var initialPlan = null;           // shuffled booleans — for each initial-burst patient, needsDiagnosis?
  var pendingSpawns = [];           // array of countdown timers (sec); each fires one patient
  var prevTotalInBuilding = 0;      // for detecting slot-freed events between frames
  var INITIAL_MIN = 1, INITIAL_MAX = 3;   // seconds between initial-burst patients
  var STEADY_MIN = 10, STEADY_MAX = 20;   // seconds per freed slot in steady state

  // Dynamic QUEUE_CAP: beds + diag(queue+exam) + waiting chairs
  function getQueueCap() {
    var beds = Game.Furniture ? Game.Furniture.getIndoorBeds().length : 3;
    var waits = Game.Furniture ? Game.Furniture.getIndoorChairs().length : 3;
    var diag = diagQueueSlots.length + (diagExamSlot ? 1 : 0);
    return beds + diag + waits;
  }

  // --- UI elements ---
  var hintEl, popupEl, popupName, popupDiagnosis, popupSupply, popupSupplyIcon, popupSeverity;
  var popupAge, popupComplaint, popupTemp, popupPulse, popupBp;
  var popupSeverityBand;
  var btnBed, btnWait, btnDiag, btnReject, bedCount, chairCount, diagCount;

  // Diag-result popup elements
  var diagResultEl, diagResultName, diagResultOutcome, diagResultPrescription, diagResultPrice;
  var diagSendBedBtn, diagSendWaitBtn, diagSendHomeBtn, diagDeferBtn;
  var diagResultPatient = null;

  // Discharge popup elements
  var dischargeEl, dischargeName, dischargeDiagnosis, dischargeApplied, dischargeCost, dischargeConfirmBtn, dischargeDeferBtn;
  var dischargePopupPatient = null;

  // Diag room slots (passed in from world setup)
  var diagQueueSlots = [];
  var diagExamSlot = null;

  // Doorway waypoint for diag room routing. Door is on the EAST wall (x=-3, z=-15..-14).
  // Queue chairs are along the east wall (north of door), so a single door waypoint
  // suffices for both inbound and outbound paths.
  function diagDoorWaypoint() { return new THREE.Vector3(-2.7, 0, -14.5); }

  // --- Interaction raycaster ---
  var interactRay;
  var screenCenter;

  function getQueuePosition(index) {
    // Vertical queue in front of the reception desk (desk at z=-9).
    // Index 0 (head) is closest to the desk; subsequent patients line up southward.
    return new THREE.Vector3(0, 0, -7.5 + index * 1.2);
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

  function spawnPatient(instant, explicitSeverityKey, explicitNeedsDiagnosis) {
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
    var diagChance = Game.Levels && Game.Levels.getDiagnosisChance ? Game.Levels.getDiagnosisChance() : 0.30;
    var needsDiagnosis;
    if (explicitNeedsDiagnosis !== null && explicitNeedsDiagnosis !== undefined) {
      needsDiagnosis = !!explicitNeedsDiagnosis;
    } else {
      needsDiagnosis = (currentLevel >= 2) ? (Math.random() < diagChance) : false;
    }
    // 50% of diagnostic patients will turn out to be healthy (no disease)
    var isHealthy = needsDiagnosis && (Math.random() < 0.5);

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

    // Pre-compute procedure fee at spawn
    var procedureFee = BASE_PRICES[severity.key] + (Math.floor(Math.random() * (PRICE_VARIANCE * 2 + 1)) - PRICE_VARIANCE);

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
      isHealthy: isHealthy,
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
      severity: severity,
      treated: false,
      wasDiagnosed: false,
      homeSent: false,
      procedureFee: procedureFee,
      treatmentFee: 0,
      paymentInfo: null,
      diagQueueSlot: null,
      diagExamSlot: null,
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
          hintEl.textContent = (treatHold && treatHold.patient === hoveredPatient)
            ? Game.Lang.t('patient.hint.treatHold')
            : Game.Lang.t('patient.hint.treat');
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
    } else if (hoveredPatient.state === 'atDiagExam') {
      if (hoveredPatient.staffDiagnosing) {
        hintEl.textContent = Game.Lang.t('patient.hint.treating');
      } else {
        hintEl.textContent = Game.Lang.t('patient.hint.diagnose');
      }
      hintEl.style.display = 'block';
    } else if (hoveredPatient.state === 'awaitingDiagDecision') {
      hintEl.textContent = Game.Lang.t('patient.hint.resumeDiag');
      hintEl.style.display = 'block';
    } else if (hoveredPatient.state === 'awaitingDischargeDecision') {
      hintEl.textContent = Game.Lang.t('patient.hint.resumeDischarge');
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

    var indoorBeds = Game.Furniture.getIndoorBeds();
    var indoorChairs = Game.Furniture.getIndoorChairs();
    var freeBeds = indoorBeds.filter(function(b) { return !b.occupied && !Game.Furniture.isBedBroken(b); }).length;
    var freeChairs = indoorChairs.filter(function(c) { return !c.occupied; }).length;
    var outdoorBedCount = Game.Furniture.getOutdoorBedCount();
    var outdoorChairCount = Game.Furniture.getOutdoorChairCount();
    var freeDiag = getFreeDiagSlotsCount();
    var totalDiag = diagQueueSlots.length + (diagExamSlot ? 1 : 0);

    // Reset all action button visibility/display
    btnBed.style.display = '';
    btnWait.style.display = '';
    btnDiag.style.display = '';
    btnReject.style.display = '';

    // Unified popup: always show both "Bed" and "Diagnostics" buttons.
    // Wrong-direction click surfaces an error instead of navigating.
    btnBed.disabled = freeBeds === 0;
    btnBed.style.opacity = freeBeds > 0 ? '1' : '0.4';
    bedCount.textContent = '(' + freeBeds + '/' + indoorBeds.length + ')';

    btnDiag.disabled = freeDiag === 0;
    btnDiag.style.opacity = freeDiag > 0 ? '1' : '0.4';
    diagCount.textContent = '(' + freeDiag + '/' + totalDiag + ')';

    if (wasWaiting) {
      btnWait.style.display = 'none';
    } else {
      btnWait.disabled = freeChairs === 0;
      btnWait.style.opacity = freeChairs > 0 ? '1' : '0.4';
      chairCount.textContent = '(' + freeChairs + '/' + indoorChairs.length + ')';
    }

    // Clear any prior error
    var popupError = document.getElementById('popup-error');
    if (popupError) popupError.style.display = 'none';

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

    controls.unlock();
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('popup_opened');
  }

  function getFreeDiagSlotsCount() {
    var free = 0;
    for (var i = 0; i < diagQueueSlots.length; i++) {
      if (!diagQueueSlots[i].occupied) free++;
    }
    if (diagExamSlot && !diagExamSlot.occupied) free++;
    return free;
  }

  function findFreeDiagQueueSlot() {
    for (var i = 0; i < diagQueueSlots.length; i++) {
      if (!diagQueueSlots[i].occupied) return diagQueueSlots[i];
    }
    return null;
  }

  function closePopup() {
    popupEl.style.display = 'none';
    popupPatient = null;
    controls.lock();
  }

  function showPopupError(msg) {
    var popupError = document.getElementById('popup-error');
    if (!popupError) return;
    popupError.textContent = msg;
    popupError.style.display = 'block';
  }

  function deferPatientPopup(patient) {
    // Defer: revert state so the player can re-open, then close popup.
    patient.state = patient._wasWaiting ? 'waiting' : 'queued';
    closePopup();
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

  // Draws a "discharge form" icon (paper with pen) on a 64x64 canvas context.
  function drawDischargeFormIcon(ctx) {
    // Paper sheet (white, slight rotation for style)
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(-0.08);
    // Paper body
    ctx.fillStyle = '#f8f5ee';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-13, -16, 26, 32);
    ctx.fill();
    ctx.stroke();
    // Text lines
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, -10); ctx.lineTo(9, -10);
    ctx.moveTo(-9, -5);  ctx.lineTo(9, -5);
    ctx.moveTo(-9, 0);   ctx.lineTo(5, 0);
    ctx.moveTo(-9, 5);   ctx.lineTo(9, 5);
    ctx.stroke();
    // Signature line
    ctx.strokeStyle = '#1a4d2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.quadraticCurveTo(-2, 8, 3, 11);
    ctx.quadraticCurveTo(6, 12, 8, 9);
    ctx.stroke();
    ctx.restore();

    // Pen overlaid diagonally
    ctx.save();
    ctx.translate(40, 38);
    ctx.rotate(Math.PI / 4);
    // Pen tip
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(-2, 10); ctx.lineTo(0, 14); ctx.lineTo(2, 10);
    ctx.closePath();
    ctx.fill();
    // Pen body
    ctx.fillStyle = '#cc4040';
    ctx.fillRect(-2.5, -10, 5, 20);
    // Pen cap
    ctx.fillStyle = '#222';
    ctx.fillRect(-2.5, -14, 5, 4);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.strokeRect(-2.5, -10, 5, 20);
    ctx.restore();
  }

  function createDischargeFormIndicator(patient) {
    var canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    var ctx = canvas.getContext('2d');

    // Circular background (dark blue) with light-blue ring
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(25, 55, 90, 0.88)';
    ctx.fill();
    ctx.strokeStyle = '#9ec7f0';
    ctx.lineWidth = 3;
    ctx.stroke();

    drawDischargeFormIcon(ctx);

    var texture = new THREE.CanvasTexture(canvas);
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.4, 0.4, 1);
    sprite.userData = { isDischargeForm: true };
    sprite.position.copy(patient.mesh.position);
    // Lying patient on bed: y=1.5; standing: y=2.0. updateIndicators() re-applies each frame.
    sprite.position.y = patient.anim && patient.anim.pose === 'lying' ? 1.5 : 2.0;
    scene.add(sprite);
    patient.indicators.push(sprite);
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
      // All items applied — start recovery phase. Patient lies treated on the bed
      // while recovering, then a discharge-form indicator appears and player must
      // click on the patient to open the discharge popup.
      patient.treated = true;
      Game.Inventory.showNotification(Game.Lang.t('notify.treatmentStarted'), 'rgba(34, 139, 34, 0.85)');
      for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
        var part = patient.mesh.userData.bodyParts[j];
        part.material.emissive = new THREE.Color(0x00ff44);
        part.material.emissiveIntensity = 0.8;
      }
      animations.push({ patient: patient, type: 'heal', timer: 0.5, maxTime: 0.5, startRecovery: true });
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
    spawnSmileyReaction(patient);
  }

  function treatPatient(patient) {
    var activeType = Game.Inventory.getActive();
    Game.Inventory.removeActive();
    applyOneConsumable(patient, activeType);
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('patient_treated');
  }

  // --- Hold-to-treat ---

  function ensureTreatHoldUI() {
    if (treatHoldEl) return;
    treatHoldEl = document.createElement('div');
    treatHoldEl.id = 'treat-hold-progress';
    treatHoldEl.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;display:none;z-index:6;';
    treatHoldEl.innerHTML = ''
      + '<svg width="44" height="44" viewBox="0 0 44 44">'
      +   '<circle cx="22" cy="22" r="16" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="3"/>'
      +   '<circle cx="22" cy="22" r="16" fill="none" stroke="#4ad4ff" stroke-width="3" stroke-linecap="round"'
      +   ' transform="rotate(-90 22 22)" stroke-dasharray="' + TREAT_HOLD_CIRC.toFixed(3) + '" stroke-dashoffset="' + TREAT_HOLD_CIRC.toFixed(3) + '"/>'
      + '</svg>';
    document.body.appendChild(treatHoldEl);
    treatHoldRing = treatHoldEl.querySelector('circle:nth-child(2)');
  }

  function setTreatHoldProgress(p) {
    if (!treatHoldRing) return;
    treatHoldRing.setAttribute('stroke-dashoffset', String(TREAT_HOLD_CIRC * (1 - p)));
  }

  function startTreatHold(patient, consumableType) {
    ensureTreatHoldUI();
    treatHold = { patient: patient, consumableType: consumableType, timer: 0 };
    setTreatHoldProgress(0);
    if (treatHoldEl) treatHoldEl.style.display = 'block';
  }

  function cancelTreatHold() {
    treatHold = null;
    if (treatHoldEl) treatHoldEl.style.display = 'none';
    setTreatHoldProgress(0);
  }

  function updateTreatHold(delta) {
    if (!treatHold) return;
    var p = treatHold.patient;
    var abort = !controls.isLocked
      || popupPatient
      || (Game.Diagnostics && Game.Diagnostics.isActive())
      || !p
      || patients.indexOf(p) === -1
      || p.state !== 'atBed'
      || p.treated
      || p.animating
      || p.staffTreating
      || hoveredPatient !== p
      || !p.pendingConsumables
      || p.pendingConsumables.indexOf(treatHold.consumableType) === -1
      || Game.Inventory.getActive() !== treatHold.consumableType;
    if (abort) {
      cancelTreatHold();
      return;
    }
    treatHold.timer += delta;
    var prog = Math.min(treatHold.timer / TREAT_HOLD_DURATION, 1);
    setTreatHoldProgress(prog);
    if (treatHold.timer >= TREAT_HOLD_DURATION) {
      var patient = p;
      cancelTreatHold();
      treatPatient(patient);
    }
  }

  // --- Smiley reactions ---

  function drawSmileyBase(ctx) {
    // yellow circle with black outline on 64x64 canvas
    ctx.fillStyle = '#ffd83a';
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1a1a1a';
    ctx.stroke();
  }

  function drawSimpleEyes(ctx) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(22, 26, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(42, 26, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawSmileyVariant(ctx, i) {
    drawSmileyBase(ctx);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#1a1a1a';
    if (i === 0) {
      // classic smile
      drawSimpleEyes(ctx);
      ctx.beginPath(); ctx.arc(32, 34, 10, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 1) {
      // laugh — open mouth with teeth
      drawSimpleEyes(ctx);
      ctx.fillStyle = '#3a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 8, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(25, 36, 14, 3);
    } else if (i === 2) {
      // heart-eyes
      ctx.fillStyle = '#ff4070';
      drawHeart(ctx, 22, 26, 6);
      drawHeart(ctx, 42, 26, 6);
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 8, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 3) {
      // wink
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(22, 26, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(38, 26); ctx.lineTo(46, 26); ctx.stroke();
      ctx.beginPath(); ctx.arc(32, 36, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 4) {
      // grin with teeth
      drawSimpleEyes(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(22, 36, 20, 8);
      ctx.strokeRect(22, 36, 20, 8);
      ctx.beginPath(); ctx.moveTo(27, 36); ctx.lineTo(27, 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(32, 36); ctx.lineTo(32, 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(37, 36); ctx.lineTo(37, 44); ctx.stroke();
    } else if (i === 5) {
      // tongue out
      drawSimpleEyes(ctx);
      ctx.beginPath(); ctx.arc(32, 36, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#ff5a8a';
      ctx.beginPath(); ctx.ellipse(32, 44, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.stroke();
    } else if (i === 6) {
      // relieved — closed happy eyes
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(22, 27, 4, Math.PI, 0, true); ctx.stroke();
      ctx.beginPath(); ctx.arc(42, 27, 4, Math.PI, 0, true); ctx.stroke();
      ctx.beginPath(); ctx.arc(32, 36, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (i === 7) {
      // star-eyes
      drawStar(ctx, 22, 26, 5, '#ffcf3a');
      drawStar(ctx, 42, 26, 5, '#ffcf3a');
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 8) {
      // cool — sunglasses
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(12, 22, 18, 8);
      ctx.fillRect(34, 22, 18, 8);
      ctx.fillRect(30, 25, 4, 2);
      ctx.beginPath(); ctx.arc(32, 38, 8, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else {
      // blushing happy
      ctx.fillStyle = '#ff9eb5';
      ctx.beginPath(); ctx.arc(17, 38, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(47, 38, 4, 0, Math.PI * 2); ctx.fill();
      drawSimpleEyes(ctx);
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  function drawHeart(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.7);
    ctx.bezierCurveTo(cx + r, cy + r * 0.2, cx + r, cy - r * 0.8, cx, cy - r * 0.2);
    ctx.bezierCurveTo(cx - r, cy - r * 0.8, cx - r, cy + r * 0.2, cx, cy + r * 0.7);
    ctx.fill();
  }

  function drawStar(ctx, cx, cy, size, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (var k = 0; k < 10; k++) {
      var r = k % 2 === 0 ? size : size * 0.45;
      var a = -Math.PI / 2 + k * Math.PI / 5;
      var x = cx + Math.cos(a) * r;
      var y = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function initSmileyTextures() {
    if (smileyTextures) return;
    smileyTextures = [];
    for (var i = 0; i < SMILEY_COUNT; i++) {
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var ctx = c.getContext('2d');
      drawSmileyVariant(ctx, i);
      smileyTextures.push(new THREE.CanvasTexture(c));
    }
  }

  function chooseSmileyIndex() {
    var idx = Math.floor(Math.random() * SMILEY_COUNT);
    var guard = 0;
    while ((idx === lastSmileyIndex || idx === prevSmileyIndex) && guard < 8) {
      idx = Math.floor(Math.random() * SMILEY_COUNT);
      guard++;
    }
    prevSmileyIndex = lastSmileyIndex;
    lastSmileyIndex = idx;
    return idx;
  }

  function spawnSmileyReaction(patient) {
    if (!patient || !patient.mesh) return;
    initSmileyTextures();
    var tex = smileyTextures[chooseSmileyIndex()];
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.0, 0.0, 1);
    var isLying = patient.state === 'atBed';
    var baseY = isLying ? 1.1 : 1.6;
    sprite.position.set(patient.mesh.position.x, baseY, patient.mesh.position.z);
    scene.add(sprite);
    animations.push({
      patient: patient,
      type: 'smiley',
      timer: SMILEY_LIFETIME,
      maxTime: SMILEY_LIFETIME,
      sprite: sprite,
      baseY: baseY
    });
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

  // --- Diagnostic routing ---
  // Helper: start a walk with an array of waypoints. First element becomes targetPos;
  // remainder is stored in walkPath. When targetPos is reached, the next waypoint is
  // shifted from walkPath until it's empty (then the state transitions).
  function startWalk(patient, waypoints) {
    if (!waypoints || waypoints.length === 0) return;
    patient.targetPos = waypoints[0].clone();
    patient.walkPath = waypoints.length > 1 ? waypoints.slice(1).map(function(v){ return v.clone(); }) : null;
  }

  function sendPatientToDiagnostics(patient) {
    // Prefer exam slot if free, else queue slot
    if (diagExamSlot && !diagExamSlot.occupied) {
      diagExamSlot.occupied = true;
      patient.diagExamSlot = diagExamSlot;
      patient.state = 'walkingToDiagExam';
      // Route through east door, then to exam slot
      startWalk(patient, [diagDoorWaypoint(), diagExamSlot.pos]);
      patient.anim.targetPose = 'standing';
      removeFromQueue(patient);
      closePopup();
      return;
    }
    var qslot = findFreeDiagQueueSlot();
    if (!qslot) return; // shouldn't happen; button disabled in this case
    qslot.occupied = true;
    patient.diagQueueSlot = qslot;
    patient.state = 'walkingToDiagQueue';
    // Queue chairs are along the south exterior wall — direct path from reception queue
    // does not cross any walls. No waypoint needed.
    startWalk(patient, [qslot.pos]);
    patient.anim.targetPose = 'standing';
    removeFromQueue(patient);
    closePopup();
  }

  function rejectPatient(patient) {
    // No payment, patient walks out through entrance
    removeFromQueue(patient);
    if (patient.destination) {
      patient.destination.occupied = false;
      patient.destination = null;
    }
    if (patient.diagQueueSlot) { patient.diagQueueSlot.occupied = false; patient.diagQueueSlot = null; }
    if (patient.diagExamSlot) { patient.diagExamSlot.occupied = false; patient.diagExamSlot = null; }
    removeIllnessVisuals(patient);
    patient.state = 'leaving';
    patient.leavePhase = 'toExit';
    patient.targetPos = new THREE.Vector3(0, 0, 1);
    patient.anim.targetPose = 'standing';
    Game.Inventory.showNotification(Game.Lang.t('notify.patientRejected'));
    closePopup();
    advanceDiagQueue();
  }

  function advanceDiagQueue() {
    // If exam-slot is free, send the first queued patient there
    if (!diagExamSlot || diagExamSlot.occupied) return;
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      if (p.state === 'inDiagQueue') {
        // Free queue slot, claim exam
        if (p.diagQueueSlot) { p.diagQueueSlot.occupied = false; p.diagQueueSlot = null; }
        diagExamSlot.occupied = true;
        p.diagExamSlot = diagExamSlot;
        p.state = 'walkingToDiagExam';
        // Chair → door → exam. Chairs are along the east wall north of the door,
        // so a direct path to the door stays clear of all walls.
        startWalk(p, [diagDoorWaypoint(), diagExamSlot.pos]);
        p.anim.targetPose = 'standing';
        return;
      }
    }
  }

  // --- Diag-result popup ---
  function showDiagResultPopup(patient) {
    if (!diagResultEl) return;
    diagResultPatient = patient;
    patient.state = 'awaitingDiagDecision';

    // Reveal the diagnosis state (for sick) or mark healthy (idempotent — safe on re-open)
    patient.wasDiagnosed = true;
    patient.needsDiagnosis = false;

    var isHealthy = !!patient.isHealthy;
    patient.treatmentFee = isHealthy ? 0 : DIAGNOSIS_FEE;

    diagResultName.textContent = patient.name + ' ' + patient.surname;

    if (isHealthy) {
      diagResultOutcome.textContent = Game.Lang.t('diag.result.healthy');
      diagResultOutcome.style.color = '#4488ff';
      diagResultPrescription.style.display = 'none';
      // Ensure no treatment path will be offered
      patient.requiredConsumables = [];
      patient.pendingConsumables = [];
      // For display/illness we can clear visuals
      removeIllnessVisuals(patient);
    } else {
      // Apply the diagnosis state only on first call (guarded by requiredConsumables check)
      if (!patient.requiredConsumables) {
        revealDiagnosis(patient);
      }
      diagResultOutcome.textContent = Game.Lang.t('diag.result.diseaseFound', [patient.diagnosis]);
      diagResultOutcome.style.color = '#44cc44';
      var names = [];
      if (patient.requiredConsumables) {
        for (var i = 0; i < patient.requiredConsumables.length; i++) {
          names.push(Game.Consumables.TYPES[patient.requiredConsumables[i]].name);
        }
      }
      diagResultPrescription.textContent = names.join(', ');
      diagResultPrescription.style.display = '';
    }

    // Buttons
    var indoorBeds = Game.Furniture.getIndoorBeds();
    var indoorChairs = Game.Furniture.getIndoorChairs();
    var freeBeds = indoorBeds.filter(function(b) { return !b.occupied && !Game.Furniture.isBedBroken(b); }).length;
    var freeChairs = indoorChairs.filter(function(c) { return !c.occupied; }).length;

    if (isHealthy) {
      diagSendBedBtn.style.display = 'none';
      diagSendWaitBtn.style.display = 'none';
      // Healthy patient: only "Send home" is offered; no deferring a healthy case.
      if (diagDeferBtn) diagDeferBtn.style.display = 'none';
    } else {
      diagSendBedBtn.style.display = '';
      diagSendBedBtn.disabled = freeBeds === 0;
      diagSendBedBtn.style.opacity = freeBeds > 0 ? '1' : '0.4';
      diagSendBedBtn.textContent = Game.Lang.t('popup.btn.sendBed', [freeBeds, indoorBeds.length]);

      diagSendWaitBtn.style.display = '';
      diagSendWaitBtn.disabled = freeChairs === 0;
      diagSendWaitBtn.style.opacity = freeChairs > 0 ? '1' : '0.4';
      diagSendWaitBtn.textContent = Game.Lang.t('popup.btn.sendWait', [freeChairs, indoorChairs.length]);
      if (diagDeferBtn) diagDeferBtn.style.display = '';
    }
    // Cost line in popup always shows procedure fee (treatment is charged later via discharge popup)
    diagResultPrice.textContent = Game.Lang.t('diag.result.price', [patient.procedureFee]);
    diagSendHomeBtn.textContent = Game.Lang.t('popup.btn.sendHome');

    diagResultEl.style.display = 'block';
    controls.unlock();
  }

  function closeDiagResultPopup() {
    if (diagResultEl) diagResultEl.style.display = 'none';
    diagResultPatient = null;
    if (controls && !controls.isLocked) {
      // Attempt to relock if no other popup is open
      setTimeout(function() {
        try { controls.lock(); } catch (e) {}
      }, 50);
    }
  }

  function freeExamSlot(patient) {
    if (patient.diagExamSlot) {
      patient.diagExamSlot.occupied = false;
      patient.diagExamSlot = null;
    }
    advanceDiagQueue();
  }

  function sendFromDiagToSlot(patient, destPos, slot) {
    freeExamSlot(patient);
    patient.state = 'walking';
    var finalTarget = destPos.clone();
    finalTarget.y = 0;
    // Exit through east doorway, then to destination.
    startWalk(patient, [diagDoorWaypoint(), finalTarget]);
    patient.destination = slot;
    slot.occupied = true;
    patient.anim.targetPose = 'standing';
    closeDiagResultPopup();
  }

  function sendDiagPatientHome(patient) {
    freeExamSlot(patient);
    patient.homeSent = true;
    patient.paymentInfo = {
      procedure: patient.procedureFee,
      treatment: 0,
      total: patient.procedureFee,
      reason: patient.isHealthy ? 'home-healthy' : 'home-after-diag'
    };
    removeIllnessVisuals(patient);
    patient.anim.recovered = true;
    patient.anim.targetPose = 'standing';
    if (Game.Shift) Game.Shift.trackPatientServed();
    Game.Cashier.addPatientToQueue(patient);
    // Cashier set targetPos=patientPos & state=discharged.
    // Divert through east doorway first, then to cashier.
    if (patient.targetPos) {
      var finalCashierPos = patient.targetPos.clone();
      startWalk(patient, [diagDoorWaypoint(), finalCashierPos]);
    }
    closeDiagResultPopup();
  }

  // --- Discharge popup ---
  function showDischargePopup(patient) {
    if (!dischargeEl) {
      // Fallback: no popup -> discharge directly
      finishTreatmentDischarge(patient);
      return;
    }
    dischargePopupPatient = patient;
    patient.state = 'awaitingDischargeDecision';

    dischargeName.textContent = patient.name + ' ' + patient.surname;
    dischargeDiagnosis.textContent = Game.Lang.t('discharge.diagnosis', [patient.diagnosis || '-']);
    var appliedNames = [];
    if (patient.requiredConsumables) {
      for (var i = 0; i < patient.requiredConsumables.length; i++) {
        appliedNames.push('\u2713 ' + Game.Consumables.TYPES[patient.requiredConsumables[i]].name);
      }
    }
    dischargeApplied.textContent = Game.Lang.t('discharge.applied') + ': ' + appliedNames.join(', ');
    var total = patient.procedureFee + (patient.wasDiagnosed ? patient.treatmentFee : 0);
    dischargeCost.textContent = Game.Lang.t('discharge.cost', [total]);
    dischargeEl.style.display = 'block';
    controls.unlock();
  }

  function confirmDischarge(patient) {
    var total = patient.procedureFee + (patient.wasDiagnosed ? patient.treatmentFee : 0);
    patient.paymentInfo = {
      procedure: patient.procedureFee,
      treatment: patient.wasDiagnosed ? patient.treatmentFee : 0,
      total: total,
      reason: 'discharged'
    };
    dischargePopupPatient = null;
    if (dischargeEl) dischargeEl.style.display = 'none';
    finishTreatmentDischarge(patient);
    if (controls && !controls.isLocked) {
      setTimeout(function() {
        try { controls.lock(); } catch (e) {}
      }, 50);
    }
  }

  function closeDischargePopup() {
    if (dischargeEl) dischargeEl.style.display = 'none';
    dischargePopupPatient = null;
    if (controls && !controls.isLocked) {
      setTimeout(function() {
        try { controls.lock(); } catch (e) {}
      }, 50);
    }
  }

  function finishTreatmentDischarge(patient) {
    dischargePatient(patient);
  }

  function dischargePatient(patient) {
    // Free the bed/chair
    removeAllIndicators(patient);
    if (patient.destination) {
      patient.destination.occupied = false;
      if (Game.Furniture.isBedSlot(patient.destination)) {
        Game.Furniture.decrementBedHp(patient.destination);
      }
      patient.destination = null;
    }
    patient.treated = false;
    patient.anim.recovered = true;
    removeIllnessVisuals(patient);
    patient.anim.targetPose = 'standing';
    // Track served
    if (Game.Shift) Game.Shift.trackPatientServed();
    // Send to cashier (paymentInfo must be set by caller)
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
    scene.remove(patient.mesh);
    if (patient.destination) {
      patient.destination.occupied = false;
      if (Game.Furniture.isBedSlot(patient.destination)) {
        Game.Furniture.decrementBedHp(patient.destination);
      }
    }
    // Free diag slots too
    if (patient.diagQueueSlot) { patient.diagQueueSlot.occupied = false; patient.diagQueueSlot = null; }
    if (patient.diagExamSlot) { patient.diagExamSlot.occupied = false; patient.diagExamSlot = null; }
    var idx = patients.indexOf(patient);
    if (idx !== -1) patients.splice(idx, 1);
    var qIdx = queue.indexOf(patient);
    if (qIdx !== -1) { queue.splice(qIdx, 1); updateQueueTargets(); }
    if (hoveredPatient === patient) {
      hoveredPatient = null;
    }
    advanceDiagQueue();
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
          if (anim.startRecovery && anim.patient.treated && patients.indexOf(anim.patient) !== -1) {
            // Enter recovery phase. After RECOVERY_DURATION the patient becomes
            // ready for discharge and a discharge-form indicator appears over them.
            anim.patient.state = 'recovering';
            anim.patient.recoveryTimer = RECOVERY_DURATION;
          }
          animations.splice(i, 1);
        }
      }

      if (anim.type === 'smiley') {
        var patientAlive = anim.patient && patients.indexOf(anim.patient) !== -1;
        if (!patientAlive || anim.timer <= 0) {
          scene.remove(anim.sprite);
          if (anim.sprite.material) anim.sprite.material.dispose();
          animations.splice(i, 1);
          continue;
        }
        var tS = 1 - (anim.timer / anim.maxTime); // 0..1
        var scaleS = tS < 0.15 ? (tS / 0.15) * 0.55 : 0.55;
        anim.sprite.position.x = anim.patient.mesh.position.x;
        anim.sprite.position.z = anim.patient.mesh.position.z;
        anim.sprite.position.y = anim.baseY + tS * SMILEY_RISE;
        anim.sprite.material.opacity = tS < 0.7 ? 1 : Math.max(0, 1 - (tS - 0.7) / 0.3);
        anim.sprite.scale.set(scaleS, scaleS, 1);
        continue;
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

  function updatePatients(delta) {
    for (var i = patients.length - 1; i >= 0; i--) {
      var p = patients[i];
      var isMoving = false;
      var speed = getPatientSpeed(p) * delta;

      // Recovery phase: patient is treated, lying on the bed. When the timer
      // expires, transition to awaitingDischargeDecision and spawn the
      // discharge-form indicator that the player must click to open the popup.
      if (p.state === 'recovering') {
        if (typeof p.recoveryTimer === 'number') {
          p.recoveryTimer -= delta;
          if (p.recoveryTimer <= 0) {
            p.state = 'awaitingDischargeDecision';
            p.recoveryTimer = null;
            createDischargeFormIndicator(p);
          }
        }
      }

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
        if (arrived && p.walkPath && p.walkPath.length > 0) {
          // Consume next waypoint, keep walking
          p.targetPos = p.walkPath.shift();
          if (p.walkPath.length === 0) p.walkPath = null;
          arrived = false;
          isMoving = true;
        }
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
      // Walking to diagnostic queue chair
      if (p.state === 'walkingToDiagQueue' && p.targetPos) {
        var arrivedQ = moveToward(p.mesh.position, p.targetPos, speed);
        var dirQ = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dirQ.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dirQ.x, dirQ.z);
        }
        isMoving = !arrivedQ;
        if (arrivedQ) {
          p.state = 'inDiagQueue';
          p.targetPos = null;
          p.anim.targetPose = 'sitting';
          p.mesh.rotation.y = 0; // facing north (toward doorway)
          advanceDiagQueue();
        }
      }
      // Walking to diagnostic exam slot
      if (p.state === 'walkingToDiagExam' && p.targetPos) {
        var arrivedE = moveToward(p.mesh.position, p.targetPos, speed);
        var dirE = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dirE.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dirE.x, dirE.z);
        }
        isMoving = !arrivedE;
        if (arrivedE && p.walkPath && p.walkPath.length > 0) {
          // Consumed intermediate waypoint, continue to next
          p.targetPos = p.walkPath.shift();
          if (p.walkPath.length === 0) p.walkPath = null;
          arrivedE = false;
          isMoving = true;
        }
        if (arrivedE) {
          p.state = 'atDiagExam';
          p.targetPos = null;
          p.anim.targetPose = 'sitting';
          p.mesh.rotation.y = Math.PI; // facing north (toward desk at z<patient)
          // Show bed-style indicator above the patient (the required instrument icon)
          createBedIndicators(p);
        }
      }
      // Discharged: walking to cashier (may have doorway waypoint if leaving diag room)
      if (p.state === 'discharged' && p.targetPos) {
        var dir2 = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir2.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir2.x, dir2.z);
        }
        var arrivedD = moveToward(p.mesh.position, p.targetPos, speed);
        isMoving = true;
        if (arrivedD && p.walkPath && p.walkPath.length > 0) {
          p.targetPos = p.walkPath.shift();
          if (p.walkPath.length === 0) p.walkPath = null;
        }
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

    // Remove any prior indicators (instrument icon). Bed indicators are
    // recreated when patient reaches bed via walking→atBed transition.
    removeAllIndicators(patient);
    Game.Inventory.showNotification(Game.Lang.t('notify.diagnosisSet'), 'rgba(34, 139, 34, 0.85)');
  }

  // Legacy alias — diagnostics.js still calls this; delegate to new popup
  function revealDiagnosisAnimated(patient) {
    showDiagResultPopup(patient);
  }

  window.Game.Patients = {
    hasInteraction: function() { return !!hoveredPatient || !!popupPatient || !!diagResultPatient || !!dischargePopupPatient; },
    isPopupOpen: function() { return !!popupPatient || !!diagResultPatient || !!dischargePopupPatient; },
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

    setup: function(_THREE, _scene, _camera, _controls, _beds, _waitingChairs, _diagQueueSlots, _diagExamSlot) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;
      beds = _beds;
      waitingChairs = _waitingChairs;
      diagQueueSlots = _diagQueueSlots || [];
      diagExamSlot = _diagExamSlot || null;

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
      btnBed = document.getElementById('btn-bed');
      btnWait = document.getElementById('btn-wait');
      btnDiag = document.getElementById('btn-diag');
      btnReject = document.getElementById('btn-reject');
      bedCount = document.getElementById('bed-count');
      chairCount = document.getElementById('chair-count');
      diagCount = document.getElementById('diag-count');

      // Diag-result popup
      diagResultEl = document.getElementById('diag-result-popup');
      diagResultName = document.getElementById('diag-result-name');
      diagResultOutcome = document.getElementById('diag-result-outcome');
      diagResultPrescription = document.getElementById('diag-result-prescription');
      diagResultPrice = document.getElementById('diag-result-price');
      diagSendBedBtn = document.getElementById('diag-send-bed');
      diagSendWaitBtn = document.getElementById('diag-send-wait');
      diagSendHomeBtn = document.getElementById('diag-send-home');
      diagDeferBtn = document.getElementById('diag-defer');

      // Discharge popup
      dischargeEl = document.getElementById('discharge-popup');
      dischargeName = document.getElementById('discharge-name');
      dischargeDiagnosis = document.getElementById('discharge-diagnosis');
      dischargeApplied = document.getElementById('discharge-applied');
      dischargeCost = document.getElementById('discharge-cost');
      dischargeConfirmBtn = document.getElementById('discharge-confirm');
      dischargeDeferBtn = document.getElementById('discharge-defer');

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

        // Diagnostic exam slot click — start minigame
        if (hoveredPatient.state === 'atDiagExam') {
          if (hoveredPatient.staffDiagnosing) {
            Game.Inventory.showNotification(Game.Lang.t('notify.diagAlreadyWorking'));
            return;
          }
          Game.Diagnostics.startMinigame(hoveredPatient, hoveredPatient.requiredInstrument);
          return;
        }

        // Deferred decisions — re-open corresponding popup
        if (hoveredPatient.state === 'awaitingDiagDecision') {
          showDiagResultPopup(hoveredPatient);
          return;
        }
        if (hoveredPatient.state === 'awaitingDischargeDecision') {
          showDischargePopup(hoveredPatient);
          return;
        }

        if (hoveredPatient.state === 'atBed') {
          if (hoveredPatient.treated) return;

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
          startTreatHold(hoveredPatient, activeType);
          return;
        }

        if (hoveredPatient.state === 'waiting') {
          openPopup(hoveredPatient);
          return;
        }

        openPopup(hoveredPatient);
      });

      // Cancel hold on any LMB release
      document.addEventListener('mouseup', function(e) {
        if (e.button !== 0) return;
        if (treatHold) cancelTreatHold();
      });

      // Popup buttons
      btnBed.addEventListener('click', function() {
        if (!popupPatient) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('btn_bed')) return;
        if (popupPatient.needsDiagnosis) {
          showPopupError(Game.Lang.t('popup.err.needsDiagnosis'));
          return;
        }
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

      btnDiag.addEventListener('click', function() {
        if (!popupPatient) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('btn_diag')) return;
        if (!popupPatient.needsDiagnosis) {
          showPopupError(Game.Lang.t('popup.err.noDiagnosisNeeded'));
          return;
        }
        sendPatientToDiagnostics(popupPatient);
      });

      btnReject.addEventListener('click', function() {
        if (!popupPatient) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('btn_reject')) return;
        rejectPatient(popupPatient);
      });

      var popupCloseBtn = document.getElementById('popup-close');
      if (popupCloseBtn) {
        popupCloseBtn.addEventListener('click', function() {
          if (!popupPatient) return;
          deferPatientPopup(popupPatient);
        });
      }

      // Diag-result popup handlers
      if (diagSendBedBtn) {
        diagSendBedBtn.addEventListener('click', function() {
          if (!diagResultPatient) return;
          var indoorBeds = Game.Furniture.getIndoorBeds();
          var slot = null;
          for (var i = 0; i < indoorBeds.length; i++) {
            if (!indoorBeds[i].occupied && !Game.Furniture.isBedBroken(indoorBeds[i])) { slot = indoorBeds[i]; break; }
          }
          if (!slot) return;
          sendFromDiagToSlot(diagResultPatient, slot.pos, slot);
        });
      }
      if (diagSendWaitBtn) {
        diagSendWaitBtn.addEventListener('click', function() {
          if (!diagResultPatient) return;
          var indoorChairs = Game.Furniture.getIndoorChairs();
          var slot = null;
          for (var i = 0; i < indoorChairs.length; i++) {
            if (!indoorChairs[i].occupied) { slot = indoorChairs[i]; break; }
          }
          if (!slot) return;
          sendFromDiagToSlot(diagResultPatient, slot.pos, slot);
        });
      }
      if (diagSendHomeBtn) {
        diagSendHomeBtn.addEventListener('click', function() {
          if (!diagResultPatient) return;
          sendDiagPatientHome(diagResultPatient);
        });
      }

      // Defer handlers: close popup without taking action; patient stays in
      // awaitingDiagDecision / awaitingDischargeDecision and can be re-clicked.
      if (diagDeferBtn) {
        diagDeferBtn.addEventListener('click', function() {
          if (!diagResultPatient) return;
          closeDiagResultPopup();
        });
      }

      // Discharge popup handler
      if (dischargeConfirmBtn) {
        dischargeConfirmBtn.addEventListener('click', function() {
          if (!dischargePopupPatient) return;
          confirmDischarge(dischargePopupPatient);
        });
      }
      if (dischargeDeferBtn) {
        dischargeDeferBtn.addEventListener('click', function() {
          if (!dischargePopupPatient) return;
          closeDischargePopup();
        });
      }

      // Don't spawn first patient — shift system controls this

      // Register with central interaction system — strict queue (only head is clickable)
      Game.Interaction.register('patients', function() {
        var meshes = [];
        // Only front of queue is interactive
        if (queue.length > 0) {
          var head = queue[0];
          if (!head.animating && (head.state === 'queued' || head.state === 'interacting')) {
            meshes.push(head.mesh);
          }
        }
        for (var i = 0; i < patients.length; i++) {
          var p = patients[i];
          if (p.animating) continue;
          if (p.state === 'atBed' || p.state === 'waiting' || p.state === 'atDiagExam'
              || p.state === 'awaitingDiagDecision' || p.state === 'awaitingDischargeDecision') {
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
      autoSpawnActive = true;
      initialSpawnCount = 0;
      // Starting wave: one patient per bed + one patient per diagnostic queue seat.
      // No waiting-chair pre-fill (those are for post-queue overflow). Ensures the
      // starting burst always fits: 3 beds + 3 diag seats = 6 patients, all can be
      // placed without congestion.
      var bedCount = Game.Furniture.getAllBeds().length;
      var diagCount = diagQueueSlots.length;
      initialBurstTarget = bedCount + diagCount;

      // Build shuffled plan so diag/non-diag patients arrive MIXED, not grouped.
      initialPlan = [];
      for (var ib = 0; ib < bedCount; ib++) initialPlan.push(false); // non-diagnosis
      for (var id = 0; id < diagCount; id++) initialPlan.push(true); // needs diagnosis
      // Fisher-Yates shuffle
      for (var k = initialPlan.length - 1; k > 0; k--) {
        var r = Math.floor(Math.random() * (k + 1));
        var tmp = initialPlan[k]; initialPlan[k] = initialPlan[r]; initialPlan[r] = tmp;
      }

      pendingSpawns = [0]; // first initial-burst patient fires on next tick; chain continues after each spawn
      prevTotalInBuilding = 0;
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
        if (p.destination) {
          p.destination.occupied = false;
          if (Game.Furniture.isBedSlot(p.destination)) {
            Game.Furniture.decrementBedHp(p.destination);
          }
        }
        if (p.diagQueueSlot) p.diagQueueSlot.occupied = false;
        if (p.diagExamSlot) p.diagExamSlot.occupied = false;
        scene.remove(p.mesh);
      }
      patients.length = 0;
      queue.length = 0;
      hoveredPatient = null;
      popupPatient = null;
      diagResultPatient = null;
      dischargePopupPatient = null;
      spawnTimer = 0;
      sequentialSpawnTimer = 0;
      sequentialSpawnActive = false;
      firstPatientPaid = false;
      // Reset auto-spawn state
      autoSpawnActive = false;
      initialSpawnCount = 0;
      initialBurstTarget = 0;
      initialPlan = null;
      pendingSpawns = [];
      prevTotalInBuilding = 0;
    },

    update: function(delta) {
      // Spawn patients only when shift is open (and not during tutorial)
      if (Game.Shift && Game.Shift.isOpen() && !(Game.Tutorial && Game.Tutorial.isActive())) {
        var currentLevel = Game.Levels ? Game.Levels.getLevel() : 1;
        var spawnMode = Game.Levels ? Game.Levels.getSpawnMode() : 'sequential';

        if (spawnMode === 'wave') {
          // Level 2+: per-slot auto-spawn. Each slot that frees up in the
          // steady state pushes its own 10-20s countdown into `pendingSpawns`,
          // so healing several patients at once triggers several independent
          // arrivals instead of serialising through one shared timer. During
          // the initial burst, timers are chained (1-3s each) until
          // `initialBurstTarget` patients have arrived.
          if (autoSpawnActive) {
            var totalCap = Game.Furniture.getAllBeds().length
                         + Game.Furniture.getAllChairs().length
                         + diagQueueSlots.length
                         + (diagExamSlot ? 1 : 0);

            // Count patients occupying the hospital. discharged/atRegister/leaving
            // have already freed their bed/chair (see finishTreatment() and
            // removePatient()), so they don't count toward the cap.
            var totalInBuilding = 0;
            var queuedCount = 0;
            for (var i = 0; i < patients.length; i++) {
              var st = patients[i].state;
              if (st === 'atRegister' || st === 'leaving' || st === 'discharged') continue;
              totalInBuilding++;
              if (st === 'queued' || st === 'interacting') queuedCount++;
            }

            // Post-burst: maintain occupancy at a minimum of 80% of totalCap.
            // (a) Reactive: each departure (patient transitioning out of counted states —
            //     which happens on дisчarge/send-home/reject) pushes a spawn timer.
            //     If after hypothetical spawn we're still below 80% → fast timer (0.5-2.5s).
            //     Otherwise → normal timer (STEADY_MIN-STEADY_MAX 10-20s).
            // (b) Safety net: if current fill + pending spawns is still below 80%, push
            //     additional fast timers until we would reach target.
            if (initialSpawnCount >= initialBurstTarget) {
              var targetFill = Math.ceil(totalCap * 0.8);

              // (a) Departure-triggered timers
              if (totalInBuilding < prevTotalInBuilding) {
                var freed = prevTotalInBuilding - totalInBuilding;
                for (var f = 0; f < freed; f++) {
                  var projectedFill = totalInBuilding + pendingSpawns.length + 1;
                  if (projectedFill <= targetFill) {
                    pendingSpawns.push(0.5 + Math.random() * 2.0);
                  } else {
                    pendingSpawns.push(STEADY_MIN + Math.random() * (STEADY_MAX - STEADY_MIN));
                  }
                }
              }

              // (b) Safety-net: ensure enough pending timers to reach 80% target.
              var deficit = targetFill - totalInBuilding - pendingSpawns.length;
              for (var d = 0; d < deficit; d++) {
                pendingSpawns.push(0.5 + Math.random() * 2.0);
              }
            }

            // Tick all pending timers
            for (var t = 0; t < pendingSpawns.length; t++) {
              pendingSpawns[t] -= delta;
            }

            // Fire any expired timers whose caps allow spawning right now.
            // Multiple may fire in one frame if slots freed en masse.
            var idx = 0;
            while (idx < pendingSpawns.length) {
              if (pendingSpawns[idx] <= 0
                  && totalInBuilding < totalCap
                  && queuedCount < getQueueCap()) {
                pendingSpawns.splice(idx, 1);
                // During initial burst: consume one entry from the shuffled plan so
                // diag / non-diag patients arrive mixed (3 bed + 3 diag, intermixed).
                var plannedDiag = null;
                if (initialPlan && initialPlan.length > 0 && initialSpawnCount < initialBurstTarget) {
                  plannedDiag = initialPlan.shift();
                }
                spawnPatient(false, null, plannedDiag);
                initialSpawnCount++;
                totalInBuilding++;
                queuedCount++;
                // Chain the next initial-burst spawn, if burst not complete.
                if (initialSpawnCount < initialBurstTarget) {
                  pendingSpawns.push(INITIAL_MIN + Math.random() * (INITIAL_MAX - INITIAL_MIN));
                }
              } else {
                idx++;
              }
            }

            prevTotalInBuilding = totalInBuilding;
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
      updateTreatHold(delta);
      updateAnimations(delta);
      updateIndicators();
      updateInteraction();
    }
  };
})();
