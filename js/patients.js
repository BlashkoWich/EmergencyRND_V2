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

  var BODY_COLORS = [0x4477aa, 0x44aa77, 0xaa7744, 0x7744aa, 0xaa4466, 0x5599bb, 0x88aa44];

  // Preferred-tier distribution for spawn: basic 60%, improved 30%, vip 10%.
  function rollPreferredTier() {
    var r = Math.random();
    if (r < 0.60) return 'basic';
    if (r < 0.90) return 'improved';
    return 'vip';
  }

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
  var waitingChairs;
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
    var beds = Game.Wards ? Game.Wards.getTotalCapacity() : 0;
    var waits = Game.Furniture ? Game.Furniture.getIndoorChairs().length : 3;
    return beds + waits;
  }

  // --- UI elements ---
  var hintEl, popupEl, popupName;
  var popupSeverityBand;
  var popupTier;
  var btnWait, btnReject, chairCount;
  var wardsContainer;
  var wardButtons = {}; // wardId -> { btnEl, labelEl, priceEl, countEl }

  // --- Interaction raycaster ---
  var interactRay;
  var screenCenter;

  // Vertical queue in front of the reception desk (desk at z=-9).
  // Index 0 (head) is closest to the desk; subsequent patients line up southward.
  // Any patient in the queue is clickable (player can examine any one).
  function getQueuePosition(index) {
    return new THREE.Vector3(0, 0, -7.5 + index * 1.2);
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

    var cType = patient.requiredConsumable;
    var diag = patient.diagnosis;
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


  function spawnPatient(instant, explicitSeverityKey, explicitPreferredTier) {
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

    var preferredTier = explicitPreferredTier || rollPreferredTier();

    var requiredConsumables;
    if (severity.key === 'mild') {
      requiredConsumables = [consumableType];
    } else if (severity.key === 'medium') {
      var others = CONSUMABLE_KEYS.filter(function(k) { return k !== consumableType; });
      requiredConsumables = [consumableType, randomFrom(others)];
    } else {
      requiredConsumables = CONSUMABLE_KEYS.slice();
    }

    var patient = {
      id: patientIdCounter++,
      name: randomFrom(NAMES),
      surname: randomFrom(SURNAMES),
      age: randomInt(18, 75),
      symptom: null,
      diagnosis: medCase.diagnosis,
      complaint: medCase.complaint,
      vitals: generateVitals(severity.key),
      requiredConsumable: consumableType,
      requiredConsumables: requiredConsumables,
      pendingConsumables: requiredConsumables.slice(),
      preferredTier: preferredTier,
      mesh: mesh,
      state: 'queued',
      targetPos: null,
      queueTarget: null,
      destination: null,
      wardId: null,
      indicators: [],
      animating: false,
      severity: severity,
      treated: false,
      procedureFee: 0,
      paymentInfo: null,
      staffProcessing: false,
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
    if (popupSeverityBand) popupSeverityBand.className = patient.severity.key;

    // Severity + preferred-tier summary — shown directly under the name header.
    if (popupTier) {
      var sevColor = SEVERITY_COLORS[patient.severity.key] || '#c0d8f0';
      popupTier.innerHTML =
        '<span class="popup-tier-item">' +
          Game.Lang.t('popup.severity') +
          ' <span class="popup-tier-sev" style="color:' + sevColor + '">' + patient.severity.label + '</span>' +
        '</span>' +
        '<span class="popup-tier-sep">\u2022</span>' +
        '<span class="popup-tier-item">' +
          Game.Lang.t('patient.tierPrefers', [Game.Lang.t('patient.tier.' + patient.preferredTier)]) +
        '</span>';
    }

    popupEl.style.display = 'block';

    refreshWardButtons(patient);

    var indoorChairs = Game.Furniture.getIndoorChairs();
    var freeChairs = indoorChairs.filter(function(c) { return !c.occupied; }).length;
    var outdoorChairCount = Game.Furniture.getOutdoorChairCount();

    btnWait.style.display = '';
    btnReject.style.display = '';

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
    if (outdoorChairCount > 0) {
      outdoorWarning.textContent = Game.Lang.t('patient.outdoorWarning');
      outdoorWarning.style.display = 'block';
    } else {
      outdoorWarning.style.display = 'none';
    }

    var brokenWarning = document.getElementById('broken-bed-warning');
    if (brokenWarning) brokenWarning.style.display = 'none';

    controls.unlock();
  }

  // --- Ward button rendering / state ---
  var SEVERITY_ORDER = ['mild', 'medium', 'severe'];

  function renderSeverityChips(wardDef, patientSeverityKey) {
    var parts = [];
    for (var i = 0; i < SEVERITY_ORDER.length; i++) {
      var sev = SEVERITY_ORDER[i];
      if (wardDef.accepts.indexOf(sev) === -1) continue;
      var color = SEVERITY_COLORS[sev] || '#888';
      var active = sev === patientSeverityKey ? ' ward-sev-active' : '';
      parts.push('<span class="ward-sev-dot' + active + '" style="background:' + color + '" title="' + sev + '"></span>');
    }
    return parts.join('');
  }

  function refreshWardButtons(patient) {
    if (!wardsContainer || !Game.Wards) return;
    var order = Game.Wards.ORDER;
    for (var i = 0; i < order.length; i++) {
      var wid = order[i];
      var def = Game.Wards.TYPES[wid];
      var ui = wardButtons[wid];
      if (!ui) continue;
      var cap = Game.Wards.getCapacity(wid);
      var free = Game.Wards.getFreeCount(wid);
      var accepts = Game.Wards.accepts(wid, patient.severity.key);

      ui.labelEl.textContent = Game.Lang.t('ward.name.' + wid);
      ui.countEl.textContent = '(' + free + '/' + cap + ')';
      if (ui.acceptsEl) ui.acceptsEl.innerHTML = renderSeverityChips(def, patient.severity.key);

      var fullPrice = def.price;
      var payPrice = Game.Wards.calcPayment(wid, patient);
      if (payPrice < fullPrice) {
        ui.priceEl.innerHTML = '<span class="ward-price-strike">$' + fullPrice + '</span> <span class="ward-price-actual">$' + payPrice + '</span>';
      } else {
        ui.priceEl.innerHTML = '<span class="ward-price-actual">$' + fullPrice + '</span>';
      }

      ui.btnEl.classList.remove('ward-disabled', 'ward-full', 'ward-mismatch', 'ward-match');
      if (!accepts) {
        ui.btnEl.disabled = true;
        ui.btnEl.classList.add('ward-disabled');
      } else if (free <= 0) {
        ui.btnEl.disabled = true;
        ui.btnEl.classList.add('ward-full');
      } else {
        ui.btnEl.disabled = false;
        ui.btnEl.classList.add(def.tier === patient.preferredTier ? 'ward-match' : 'ward-mismatch');
      }
    }
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

  // Admit patient to a chosen ward. Validates severity, computes procedureFee
  // from Game.Wards, marks ward slot occupied, and dispatches walking state.
  function admitToWard(patient, wardId) {
    if (!Game.Wards) return false;
    if (!Game.Wards.accepts(wardId, patient.severity.key)) {
      showPopupError(Game.Lang.t('popup.err.wardTypeMismatch'));
      return false;
    }
    var slot = Game.Wards.getFreeSlot(wardId);
    if (!slot) {
      showPopupError(Game.Lang.t('popup.err.wardFull'));
      return false;
    }
    patient.wardId = wardId;
    patient.procedureFee = Game.Wards.calcPayment(wardId, patient);
    sendPatient(patient, slot.pos, slot);
    return true;
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
    // Bed indicator icons (drug/diagnostic sprites) over patient heads are disabled.
    removeAllIndicators(patient);
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

  // Severity colors used by the ward-button chips in the popup.
  var SEVERITY_COLORS = {
    mild:   '#3ecb5e',
    medium: '#ffcc33',
    severe: '#ff5555'
  };

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

    if (patient.pendingConsumables.length === 0) {
      // All meds applied — schedule auto-discharge after recovery progress bar finishes.
      patient.animating = true;
      patient.treated = true;
      Game.Inventory.showNotification(Game.Lang.t('notify.treatmentStarted'), 'rgba(34, 139, 34, 0.85)');
      var recoveryDuration = 30 + Math.random() * 15;
      var bar = createRecoveryProgressBar();
      animations.push({ patient: patient, type: 'recover', timer: recoveryDuration, maxTime: recoveryDuration, autoDischarge: true, bar: bar });
    } else {
      Game.Inventory.showNotification(Game.Lang.t('notify.medicineApplied', [patient.pendingConsumables.length]), 'rgba(70, 130, 180, 0.85)');
    }
    spawnSmileyReaction(patient);
  }

  // --- Recovery progress bar (3D sprite over patient) ---
  function createRecoveryProgressBar() {
    var canvas = document.createElement('canvas');
    canvas.width = 192; canvas.height = 28;
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.85, 0.12, 1);
    scene.add(sprite);
    return { sprite: sprite, canvas: canvas, texture: texture, lastDraw: -1 };
  }

  function drawRecoveryProgressBar(bar, progress) {
    var progressInt = Math.floor(progress * 100);
    if (progressInt === bar.lastDraw) return;
    bar.lastDraw = progressInt;
    var ctx = bar.canvas.getContext('2d');
    ctx.clearRect(0, 0, 192, 28);

    ctx.fillStyle = 'rgba(10, 30, 15, 0.85)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 192, 28, 6);
    ctx.fill();

    var borderColor = '#22aa44';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(0, 0, 192, 28, 6);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(3, 16, 186, 8, 3);
    ctx.fill();

    var fillW = Math.max(0, Math.min(186, progress * 186));
    if (fillW > 0) {
      var grad = ctx.createLinearGradient(3, 0, 189, 0);
      grad.addColorStop(0, borderColor);
      grad.addColorStop(1, '#7fffaa');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(3, 16, fillW, 8, 3);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(Game.Lang.t('patient.status.recovering'), 6, 9);

    ctx.fillStyle = '#aaffcc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(progressInt + '%', 188, 9);

    bar.texture.needsUpdate = true;
  }

  function disposeRecoveryProgressBar(bar) {
    if (!bar) return;
    scene.remove(bar.sprite);
    if (bar.sprite.material.map) bar.sprite.material.map.dispose();
    bar.sprite.material.dispose();
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

  function rejectPatient(patient) {
    removeFromQueue(patient);
    if (patient.destination) {
      patient.destination.occupied = false;
      patient.destination = null;
    }
    removeIllnessVisuals(patient);
    patient.state = 'leaving';
    patient.leavePhase = 'toExit';
    patient.targetPos = new THREE.Vector3(0, 0, 1);
    patient.anim.targetPose = 'standing';
    Game.Inventory.showNotification(Game.Lang.t('notify.patientRejected'));
    closePopup();
  }

  function dischargePatient(patient) {
    removeAllIndicators(patient);
    if (patient.destination) {
      patient.destination.occupied = false;
      patient.destination = null;
    }
    patient.treated = false;
    patient.anim.recovered = true;
    removeIllnessVisuals(patient);
    patient.anim.targetPose = 'standing';
    if (Game.Shift) Game.Shift.trackPatientServed();
    Game.Cashier.addPatientToQueue(patient);
  }

  function removePatient(patient) {
    removeIllnessVisuals(patient);
    removeAllIndicators(patient);
    scene.remove(patient.mesh);
    if (patient.destination) {
      patient.destination.occupied = false;
    }
    var idx = patients.indexOf(patient);
    if (idx !== -1) patients.splice(idx, 1);
    var qIdx = queue.indexOf(patient);
    if (qIdx !== -1) { queue.splice(qIdx, 1); updateQueueTargets(); }
    if (hoveredPatient === patient) hoveredPatient = null;
  }

  function updateAnimations(delta) {
    for (var i = animations.length - 1; i >= 0; i--) {
      var anim = animations[i];
      anim.timer -= delta;

      if (anim.type === 'recover') {
        var patientAliveR = anim.patient && patients.indexOf(anim.patient) !== -1;
        if (!patientAliveR) {
          disposeRecoveryProgressBar(anim.bar);
          animations.splice(i, 1);
          continue;
        }
        var progressR = 1.0 - Math.max(0, anim.timer / anim.maxTime);
        var isLyingR = anim.patient.anim.pose === 'lying';
        anim.bar.sprite.position.set(
          anim.patient.mesh.position.x,
          isLyingR ? 1.6 : 2.1,
          anim.patient.mesh.position.z
        );
        drawRecoveryProgressBar(anim.bar, progressR);
        if (anim.timer <= 0) {
          disposeRecoveryProgressBar(anim.bar);
          anim.patient.animating = false;
          if (anim.autoDischarge && anim.patient.treated && patients.indexOf(anim.patient) !== -1) {
            anim.patient.paymentInfo = {
              procedure: anim.patient.procedureFee,
              total: anim.patient.procedureFee,
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

      if (p.state === 'queued' && p.queueTarget) {
        var qDx = p.queueTarget.x - p.mesh.position.x;
        var qDz = p.queueTarget.z - p.mesh.position.z;
        isMoving = (qDx * qDx + qDz * qDz) > 0.01;
        moveToward(p.mesh.position, p.queueTarget, speed);
        // Vertical queue: face south (rotY = PI) toward reception desk to the north
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
          p.targetPos = p.walkPath.shift();
          if (p.walkPath.length === 0) p.walkPath = null;
          arrived = false;
          isMoving = true;
        }
        if (arrived) {
          var isBed = !!p.wardId;
          p.state = isBed ? 'atBed' : 'waiting';
          p.targetPos = null;
          p.anim.targetPose = isBed ? 'lying' : 'sitting';
          if (p.state === 'atBed') {
            createBedIndicators(p);
          }
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
          if (opacity <= 0) {
            removePatient(p);
            continue;
          }
        }
      }

      updateWalkAnimation(p, delta, isMoving);
      updatePoseTransition(p, delta);
    }
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

    // Staff APIs
    getPatients: function() { return patients; },
    getQueue: function() { return queue; },
    sendPatientByStaff: function(patient, dest, slot, wardId) {
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
      if (wardId) {
        patient.wardId = wardId;
        if (Game.Wards) patient.procedureFee = Game.Wards.calcPayment(wardId, patient);
      }
      patient.anim.targetPose = 'standing';
      removeFromQueue(patient);
    },
    summonToDesk: function(patient, deskPos) {
      removeFromQueue(patient);
      patient.state = 'queued';
      patient.queueTarget = new THREE.Vector3(deskPos.x, 0, deskPos.z);
    },
    treatPatientByStaff: function(patient, consumableType) {
      if (!patient || patient.treated) return;
      if (!patient.pendingConsumables || patient.pendingConsumables.indexOf(consumableType) === -1) return;
      applyOneConsumable(patient, consumableType);
    },

    setup: function(_THREE, _scene, _camera, _controls, _waitingChairs) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;
      waitingChairs = _waitingChairs;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);

      hintEl = document.getElementById('interact-hint');
      popupEl = document.getElementById('patient-popup');
      popupName = document.getElementById('popup-name');
      popupSeverityBand = document.getElementById('popup-severity-band');
      popupTier = document.getElementById('popup-tier');
      btnWait = document.getElementById('btn-wait');
      btnReject = document.getElementById('btn-reject');
      chairCount = document.getElementById('chair-count');

      // Build 6 ward buttons into #popup-wards (row-major 3×2 via CSS grid).
      wardsContainer = document.getElementById('popup-wards');
      if (wardsContainer && Game.Wards) {
        wardsContainer.innerHTML = '';
        var order = Game.Wards.ORDER;
        for (var wi = 0; wi < order.length; wi++) {
          var wid = order[wi];
          var btn = document.createElement('button');
          btn.className = 'ward-btn';
          btn.dataset.ward = wid;
          btn.innerHTML =
            '<span class="ward-name"></span>' +
            '<span class="ward-accepts"></span>' +
            '<span class="ward-price"></span>' +
            '<span class="ward-count"></span>';
          wardsContainer.appendChild(btn);
          wardButtons[wid] = {
            btnEl: btn,
            labelEl: btn.querySelector('.ward-name'),
            acceptsEl: btn.querySelector('.ward-accepts'),
            priceEl: btn.querySelector('.ward-price'),
            countEl: btn.querySelector('.ward-count')
          };
          (function(id) {
            btn.addEventListener('click', function() {
              if (!popupPatient) return;
              if (!Game.Wards.accepts(id, popupPatient.severity.key)) {
                showPopupError(Game.Lang.t('popup.err.wardTypeMismatch'));
                return;
              }
              if (Game.Wards.getFreeCount(id) <= 0) {
                showPopupError(Game.Lang.t('popup.err.wardFull'));
                return;
              }
              admitToWard(popupPatient, id);
            });
          })(wid);
        }
      }

      // Click to interact — any queued/waiting patient is clickable.
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

      // Register with central interaction system — patients in queue or sitting
      // in waiting chairs are clickable so the player can route them.
      Game.Interaction.register('patients', function() {
        var meshes = [];
        for (var i = 0; i < queue.length; i++) {
          var q = queue[i];
          if (!q.animating && (q.state === 'queued' || q.state === 'interacting')) {
            meshes.push(q.mesh);
          }
        }
        for (var w = 0; w < patients.length; w++) {
          var pw = patients[w];
          if (!pw.animating && pw.state === 'waiting') {
            meshes.push(pw.mesh);
          }
        }
        return meshes;
      }, true, 5);
    },

    startWaveSystem: function() {
      autoSpawnActive = true;
      initialSpawnCount = 0;
      // Fill 75% of total ward capacity at shift open.
      var totalBeds = Game.Wards ? Game.Wards.getTotalCapacity() : 0;
      initialBurstTarget = Math.max(1, Math.ceil(totalBeds * 0.75));

      // Severity mix: spread across what wards can admit. Compose the burst
      // so each severity appears in proportion to available wards, then shuffle.
      // Approximation: mild ≈ 40%, medium ≈ 35%, severe ≈ 25%.
      var mix = [];
      var nMild = Math.round(initialBurstTarget * 0.40);
      var nMedium = Math.round(initialBurstTarget * 0.35);
      var nSevere = initialBurstTarget - nMild - nMedium;
      for (var sm = 0; sm < nMild; sm++) mix.push('mild');
      for (var sd = 0; sd < nMedium; sd++) mix.push('medium');
      for (var ss = 0; ss < nSevere; ss++) mix.push('severe');
      // Fisher–Yates shuffle (so queue order feels varied).
      for (var k = mix.length - 1; k > 0; k--) {
        var r = Math.floor(Math.random() * (k + 1));
        var tmp = mix[k]; mix[k] = mix[r]; mix[r] = tmp;
      }

      initialPlan = [];
      for (var i = 0; i < initialBurstTarget; i++) {
        initialPlan.push({ severity: mix[i], preferredTier: rollPreferredTier() });
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
        if (p.destination) {
          p.destination.occupied = false;
        }
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
          var wardCap = Game.Wards ? Game.Wards.getTotalCapacity() : 0;
          var chairCap = Game.Furniture ? Game.Furniture.getAllChairs().length : 0;
          var totalCap = wardCap + chairCap;

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
              var plannedSeverity = null;
              var plannedTier = null;
              if (initialPlan && initialPlan.length > 0 && initialSpawnCount < initialBurstTarget) {
                var entry = initialPlan.shift();
                plannedSeverity = entry.severity;
                plannedTier = entry.preferredTier;
              }
              spawnPatient(false, plannedSeverity, plannedTier);
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
