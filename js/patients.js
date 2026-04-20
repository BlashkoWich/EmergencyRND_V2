(function() {
  window.Game = window.Game || {};

  // --- Patient data pools ---
  var NAMES = Game.Lang.t('patients.names.male').concat(Game.Lang.t('patients.names.female'));
  var SURNAMES = Game.Lang.t('patients.surnames.male').concat(Game.Lang.t('patients.surnames.female'));
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

  var WALK_SPEED = { severe: 1.0, medium: 1.0, mild: 1.0, normal: 1.0 };

  var INJURY_POSES = {
    holdStomach: { hunch: 0.3, headDroop: 0.2, limp: false, lShoulder: -0.8, lElbow: -1.6, rShoulder: -0.8, rElbow: -1.6 },
    holdBack:    { hunch: 0.25, headDroop: 0.15, limp: true, lShoulder: 0.5, lElbow: -1.0, rShoulder: 0, rElbow: -0.3 },
    holdHead:    { hunch: 0.1, headDroop: 0.15, limp: false, lShoulder: -1.8, lElbow: -2.0, rShoulder: -1.8, rElbow: -2.0 },
    holdThroat:  { hunch: 0.15, headDroop: 0.2, limp: false, lShoulder: -1.4, lElbow: -2.2, rShoulder: 0, rElbow: 0 },
    limp:        { hunch: 0.12, headDroop: 0.08, limp: true, lShoulder: 0, lElbow: 0, rShoulder: 0, rElbow: 0 }
  };

  var INJURY_MAP = {
    painkiller:    ['holdStomach', 'holdBack', 'limp'],
    antihistamine: ['holdHead'],
    strepsils:     ['holdThroat']
  };

  var ILLNESS_REGION_MAP = Game.Lang.t('patients.illnessRegionMap');

  function getIllnessRegion(consumableType, diagnosis) {
    if (consumableType === 'antihistamine') return 'nose';
    var map = ILLNESS_REGION_MAP[consumableType];
    if (map && diagnosis && map[diagnosis]) return map[diagnosis];
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

  function getSeverityFactor(patient) {
    if (patient.anim.recovered) return 0;
    var key = patient.severity.key;
    if (key === 'severe') return 1.0;
    if (key === 'medium') return 0.5;
    return 0.15;
  }

  var SEVERITIES = [
    { key: 'severe', label: Game.Lang.t('severity.severe') },
    { key: 'medium', label: Game.Lang.t('severity.medium') },
    { key: 'mild',   label: Game.Lang.t('severity.mild') }
  ];

  var BASE_PRICES = { mild: 35, medium: 50, severe: 70 };
  var PRICE_VARIANCE = 5;
  var DIAGNOSIS_FEE = 15;

  // --- HP system (brought back) ---
  // Severity → initial HP + decay rate (HP/sec). HP decays uniformly in all
  // active states except recovering/discharged/atRegister/leaving, and is
  // paused while staff is diagnosing/treating the patient. HP ≤ 0 → patient lost.
  var HP_CONFIG = {
    mild:   { max: 100, start: 100, decay: 0.7 },
    medium: { max: 100, start: 85,  decay: 1.2 },
    severe: { max: 100, start: 70,  decay: 1.8 }
  };

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
  var PATIENT_SPEED = 3.5;
  var animations = [];

  // Smiley reaction textures
  var SMILEY_COUNT = 10;
  var SMILEY_LIFETIME = 1.4;
  var SMILEY_RISE = 0.5;
  var smileyTextures = null;
  var lastSmileyIndex = -1;
  var prevSmileyIndex = -2;

  // Slot-based auto-spawn (always active — no sequential/tutorial mode).
  var autoSpawnActive = false;
  var initialSpawnCount = 0;
  var initialBurstTarget = 0;
  var initialPlan = null;
  var pendingSpawns = [];
  var prevTotalInBuilding = 0;
  var INITIAL_MIN = 1, INITIAL_MAX = 3;
  var STEADY_MIN = 10, STEADY_MAX = 20;

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

  // Diag room slots
  var diagQueueSlots = [];
  var diagExamSlot = null;

  // Doorway waypoint for diag room routing
  function diagDoorWaypoint() { return new THREE.Vector3(-2.7, 0, -14.5); }

  // --- Interaction raycaster ---
  var interactRay;
  var screenCenter;

  // Horizontal queue in front of the reception desk (desk at z=-9).
  // Patients line up along X from x=-3.0 to the east, facing north (rotY = 0).
  // Only the head of the queue (index 0) is interactable.
  function getQueuePosition(index) {
    return new THREE.Vector3(-3.0 + index * 1.2, 0, -7.5);
  }

  function createPatientMesh() {
    var group = new THREE.Group();
    var bodyColor = BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];
    var bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    var skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
    var legMat = new THREE.MeshLambertMaterial({ color: 0x334455 });

    var poseContainer = new THREE.Group();
    group.add(poseContainer);

    var bodyContainer = new THREE.Group();
    poseContainer.add(bodyContainer);

    var body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.25), bodyMat);
    body.position.y = 0.85; body.castShadow = true; bodyContainer.add(body);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skinMat);
    head.position.y = 1.35; head.castShadow = true; bodyContainer.add(head);

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

    var ud = group.userData;
    ud.poseContainer = poseContainer;
    ud.bodyContainer = bodyContainer;
    ud.bodyMesh = body;
    ud.headMesh = head;
    ud.leftArm = leftArm;
    ud.rightArm = rightArm;
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

    function swell(mesh, factor) {
      mesh.scale.set(factor, factor, factor);
      ud.illnessVisuals.push({ mesh: mesh, parent: null, resetScale: true });
    }

    if (cType === 'antihistamine') {
      tintMaterial(patient, ud.headMesh, 0xff0000, 0.5 + 0.35 * sev);
      swell(ud.headMesh, 1.1 + 0.2 * sev);
      tintMaterial(patient, ud.leftArm.upperArm, 0xff3333, 0.3 + 0.3 * sev);
      tintMaterial(patient, ud.leftArm.forearm, 0xff3333, 0.3 + 0.3 * sev);
      tintMaterial(patient, ud.rightArm.upperArm, 0xff3333, 0.3 + 0.3 * sev);
      tintMaterial(patient, ud.rightArm.forearm, 0xff3333, 0.3 + 0.3 * sev);
    } else if (cType === 'painkiller') {
      if (region === 'head') {
        tintMaterial(patient, ud.headMesh, 0xff2222, 0.4 + 0.35 * sev);
        swell(ud.headMesh, 1.15 + 0.2 * sev);
      } else if (region === 'back') {
        tintMaterial(patient, ud.bodyMesh, 0xff3333, 0.3 + 0.3 * sev);
      } else if (region === 'leg') {
        var leftLeg = ud.leftLegPivot.children[0];
        var rightLeg = ud.rightLegPivot.children[0];
        var legSwell = 1.2 + 0.5 * sev;
        swell(leftLeg, legSwell);
        tintMaterial(patient, leftLeg, 0xcc3333, 0.3 + 0.25 * sev);
        tintMaterial(patient, rightLeg, 0xcc3333, 0.15 + 0.15 * sev);
      } else if (region === 'arm') {
        var forearm = ud.rightArm.forearm;
        var upperArm = ud.rightArm.upperArm;
        swell(forearm, 1.3 + 0.4 * sev);
        swell(upperArm, 1.15 + 0.25 * sev);
        tintMaterial(patient, forearm, 0xcc3333, 0.3 + 0.25 * sev);
        tintMaterial(patient, upperArm, 0xcc3333, 0.2 + 0.2 * sev);
        var bandage = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), whiteMat);
        bandage.position.set(0, -0.06, 0);
        bandage.castShadow = true;
        addIllnessMesh(patient, bandage, forearm);
      } else if (region === 'neck') {
        var brace = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 8), whiteMat);
        brace.position.set(0, 1.22, 0);
        brace.castShadow = true;
        addIllnessMesh(patient, brace, ud.bodyContainer);
      } else if (region === 'stomach') {
        tintMaterial(patient, ud.bodyMesh, 0x66cc33, 0.3 + 0.3 * sev);
        tintMaterial(patient, ud.headMesh, 0x88cc44, 0.2 + 0.25 * sev);
      } else if (region === 'teeth') {
        tintMaterial(patient, ud.headMesh, 0xff4444, 0.3 + 0.25 * sev);
        ud.headMesh.scale.set(1.15 + 0.15 * sev, 1, 1.1 + 0.1 * sev);
        ud.illnessVisuals.push({ mesh: ud.headMesh, parent: null, resetScale: true });
      } else if (region === 'chest') {
        tintMaterial(patient, ud.bodyMesh, 0xff2222, 0.3 + 0.3 * sev);
      } else if (region === 'fullBody') {
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
      var applyThroat = (region === 'throat' || region === 'both');
      var applyChest = (region === 'chest' || region === 'both');
      var im = region === 'both' ? 0.7 : 1.0;

      if (applyThroat) {
        var neckR = 0.1 + 0.05 * sev * im;
        var neckMat = new THREE.MeshLambertMaterial({ color: 0xcc4444 });
        var swollenNeck = new THREE.Mesh(new THREE.CylinderGeometry(neckR, 0.08, 0.12, 8), neckMat);
        swollenNeck.position.set(0, 1.22, 0);
        swollenNeck.castShadow = true;
        addIllnessMesh(patient, swollenNeck, ud.bodyContainer);
        tintMaterial(patient, ud.headMesh, 0xff3333, (0.25 + 0.3 * sev) * im);
      }
      if (applyChest) {
        tintMaterial(patient, ud.bodyMesh, 0xcc2222, (0.3 + 0.3 * sev) * im);
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

  // --- HP bar sprite ---
  function createHpBarSprite(patient) {
    var canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 18;
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.85, 0.13, 1);
    scene.add(sprite);
    patient.hpBar = sprite;
    patient.hpBarCanvas = canvas;
    patient.hpBarTexture = texture;
    patient._lastHpDraw = -1;
    drawHpBar(patient);
  }

  function drawHpBar(patient) {
    var canvas = patient.hpBarCanvas;
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 18);

    // Background
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 128, 18, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0, 0, 128, 18, 4);
    ctx.stroke();

    // HP fill
    var frac = Math.max(0, patient.hp / patient.maxHp);
    var color;
    if (frac > 0.6) color = '#44dd44';
    else if (frac > 0.3) color = '#ddcc44';
    else color = '#dd4444';

    var fillW = Math.max(0, Math.min(124, frac * 124));
    if (fillW > 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(2, 2, fillW, 14, 3);
      ctx.fill();
    }

    patient.hpBarTexture.needsUpdate = true;
  }

  function updateHpBar(patient) {
    if (!patient.hpBar) return;
    var isLying = patient.anim.pose === 'lying';
    patient.hpBar.position.x = patient.mesh.position.x;
    patient.hpBar.position.z = patient.mesh.position.z;
    patient.hpBar.position.y = isLying ? 1.6 : 2.25;

    var pctInt = Math.floor((patient.hp / patient.maxHp) * 100);
    if (pctInt !== patient._lastHpDraw) {
      patient._lastHpDraw = pctInt;
      drawHpBar(patient);
    }
  }

  function removeHpBar(patient) {
    if (patient.hpBar) {
      scene.remove(patient.hpBar);
      if (patient.hpBar.material.map) patient.hpBar.material.map.dispose();
      patient.hpBar.material.dispose();
      patient.hpBar = null;
      patient.hpBarCanvas = null;
      patient.hpBarTexture = null;
    }
  }

  // States where HP actively decays (everywhere except recovery/exit pipeline).
  function hpActive(state) {
    return state !== 'recovering'
      && state !== 'discharged'
      && state !== 'atRegister'
      && state !== 'leaving';
  }

  function spawnPatient(instant, explicitSeverityKey, explicitNeedsDiagnosis) {
    var mesh = createPatientMesh();
    mesh.position.set(0, 0, 1);
    scene.add(mesh);

    var consumableType = randomFrom(CONSUMABLE_KEYS);
    var data = MEDICAL_DATA[consumableType];
    var medCase = randomFrom(data.cases);
    var severity;
    if (explicitSeverityKey) {
      for (var si = 0; si < SEVERITIES.length; si++) {
        if (SEVERITIES[si].key === explicitSeverityKey) { severity = SEVERITIES[si]; break; }
      }
      if (!severity) severity = SEVERITIES[2];
    } else {
      var currentLevel = Game.Levels ? Game.Levels.getLevel() : 2;
      if (currentLevel === 2) {
        severity = Math.random() < 0.65 ? SEVERITIES[2] : SEVERITIES[1];
      } else {
        var roll = Math.random();
        severity = roll < 0.60 ? SEVERITIES[2] : roll < 0.85 ? SEVERITIES[1] : SEVERITIES[0];
      }
    }
    var diagChance = Game.Levels && Game.Levels.getDiagnosisChance ? Game.Levels.getDiagnosisChance() : 0.30;
    var needsDiagnosis;
    if (explicitNeedsDiagnosis !== null && explicitNeedsDiagnosis !== undefined) {
      needsDiagnosis = !!explicitNeedsDiagnosis;
    } else {
      needsDiagnosis = Math.random() < diagChance;
    }
    var isHealthy = needsDiagnosis && (Math.random() < 0.5);

    var requiredConsumables;
    if (severity.key === 'mild') {
      requiredConsumables = [consumableType];
    } else if (severity.key === 'medium') {
      var others = CONSUMABLE_KEYS.filter(function(k) { return k !== consumableType; });
      requiredConsumables = [consumableType, randomFrom(others)];
    } else {
      requiredConsumables = CONSUMABLE_KEYS.slice();
    }

    var procedureFee = BASE_PRICES[severity.key] + (Math.floor(Math.random() * (PRICE_VARIANCE * 2 + 1)) - PRICE_VARIANCE);

    var hpCfg = HP_CONFIG[severity.key];

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
      lost: false,
      procedureFee: procedureFee,
      treatmentFee: 0,
      paymentInfo: null,
      diagQueueSlot: null,
      diagExamSlot: null,
      hp: hpCfg.start,
      maxHp: hpCfg.max,
      hpDecayRate: hpCfg.decay,
      hpBar: null,
      hpBarCanvas: null,
      hpBarTexture: null,
      _lastHpDraw: -1,
      staffProcessing: false,
      staffDiagnosing: false,
      staffTreating: false,
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
    createHpBarSprite(patient);

    if (instant && patient.queueTarget) {
      mesh.position.copy(patient.queueTarget);
      mesh.rotation.y = 0;
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

    popupName.textContent = patient.name + ' ' + patient.surname;
    popupAge.textContent = Game.Lang.t('patient.age', [patient.age]);

    var sevColors = { severe: '#ff4444', medium: '#ffcc00', mild: '#44cc44' };
    popupSeverity.textContent = patient.severity.label;
    popupSeverity.style.color = sevColors[patient.severity.key] || '#7abfff';
    popupSeverityBand.className = patient.severity.key;

    var v = patient.vitals;
    popupTemp.textContent = v.temp.toFixed(1) + '\u00B0C';
    popupTemp.className = 'vital-value' + (v.temp >= 39.0 ? ' vital-critical' : v.temp >= 37.5 ? ' vital-warning' : '');
    popupPulse.textContent = Game.Lang.t('patient.pulse', [v.pulse]);
    popupPulse.className = 'vital-value' + (v.pulse >= 110 ? ' vital-critical' : v.pulse >= 90 ? ' vital-warning' : '');
    popupBp.textContent = v.bpSys + '/' + v.bpDia;
    popupBp.className = 'vital-value' + (v.bpSys >= 160 ? ' vital-critical' : v.bpSys >= 140 ? ' vital-warning' : '');

    popupComplaint.textContent = '\u00AB' + patient.complaint + '\u00BB';

    var popupInstrumentHint = document.getElementById('popup-instrument-hint');

    if (patient.needsDiagnosis) {
      popupDiagnosis.textContent = '????';
      popupDiagnosis.style.color = '#ff4444';
      popupSupply.textContent = '????';
      popupSupply.style.color = '#ff4444';
      popupSupplyIcon.style.display = 'none';
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
        var c2 = typeInfo.color;
        popupSupplyIcon.style.backgroundColor = 'rgb(' + ((c2 >> 16) & 255) + ',' + ((c2 >> 8) & 255) + ',' + (c2 & 255) + ')';
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

    btnBed.style.display = '';
    btnWait.style.display = '';
    btnDiag.style.display = '';
    btnReject.style.display = '';

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

    var popupError = document.getElementById('popup-error');
    if (popupError) popupError.style.display = 'none';

    var outdoorWarning = document.getElementById('outdoor-warning');
    if (outdoorBedCount > 0 || outdoorChairCount > 0) {
      outdoorWarning.textContent = Game.Lang.t('patient.outdoorWarning');
      outdoorWarning.style.display = 'block';
    } else {
      outdoorWarning.style.display = 'none';
    }

    var brokenWarning = document.getElementById('broken-bed-warning');
    var brokenBedCount = Game.Furniture.getBrokenBedCount();
    if (brokenBedCount > 0) {
      brokenWarning.textContent = Game.Lang.t(brokenBedCount === 1 ? 'patient.brokenWarning1' : 'patient.brokenWarningN', [brokenBedCount]);
      brokenWarning.style.display = 'block';
    } else {
      brokenWarning.style.display = 'none';
    }

    controls.unlock();
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
    patient.state = patient._wasWaiting ? 'waiting' : 'queued';
    closePopup();
  }

  function sendPatient(patient, dest, slot) {
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
    ctx.save();
    if (type === 'strepsils') {
      ctx.fillStyle = '#cc3333';
      ctx.beginPath(); ctx.roundRect(10, 20, 44, 24, 4); ctx.fill();
      ctx.fillStyle = '#ee5555';
      for (var row = 0; row < 2; row++) {
        for (var col = 0; col < 3; col++) {
          ctx.beginPath();
          ctx.arc(19 + col * 13, 27 + row * 11, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'painkiller') {
      ctx.fillStyle = '#3366cc';
      ctx.beginPath(); ctx.roundRect(20, 14, 24, 38, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.roundRect(18, 10, 28, 10, 2); ctx.fill();
      ctx.fillStyle = '#dde';
      ctx.beginPath(); ctx.roundRect(23, 30, 18, 12, 2); ctx.fill();
      ctx.fillStyle = '#3366cc';
      ctx.font = 'bold 9px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Rx', 32, 37);
    } else if (type === 'antihistamine') {
      ctx.fillStyle = '#33aa55';
      ctx.beginPath(); ctx.roundRect(12, 12, 40, 40, 4); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.roundRect(26, 16, 12, 32, 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(16, 26, 32, 12, 2); ctx.fill();
    } else if (type === 'instrument_stethoscope') {
      ctx.strokeStyle = '#8866cc';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(32, 48); ctx.lineTo(32, 28); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(32, 28); ctx.lineTo(22, 18);
      ctx.moveTo(32, 28); ctx.lineTo(42, 18);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(32, 50, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#aaa'; ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.arc(20, 16, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(44, 16, 3, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'instrument_hammer') {
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(32, 20); ctx.lineTo(32, 50); ctx.stroke();
      ctx.fillStyle = '#cc8844';
      ctx.beginPath(); ctx.ellipse(32, 18, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#aa6622';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (type === 'instrument_rhinoscope') {
      ctx.fillStyle = '#44aacc';
      ctx.beginPath(); ctx.roundRect(26, 20, 12, 28, 2); ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.roundRect(25, 42, 14, 10, 2); ctx.fill();
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(26, 20); ctx.lineTo(38, 20); ctx.lineTo(32, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffaa';
      ctx.beginPath(); ctx.arc(32, 12, 3, 0, Math.PI * 2); ctx.fill();
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
      var s = createSingleIndicatorSprite(type);
      var offsetX = (i - (count - 1) / 2) * 0.45;
      s.position.copy(patient.mesh.position);
      s.position.x += offsetX;
      s.position.y = 2.0;
      scene.add(s);
      patient.indicators.push(s);
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

    var hunch = pose.hunch * sev;
    ud.bodyMesh.rotation.x = hunch;
    ud.bodyMesh.rotation.y = 0;
    ud.bodyMesh.rotation.z = 0;
    ud.bodyMesh.position.y = 0.85;

    ud.headMesh.rotation.x = pose.headDroop * sev;

    var legAmp = LEG_SWING * wb;
    if (pose.limp && sev > 0.1) {
      ud.leftLegPivot.rotation.x = sinPh * legAmp;
      ud.rightLegPivot.rotation.x = Math.sin(ph + Math.PI + 0.5 * sev) * legAmp * (1 - 0.4 * sev);
    } else {
      ud.leftLegPivot.rotation.x = sinPh * legAmp;
      ud.rightLegPivot.rotation.x = sinPhOpp * legAmp;
    }

    var normalLShoulderX = sinPhOpp * ARM_SWING * wb;
    var normalRShoulderX = sinPh * ARM_SWING * wb;
    var normalLElbowX = Math.min(0, sinPhOpp) * ELBOW_SWING * wb;
    var normalRElbowX = Math.min(0, sinPh) * ELBOW_SWING * wb;

    var injLShoulder = pose.lShoulder * sev;
    var injLElbow = pose.lElbow * sev;
    var injRShoulder = pose.rShoulder * sev;
    var injRElbow = pose.rElbow * sev;

    var sway = sinPh * 0.04 * sev;
    ud.leftArm.shoulderPivot.rotation.x = lerp(normalLShoulderX, injLShoulder, sev) + sway;
    ud.leftArm.elbowPivot.rotation.x = lerp(normalLElbowX, injLElbow, sev);
    ud.rightArm.shoulderPivot.rotation.x = lerp(normalRShoulderX, injRShoulder, sev) + sway;
    ud.rightArm.elbowPivot.rotation.x = lerp(normalRElbowX, injRElbow, sev);

    ud.leftArm.shoulderPivot.rotation.z = 0;
    ud.rightArm.shoulderPivot.rotation.z = 0;
  }

  function updatePoseTransition(patient, delta) {
    var anim = patient.anim;
    if (anim.pose === anim.targetPose && anim.poseTransition >= 1) return;

    if (anim.pose !== anim.targetPose) {
      anim.poseFrom = anim.pose;
      anim.pose = anim.targetPose;
      anim.poseTransition = 0;

      if (anim.pose === 'lying' && patient.destination) {
        var bedPos = patient.destination.pos;
        anim.bedTargetX = bedPos.x - 1.0;
        anim.bedTargetZ = bedPos.z;
        anim.bedStartX = patient.mesh.position.x;
        anim.bedStartZ = patient.mesh.position.z;
        anim.bedStartRotY = patient.mesh.rotation.y;
        anim.bedTargetRotY = Math.PI / 2;
      }
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

    ud.poseContainer.rotation.x = lerp(from.poseRotX, to.poseRotX, t);
    ud.poseContainer.position.y = lerp(from.posePosY, to.posePosY, t);
    ud.poseContainer.position.z = lerp(from.posePosZ, to.posePosZ, t);

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

    ud.bodyContainer.position.y = lerp(from.bodyOffsetY, to.bodyOffsetY, t);

    var legY = lerp(from.legPivotY, to.legPivotY, t);
    ud.leftLegPivot.position.y = legY;
    ud.rightLegPivot.position.y = legY;

    ud.leftLegPivot.rotation.x = lerp(from.legRotX, to.legRotX, t);
    ud.rightLegPivot.rotation.x = lerp(from.legRotX, to.legRotX, t);

    ud.leftArmPivot.rotation.z = lerp(from.leftArmRotZ, to.leftArmRotZ, t);
    ud.rightArmPivot.rotation.z = lerp(from.rightArmRotZ, to.rightArmRotZ, t);

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

  // --- Treatment (staff-driven only) ---
  function applyOneConsumable(patient, consumableType) {
    var idx = patient.pendingConsumables.indexOf(consumableType);
    if (idx !== -1) patient.pendingConsumables.splice(idx, 1);
    removeOneIndicator(patient, consumableType);

    patient.animating = true;

    if (patient.pendingConsumables.length === 0) {
      // All meds applied — schedule auto-discharge after heal animation.
      patient.treated = true;
      Game.Inventory.showNotification(Game.Lang.t('notify.treatmentStarted'), 'rgba(34, 139, 34, 0.85)');
      for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
        var part = patient.mesh.userData.bodyParts[j];
        part.material.emissive = new THREE.Color(0x00ff44);
        part.material.emissiveIntensity = 0.8;
      }
      animations.push({ patient: patient, type: 'heal', timer: 0.5, maxTime: 0.5, autoDischarge: true });
    } else {
      Game.Inventory.showNotification(Game.Lang.t('notify.medicineApplied', [patient.pendingConsumables.length]), 'rgba(70, 130, 180, 0.85)');
      for (var k = 0; k < patient.mesh.userData.bodyParts.length; k++) {
        var p2 = patient.mesh.userData.bodyParts[k];
        p2.material.emissive = new THREE.Color(0x4488ff);
        p2.material.emissiveIntensity = 0.5;
      }
      animations.push({ patient: patient, type: 'heal', timer: 0.3, maxTime: 0.3 });
    }
    spawnSmileyReaction(patient);
  }

  // --- Smiley reactions ---
  function drawSmileyBase(ctx) {
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

  function drawSmileyVariant(ctx, i) {
    drawSmileyBase(ctx);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#1a1a1a';
    if (i === 0) {
      drawSimpleEyes(ctx);
      ctx.beginPath(); ctx.arc(32, 34, 10, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 1) {
      drawSimpleEyes(ctx);
      ctx.fillStyle = '#3a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 8, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(25, 36, 14, 3);
    } else if (i === 2) {
      ctx.fillStyle = '#ff4070';
      drawHeart(ctx, 22, 26, 6);
      drawHeart(ctx, 42, 26, 6);
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 8, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 3) {
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(22, 26, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(38, 26); ctx.lineTo(46, 26); ctx.stroke();
      ctx.beginPath(); ctx.arc(32, 36, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 4) {
      drawSimpleEyes(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(22, 36, 20, 8);
      ctx.strokeRect(22, 36, 20, 8);
      ctx.beginPath(); ctx.moveTo(27, 36); ctx.lineTo(27, 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(32, 36); ctx.lineTo(32, 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(37, 36); ctx.lineTo(37, 44); ctx.stroke();
    } else if (i === 5) {
      drawSimpleEyes(ctx);
      ctx.beginPath(); ctx.arc(32, 36, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#ff5a8a';
      ctx.beginPath(); ctx.ellipse(32, 44, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.stroke();
    } else if (i === 6) {
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(22, 27, 4, Math.PI, 0, true); ctx.stroke();
      ctx.beginPath(); ctx.arc(42, 27, 4, Math.PI, 0, true); ctx.stroke();
      ctx.beginPath(); ctx.arc(32, 36, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (i === 7) {
      drawStar(ctx, 22, 26, 5, '#ffcf3a');
      drawStar(ctx, 42, 26, 5, '#ffcf3a');
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (i === 8) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(12, 22, 18, 8);
      ctx.fillRect(34, 22, 18, 8);
      ctx.fillRect(30, 25, 4, 2);
      ctx.beginPath(); ctx.arc(32, 38, 8, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else {
      ctx.fillStyle = '#ff9eb5';
      ctx.beginPath(); ctx.arc(17, 38, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(47, 38, 4, 0, Math.PI * 2); ctx.fill();
      drawSimpleEyes(ctx);
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(32, 36, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
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

  // --- Diagnostic routing ---
  function startWalk(patient, waypoints) {
    if (!waypoints || waypoints.length === 0) return;
    patient.targetPos = waypoints[0].clone();
    patient.walkPath = waypoints.length > 1 ? waypoints.slice(1).map(function(v){ return v.clone(); }) : null;
  }

  function sendPatientToDiagnostics(patient) {
    if (diagExamSlot && !diagExamSlot.occupied) {
      diagExamSlot.occupied = true;
      patient.diagExamSlot = diagExamSlot;
      patient.state = 'walkingToDiagExam';
      startWalk(patient, [diagDoorWaypoint(), diagExamSlot.pos]);
      patient.anim.targetPose = 'standing';
      removeFromQueue(patient);
      closePopup();
      return;
    }
    var qslot = findFreeDiagQueueSlot();
    if (!qslot) return;
    qslot.occupied = true;
    patient.diagQueueSlot = qslot;
    patient.state = 'walkingToDiagQueue';
    startWalk(patient, [qslot.pos]);
    patient.anim.targetPose = 'standing';
    removeFromQueue(patient);
    closePopup();
  }

  function rejectPatient(patient) {
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
    if (!diagExamSlot || diagExamSlot.occupied) return;
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      if (p.state === 'inDiagQueue') {
        if (p.diagQueueSlot) { p.diagQueueSlot.occupied = false; p.diagQueueSlot = null; }
        diagExamSlot.occupied = true;
        p.diagExamSlot = diagExamSlot;
        p.state = 'walkingToDiagExam';
        startWalk(p, [diagDoorWaypoint(), diagExamSlot.pos]);
        p.anim.targetPose = 'standing';
        return;
      }
    }
  }

  // --- Auto-routing after staff diagnosis (no popup shown) ---
  // Called by staff.js::updateDiagnostician when diagnosis completes.
  // For healthy patients: set payment and send to cashier.
  // For sick patients: reveal diagnosis, then route to bed (free) or waiting chair.
  // If nothing is free — patient stays on exam-slot and will be picked up next tick.
  function autoRouteAfterDiag(patient) {
    patient.wasDiagnosed = true;
    patient.needsDiagnosis = false;

    if (patient.isHealthy) {
      patient.treatmentFee = 0;
      patient.requiredConsumables = [];
      patient.pendingConsumables = [];
      removeIllnessVisuals(patient);
      removeAllIndicators(patient);
      freeExamSlot(patient);
      patient.homeSent = true;
      patient.paymentInfo = {
        procedure: patient.procedureFee,
        treatment: 0,
        total: patient.procedureFee,
        reason: 'home-healthy'
      };
      patient.anim.recovered = true;
      patient.anim.targetPose = 'standing';
      if (Game.Shift) Game.Shift.trackPatientServed();
      Game.Cashier.addPatientToQueue(patient);
      if (patient.targetPos) {
        var finalCashierPos = patient.targetPos.clone();
        startWalk(patient, [diagDoorWaypoint(), finalCashierPos]);
      }
      return;
    }

    // Sick: reveal, then route.
    revealDiagnosis(patient);
    patient.treatmentFee = DIAGNOSIS_FEE;

    // Prefer a free indoor bed.
    var indoorBeds = Game.Furniture.getIndoorBeds();
    for (var i = 0; i < indoorBeds.length; i++) {
      if (!indoorBeds[i].occupied && !Game.Furniture.isBedBroken(indoorBeds[i])) {
        freeExamSlot(patient);
        patient.state = 'walking';
        var bedTarget = indoorBeds[i].pos.clone();
        bedTarget.y = 0;
        startWalk(patient, [diagDoorWaypoint(), bedTarget]);
        patient.destination = indoorBeds[i];
        indoorBeds[i].occupied = true;
        patient.anim.targetPose = 'standing';
        return;
      }
    }

    // Else: waiting chair.
    var indoorChairs = Game.Furniture.getIndoorChairs();
    for (var j = 0; j < indoorChairs.length; j++) {
      if (!indoorChairs[j].occupied) {
        freeExamSlot(patient);
        patient.state = 'walking';
        var chairTarget = indoorChairs[j].pos.clone();
        chairTarget.y = 0;
        startWalk(patient, [diagDoorWaypoint(), chairTarget]);
        patient.destination = indoorChairs[j];
        indoorChairs[j].occupied = true;
        patient.anim.targetPose = 'standing';
        return;
      }
    }

    // Nothing free: patient stays on exam-slot (awaitingDiagDecision-like holding pattern).
    // The slot is still occupied; auto-promote function will pick them up later.
    patient.state = 'awaitingAutoRoute';
  }

  // When a bed frees up, pull diagnosed patients from waiting chairs or
  // exam-slot holding pattern onto it (sickest/lowest HP first).
  function autoPromoteWaitingToBed() {
    var indoorBeds = Game.Furniture.getIndoorBeds();
    for (var i = 0; i < indoorBeds.length; i++) {
      var bed = indoorBeds[i];
      if (bed.occupied || Game.Furniture.isBedBroken(bed)) continue;

      // Find sickest diagnosed patient sitting in waiting or on exam-slot awaiting route
      var best = null;
      var bestHp = Infinity;
      for (var j = 0; j < patients.length; j++) {
        var p = patients[j];
        if (p.treated || p.lost) continue;
        if (!p.requiredConsumables || p.requiredConsumables.length === 0) continue;
        if (p.state === 'waiting' || p.state === 'awaitingAutoRoute') {
          if (p.hp < bestHp) { bestHp = p.hp; best = p; }
        }
      }
      if (!best) continue;

      // Transfer best → bed
      if (best.state === 'waiting' && best.destination) {
        best.destination.occupied = false;
      }
      if (best.state === 'awaitingAutoRoute') {
        freeExamSlot(best);
      }
      best.state = 'walking';
      var target = bed.pos.clone();
      target.y = 0;
      // If patient is in the diag room, route through doorway
      if (best.mesh.position.x < -3) {
        startWalk(best, [diagDoorWaypoint(), target]);
      } else {
        startWalk(best, [target]);
      }
      best.destination = bed;
      bed.occupied = true;
      best.anim.targetPose = 'standing';
    }
  }

  function freeExamSlot(patient) {
    if (patient.diagExamSlot) {
      patient.diagExamSlot.occupied = false;
      patient.diagExamSlot = null;
    }
    advanceDiagQueue();
  }

  function dischargePatient(patient) {
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
    if (Game.Shift) Game.Shift.trackPatientServed();
    Game.Cashier.addPatientToQueue(patient);
  }

  // HP ≤ 0: mark lost, free slots, walk to exit without paying.
  function losePatient(patient) {
    if (patient.lost) return;
    patient.lost = true;
    patient.hp = 0;

    // Clear staff flags — staff update loops will abort on next tick.
    patient.staffProcessing = false;
    patient.staffDiagnosing = false;
    patient.staffTreating = false;

    // Free all slots
    removeFromQueue(patient);
    if (patient.destination) {
      patient.destination.occupied = false;
      patient.destination = null;
    }
    if (patient.diagQueueSlot) { patient.diagQueueSlot.occupied = false; patient.diagQueueSlot = null; }
    if (patient.diagExamSlot) { patient.diagExamSlot.occupied = false; patient.diagExamSlot = null; }

    removeAllIndicators(patient);
    removeIllnessVisuals(patient);

    if (Game.Shift) Game.Shift.trackPatientLost();
    Game.Inventory.showNotification(Game.Lang.t('notify.patientLeft'));

    // Red flash + walk to exit
    patient.animating = true;
    for (var j = 0; j < patient.mesh.userData.bodyParts.length; j++) {
      var part = patient.mesh.userData.bodyParts[j];
      part.material.emissive = new THREE.Color(0xff2222);
      part.material.emissiveIntensity = 0.5;
    }
    animations.push({ patient: patient, type: 'shake', timer: 0.3, maxTime: 0.3, originX: patient.mesh.position.x });

    patient.state = 'leaving';
    patient.leavePhase = 'toExit';
    patient.targetPos = new THREE.Vector3(0, 0, 1);
    patient.anim.targetPose = 'standing';

    // If patient was in diag room, route through doorway
    if (patient.mesh.position.x < -3) {
      startWalk(patient, [diagDoorWaypoint(), new THREE.Vector3(0, 0, 1)]);
    }

    advanceDiagQueue();
  }

  function removePatient(patient) {
    removeIllnessVisuals(patient);
    removeAllIndicators(patient);
    removeHpBar(patient);
    scene.remove(patient.mesh);
    if (patient.destination) {
      patient.destination.occupied = false;
      if (Game.Furniture.isBedSlot(patient.destination)) {
        Game.Furniture.decrementBedHp(patient.destination);
      }
    }
    if (patient.diagQueueSlot) { patient.diagQueueSlot.occupied = false; patient.diagQueueSlot = null; }
    if (patient.diagExamSlot) { patient.diagExamSlot.occupied = false; patient.diagExamSlot = null; }
    var idx = patients.indexOf(patient);
    if (idx !== -1) patients.splice(idx, 1);
    var qIdx = queue.indexOf(patient);
    if (qIdx !== -1) { queue.splice(qIdx, 1); updateQueueTargets(); }
    if (hoveredPatient === patient) hoveredPatient = null;
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
          for (var k = 0; k < anim.patient.mesh.userData.bodyParts.length; k++) {
            var part = anim.patient.mesh.userData.bodyParts[k];
            part.material.emissive.setHex(0x000000);
            part.material.emissiveIntensity = 0;
          }
          anim.patient.animating = false;
          if (anim.patient.treated) {
            removeAllIndicators(anim.patient);
          }
          if (anim.autoDischarge && anim.patient.treated && patients.indexOf(anim.patient) !== -1) {
            // All meds applied — go straight to cashier (no popup).
            var total = anim.patient.procedureFee + (anim.patient.wasDiagnosed ? anim.patient.treatmentFee : 0);
            anim.patient.paymentInfo = {
              procedure: anim.patient.procedureFee,
              treatment: anim.patient.wasDiagnosed ? anim.patient.treatmentFee : 0,
              total: total,
              reason: 'discharged'
            };
            dischargePatient(anim.patient);
          }
          animations.splice(i, 1);
        }
      } else if (anim.type === 'smiley') {
        var patientAlive = anim.patient && patients.indexOf(anim.patient) !== -1;
        if (!patientAlive || anim.timer <= 0) {
          scene.remove(anim.sprite);
          if (anim.sprite.material) anim.sprite.material.dispose();
          animations.splice(i, 1);
          continue;
        }
        var tS = 1 - (anim.timer / anim.maxTime);
        var scaleS = tS < 0.15 ? (tS / 0.15) * 0.55 : 0.55;
        anim.sprite.position.x = anim.patient.mesh.position.x;
        anim.sprite.position.z = anim.patient.mesh.position.z;
        anim.sprite.position.y = anim.baseY + tS * SMILEY_RISE;
        anim.sprite.material.opacity = tS < 0.7 ? 1 : Math.max(0, 1 - (tS - 0.7) / 0.3);
        anim.sprite.scale.set(scaleS, scaleS, 1);
      } else if (anim.type === 'shake') {
        var progress = 1 - (anim.timer / anim.maxTime);
        var offset = Math.sin(progress * Math.PI * 8) * 0.05 * (1 - progress);
        anim.patient.mesh.position.x = anim.originX + offset;

        var redIntensity = Math.max(0, anim.timer / anim.maxTime) * 0.5;
        for (var m = 0; m < anim.patient.mesh.userData.bodyParts.length; m++) {
          anim.patient.mesh.userData.bodyParts[m].material.emissiveIntensity = redIntensity;
        }

        if (anim.timer <= 0) {
          anim.patient.mesh.position.x = anim.originX;
          for (var n = 0; n < anim.patient.mesh.userData.bodyParts.length; n++) {
            var p3 = anim.patient.mesh.userData.bodyParts[n];
            p3.material.emissive.setHex(0x000000);
            p3.material.emissiveIntensity = 0;
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

      // HP decay — pauses while staff is helping this patient.
      if (hpActive(p.state) && !p.lost && !p.treated) {
        var hpPaused = p.staffDiagnosing || p.staffTreating;
        if (!hpPaused) {
          p.hp -= p.hpDecayRate * delta;
          if (p.hp <= 0) {
            losePatient(p);
            continue;
          }
        }
      }

      if (p.state === 'queued' && p.queueTarget) {
        var qDx = p.queueTarget.x - p.mesh.position.x;
        var qDz = p.queueTarget.z - p.mesh.position.z;
        isMoving = (qDx * qDx + qDz * qDz) > 0.01;
        moveToward(p.mesh.position, p.queueTarget, speed);
        // Horizontal queue: face north (rotY = 0) toward reception desk
        p.mesh.rotation.y = 0;
      }
      if (p.state === 'walking' && p.targetPos) {
        var arrived = moveToward(p.mesh.position, p.targetPos, speed);
        var dir = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
        isMoving = !arrived;
        if (arrived && p.walkPath && p.walkPath.length > 0) {
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
          p.mesh.rotation.y = 0;
          advanceDiagQueue();
        }
      }
      if (p.state === 'walkingToDiagExam' && p.targetPos) {
        var arrivedE = moveToward(p.mesh.position, p.targetPos, speed);
        var dirE = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dirE.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dirE.x, dirE.z);
        }
        isMoving = !arrivedE;
        if (arrivedE && p.walkPath && p.walkPath.length > 0) {
          p.targetPos = p.walkPath.shift();
          if (p.walkPath.length === 0) p.walkPath = null;
          arrivedE = false;
          isMoving = true;
        }
        if (arrivedE) {
          p.state = 'atDiagExam';
          p.targetPos = null;
          p.anim.targetPose = 'sitting';
          p.mesh.rotation.y = Math.PI;
          createBedIndicators(p);
        }
      }
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
      if (p.state === 'leaving' && p.targetPos) {
        var dir3 = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir3.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir3.x, dir3.z);
        }
        var arrived3 = moveToward(p.mesh.position, p.targetPos, speed);
        isMoving = true;
        if (arrived3 && p.walkPath && p.walkPath.length > 0) {
          p.targetPos = p.walkPath.shift();
          if (p.walkPath.length === 0) p.walkPath = null;
        } else if (arrived3) {
          if (p.leavePhase === 'toExit') {
            p.leavePhase = 'toStreet';
            p.targetPos = new THREE.Vector3(0, 0, 25);
          }
        }
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
          if (p.hpBar) p.hpBar.material.opacity = opacity;
          if (opacity <= 0) {
            removePatient(p);
            continue;
          }
        }
      }

      updateWalkAnimation(p, delta, isMoving);
      updatePoseTransition(p, delta);
      updateHpBar(p);
    }

    // Auto-promote diagnosed patients from waiting/holding to free beds.
    autoPromoteWaitingToBed();
  }

  function revealDiagnosis(patient) {
    patient.wasDiagnosed = true;
    patient.needsDiagnosis = false;
    patient.symptom = null;
    patient.diagnosis = patient.hiddenDiagnosis;
    patient.requiredConsumable = patient.hiddenConsumable;
    patient.requiredInstrument = null;

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

    removeAllIndicators(patient);
    Game.Inventory.showNotification(Game.Lang.t('notify.diagnosisSet'), 'rgba(34, 139, 34, 0.85)');
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
    autoRouteAfterDiag: function(patient) { autoRouteAfterDiag(patient); },

    // Staff APIs
    getPatients: function() { return patients; },
    getQueue: function() { return queue; },
    sendPatientByStaff: function(patient, dest, slot) {
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
      removeFromQueue(patient);
      patient.state = 'queued';
      patient.queueTarget = new THREE.Vector3(deskPos.x, 0, deskPos.z);
    },
    treatPatientByStaff: function(patient, consumableType) {
      if (!patient || patient.treated || patient.lost) return;
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

      // Click to interact — only head of queue is clickable.
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (popupPatient) return;
        if (!hoveredPatient) return;

        if (hoveredPatient.staffProcessing) {
          Game.Inventory.showNotification(Game.Lang.t('notify.adminProcessing'));
          return;
        }

        openPopup(hoveredPatient);
      });

      // Popup buttons
      btnBed.addEventListener('click', function() {
        if (!popupPatient) return;
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
      });

      btnWait.addEventListener('click', function() {
        if (!popupPatient) return;
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
        if (!popupPatient.needsDiagnosis) {
          showPopupError(Game.Lang.t('popup.err.noDiagnosisNeeded'));
          return;
        }
        sendPatientToDiagnostics(popupPatient);
      });

      btnReject.addEventListener('click', function() {
        if (!popupPatient) return;
        rejectPatient(popupPatient);
      });

      var popupCloseBtn = document.getElementById('popup-close');
      if (popupCloseBtn) {
        popupCloseBtn.addEventListener('click', function() {
          if (!popupPatient) return;
          deferPatientPopup(popupPatient);
        });
      }

      // Register with central interaction system — only head-of-queue is clickable.
      // Patients at beds/waiting/exam are NOT interactive (visible HP bar only).
      Game.Interaction.register('patients', function() {
        var meshes = [];
        if (queue.length > 0) {
          var head = queue[0];
          if (!head.animating && (head.state === 'queued' || head.state === 'interacting')) {
            meshes.push(head.mesh);
          }
        }
        return meshes;
      }, true, 5);
    },

    startWaveSystem: function() {
      autoSpawnActive = true;
      initialSpawnCount = 0;
      var bedCount = Game.Furniture.getAllBeds().length;
      var diagCount = diagQueueSlots.length;
      initialBurstTarget = bedCount + diagCount;

      initialPlan = [];
      for (var ib = 0; ib < bedCount; ib++) initialPlan.push(false);
      for (var id = 0; id < diagCount; id++) initialPlan.push(true);
      for (var k = initialPlan.length - 1; k > 0; k--) {
        var r = Math.floor(Math.random() * (k + 1));
        var tmp = initialPlan[k]; initialPlan[k] = initialPlan[r]; initialPlan[r] = tmp;
      }

      pendingSpawns = [0];
      prevTotalInBuilding = 0;
    },

    onPatientPaid: function() {
      // Slot-based auto-spawn handles refills reactively — nothing to do here.
    },

    clearAll: function() {
      for (var i = patients.length - 1; i >= 0; i--) {
        var p = patients[i];
        removeIllnessVisuals(p);
        removeAllIndicators(p);
        removeHpBar(p);
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
      autoSpawnActive = false;
      initialSpawnCount = 0;
      initialBurstTarget = 0;
      initialPlan = null;
      pendingSpawns = [];
      prevTotalInBuilding = 0;
    },

    update: function(delta) {
      if (Game.Shift && Game.Shift.isOpen()) {
        if (autoSpawnActive) {
          var totalCap = Game.Furniture.getAllBeds().length
                       + Game.Furniture.getAllChairs().length
                       + diagQueueSlots.length
                       + (diagExamSlot ? 1 : 0);

          var totalInBuilding = 0;
          var queuedCount = 0;
          for (var i = 0; i < patients.length; i++) {
            var st = patients[i].state;
            if (st === 'atRegister' || st === 'leaving' || st === 'discharged') continue;
            totalInBuilding++;
            if (st === 'queued' || st === 'interacting') queuedCount++;
          }

          if (initialSpawnCount >= initialBurstTarget) {
            var targetFill = Math.ceil(totalCap * 0.8);

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

            var deficit = targetFill - totalInBuilding - pendingSpawns.length;
            for (var d = 0; d < deficit; d++) {
              pendingSpawns.push(0.5 + Math.random() * 2.0);
            }
          }

          for (var t = 0; t < pendingSpawns.length; t++) {
            pendingSpawns[t] -= delta;
          }

          var idx = 0;
          while (idx < pendingSpawns.length) {
            if (pendingSpawns[idx] <= 0
                && totalInBuilding < totalCap
                && queuedCount < getQueueCap()) {
              pendingSpawns.splice(idx, 1);
              var plannedDiag = null;
              if (initialPlan && initialPlan.length > 0 && initialSpawnCount < initialBurstTarget) {
                plannedDiag = initialPlan.shift();
              }
              spawnPatient(false, null, plannedDiag);
              initialSpawnCount++;
              totalInBuilding++;
              queuedCount++;
              if (initialSpawnCount < initialBurstTarget) {
                pendingSpawns.push(INITIAL_MIN + Math.random() * (INITIAL_MAX - INITIAL_MIN));
              }
            } else {
              idx++;
            }
          }

          prevTotalInBuilding = totalInBuilding;
        }
      }

      updatePatients(delta);
      updateAnimations(delta);
      updateIndicators();
      updateInteraction();
    }
  };
})();
