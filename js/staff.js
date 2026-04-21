(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls, collidables;
  var interactRay, screenCenter;
  var hintEl;

  // ====== STAFF TYPES ======
  // Salary disabled — hire is free and no daily deduction.
  var STAFF_TYPES = {
    administrator: { name: Game.Lang.t('staff.administrator'), salary: 0, color: 0x2266aa, hatColor: 0x1a4a88 },
    nurse:         { name: Game.Lang.t('staff.nurse'),         salary: 0, color: 0xcc4488, hatColor: 0xaa3366 }
  };

  // Fixed duration to apply a single consumable by the nurse.
  var TREAT_APPLY_DURATION = 4;

  var STAFF_SPEED = 3.5;
  var STRIDE_LEN = 1.1;
  var LEG_SWING = 0.4;
  var ARM_SWING = 0.35;

  // Up to 4 nurses may be hired simultaneously; admin is capped at 1.
  var MAX_NURSES = 4;

  // Nurses stand along the central corridor between ward columns.
  var NURSE_WORK_POSITIONS = [
    { x: -4, z: -11, rotY: 0 },
    { x:  4, z: -11, rotY: 0 },
    { x: -4, z: -13, rotY: 0 },
    { x:  4, z: -13, rotY: 0 }
  ];

  var WORK_POSITIONS = {
    administrator: { x: 0, z: -9.5, rotY: Math.PI }
  };

  function getWorkPos(staff) {
    if (staff.type === 'nurse') {
      var slot = staff.workSlotIndex != null ? staff.workSlotIndex : 0;
      return NURSE_WORK_POSITIONS[slot] || NURSE_WORK_POSITIONS[0];
    }
    return WORK_POSITIONS[staff.type];
  }

  function reserveNurseSlot() {
    var used = {};
    for (var i = 0; i < hiredStaff.length; i++) {
      if (hiredStaff[i].type === 'nurse' && hiredStaff[i].workSlotIndex != null) {
        used[hiredStaff[i].workSlotIndex] = true;
      }
    }
    for (var s = 0; s < NURSE_WORK_POSITIONS.length; s++) {
      if (!used[s]) return s;
    }
    return null;
  }

  // ====== STATE ======
  var hiredStaff = [];
  var staffIdCounter = 0;

  // ====== 3D MODEL ======
  function createStaffMesh(type) {
    var info = STAFF_TYPES[type];
    var group = new THREE.Group();
    var coatMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
    var pantsMat = new THREE.MeshLambertMaterial({ color: 0x334455 });
    var accentMat = new THREE.MeshLambertMaterial({ color: info.color });
    var hatMat = new THREE.MeshLambertMaterial({ color: info.hatColor });

    var poseContainer = new THREE.Group();
    group.add(poseContainer);

    var bodyContainer = new THREE.Group();
    poseContainer.add(bodyContainer);

    // Body (torso) — white coat
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.75, 0.27), coatMat);
    body.position.y = 0.87; body.castShadow = true; bodyContainer.add(body);

    // Colored collar
    var collar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.29), accentMat);
    collar.position.y = 1.22; collar.castShadow = true; bodyContainer.add(collar);

    // Name badge on chest
    var badgeMat = new THREE.MeshLambertMaterial({ color: info.color });
    var badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.01), badgeMat);
    badge.position.set(0.1, 0.95, 0.14); bodyContainer.add(badge);

    // Head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skinMat);
    head.position.y = 1.4; head.castShadow = true; bodyContainer.add(head);

    // Hat/cap
    var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.08, 12), hatMat);
    hat.position.y = 1.55; hat.castShadow = true; bodyContainer.add(hat);
    // Hat brim
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.02, 12), hatMat);
    brim.position.y = 1.51; bodyContainer.add(brim);

    // Arms
    function createArm(xSide) {
      var shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(xSide * 0.29, 1.17, 0);
      bodyContainer.add(shoulderPivot);

      var upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.09), coatMat.clone());
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

    // Legs
    var leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.1, 0.5, 0);
    poseContainer.add(leftLegPivot);
    var leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.18), pantsMat);
    leftLeg.position.y = -0.25; leftLeg.castShadow = true; leftLegPivot.add(leftLeg);

    var rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.1, 0.5, 0);
    poseContainer.add(rightLegPivot);
    var rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.18), pantsMat);
    rightLeg.position.y = -0.25; rightLeg.castShadow = true; rightLegPivot.add(rightLeg);

    // Scale up slightly to distinguish from patients
    group.scale.set(1.1, 1.1, 1.1);

    // Store references
    var ud = group.userData;
    ud.isStaff = true;
    ud.staffType = type;
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
    ud.bodyParts = [body, collar, head, hat, brim, badge, leftArm.upperArm, leftArm.forearm, rightArm.upperArm, rightArm.forearm, leftLeg, rightLeg];

    return group;
  }

  // ====== PROGRESS BAR ======
  var ACTION_LABELS = {
    processing: Game.Lang.t('staff.status.processing'),
    pickMedicine: Game.Lang.t('staff.status.pickMedicine'),
    treating: Game.Lang.t('staff.status.treating'),
    cleaningTrash: Game.Lang.t('staff.status.cleaningTrash')
  };

  function createProgressBar(staff) {
    var canvas = document.createElement('canvas');
    canvas.width = 192; canvas.height = 28;
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.85, 0.12, 1);
    scene.add(sprite);
    staff.progressBar = sprite;
    staff.progressCanvas = canvas;
    staff.progressTexture = texture;
    staff._lastProgressDraw = -1;
  }

  function updateProgressBar(staff) {
    var label = ACTION_LABELS[staff.state];
    if (!label || staff.stateTimer === undefined || staff._stateMaxTime === undefined || staff._stateMaxTime <= 0) {
      // Hide progress bar
      if (staff.progressBar) {
        staff.progressBar.visible = false;
      }
      return;
    }

    if (!staff.progressBar) {
      createProgressBar(staff);
    }
    staff.progressBar.visible = true;

    // Position above head
    staff.progressBar.position.set(
      staff.mesh.position.x,
      2.1 * 1.1, // account for staff scale
      staff.mesh.position.z
    );

    // Calculate progress (timer counts down, so progress = 1 - remaining/max)
    var progress = 1.0 - Math.max(0, staff.stateTimer / staff._stateMaxTime);
    var progressInt = Math.floor(progress * 100);
    if (progressInt === staff._lastProgressDraw) return;
    staff._lastProgressDraw = progressInt;

    var canvas = staff.progressCanvas;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 192, 28);

    // Background — dark rounded rect with colored border
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 192, 28, 6);
    ctx.fill();

    // Border
    var info = STAFF_TYPES[staff.type];
    var borderColor = '#' + info.color.toString(16).padStart(6, '0');
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(0, 0, 192, 28, 6);
    ctx.stroke();

    // Progress fill — gradient from staff color to lighter version
    var fillW = Math.max(0, Math.min(186, progress * 186));
    if (fillW > 0) {
      var grad = ctx.createLinearGradient(3, 0, 189, 0);
      grad.addColorStop(0, borderColor);
      grad.addColorStop(1, '#55ccff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(3, 16, fillW, 8, 3);
      ctx.fill();
    }

    // Track background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(3, 16, 186, 8, 3);
    ctx.fill();

    // Re-draw fill on top of track bg
    if (fillW > 0) {
      var grad2 = ctx.createLinearGradient(3, 0, 189, 0);
      grad2.addColorStop(0, borderColor);
      grad2.addColorStop(1, '#55ccff');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.roundRect(3, 16, fillW, 8, 3);
      ctx.fill();
    }

    // Action label text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 6, 9);

    // Percentage text
    ctx.fillStyle = '#aaddff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(progressInt + '%', 188, 9);

    staff.progressTexture.needsUpdate = true;
  }

  function removeProgressBar(staff) {
    if (staff.progressBar) {
      scene.remove(staff.progressBar);
      staff.progressBar.material.map.dispose();
      staff.progressBar.material.dispose();
      staff.progressBar = null;
      staff.progressCanvas = null;
      staff.progressTexture = null;
      staff._lastProgressDraw = -1;
    }
  }

  // Helper: set stateTimer and record max for progress bar
  function setTimedState(staff, state, duration) {
    staff.state = state;
    staff.stateTimer = duration;
    staff._stateMaxTime = duration;
  }

  // ====== MOVEMENT ======
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

  function updateStaffWalkAnimation(staff, delta, isMoving) {
    var ud = staff.mesh.userData;
    if (!staff.walkPhase) staff.walkPhase = 0;
    if (!staff.walkBlend) staff.walkBlend = 0;

    if (isMoving) {
      var dist = STAFF_SPEED * delta;
      staff.walkPhase += (dist / STRIDE_LEN) * Math.PI * 2;
      staff.walkBlend = Math.min(1, staff.walkBlend + delta * 5);
    } else {
      staff.walkBlend = Math.max(0, staff.walkBlend - delta * 4);
      if (staff.walkBlend <= 0) staff.walkPhase = 0;
    }

    var wb = staff.walkBlend;
    var ph = staff.walkPhase;
    var sinPh = Math.sin(ph);
    var sinPhOpp = Math.sin(ph + Math.PI);

    // Legs
    ud.leftLegPivot.rotation.x = sinPh * LEG_SWING * wb;
    ud.rightLegPivot.rotation.x = sinPhOpp * LEG_SWING * wb;

    // Arms
    ud.leftArm.shoulderPivot.rotation.x = sinPhOpp * ARM_SWING * wb;
    ud.rightArm.shoulderPivot.rotation.x = sinPh * ARM_SWING * wb;
    ud.leftArm.elbowPivot.rotation.x = Math.min(0, sinPhOpp) * 0.25 * wb;
    ud.rightArm.elbowPivot.rotation.x = Math.min(0, sinPh) * 0.25 * wb;

    // Reset body rotation
    ud.bodyMesh.rotation.x = 0;
    ud.bodyMesh.rotation.y = 0;
    ud.bodyMesh.rotation.z = 0;
    ud.bodyMesh.position.y = 0.87;
    ud.headMesh.rotation.x = 0;
  }

  // ====== STAFF MEMBER CREATION ======
  function createStaffMember(type) {
    var mesh = createStaffMesh(type);
    var member = {
      id: ++staffIdCounter,
      type: type,
      mesh: mesh,
      state: 'idle',
      stateTimer: 0,
      assignTimer: 0,
      targetPos: null,
      targetPatient: null,
      targetSlot: null,
      heldItem: null,
      heldItemMesh: null,
      walkPhase: 0,
      walkBlend: 0,
      workSlotIndex: null
    };
    if (type === 'nurse') {
      member.workSlotIndex = reserveNurseSlot();
    }
    var workPos = getWorkPos(member);
    mesh.position.set(workPos.x, 0, workPos.z);
    mesh.rotation.y = workPos.rotY || 0;
    scene.add(mesh);
    return member;
  }

  // ====== ADMINISTRATOR LOGIC ======
  var ADMIN_DESK_POS = { x: 0, z: -8.5 }; // where patient stands in front of desk
  var ADMIN_PROCESS_TIME = 5.0;

  // Pick a ward slot that accepts the patient's severity.
  // Preference order: tier === preferredTier → improved → basic → vip → fallback chair.
  // Returns { slot, wardId } or a plain chair slot with wardId=null.
  function findDestinationForPatient(patient) {
    if (patient && Game.Wards) {
      var order = Game.Wards.ORDER;
      var preferred = null, others = [];
      for (var i = 0; i < order.length; i++) {
        var id = order[i];
        if (!Game.Wards.accepts(id, patient.severity.key)) continue;
        var freeSlot = Game.Wards.getFreeSlot(id);
        if (!freeSlot) continue;
        var def = Game.Wards.TYPES[id];
        if (def.tier === patient.preferredTier) preferred = { slot: freeSlot, wardId: id };
        else others.push({ slot: freeSlot, wardId: id });
      }
      if (preferred) return preferred;
      if (others.length > 0) return others[0];
    }
    var indoorChairs = Game.Furniture.getIndoorChairs();
    for (var ci = 0; ci < indoorChairs.length; ci++) {
      if (!indoorChairs[ci].occupied) return { slot: indoorChairs[ci], wardId: null };
    }
    return null;
  }

  function updateAdministrator(staff, delta) {
    if (staff.state === 'idle') {
      staff.assignTimer += delta;
      if (staff.assignTimer < 2.0) return;
      staff.assignTimer = 0;

      var patients = Game.Patients.getPatients ? Game.Patients.getPatients() : [];
      if (patients.length === 0) return;

      // For waiting patients → ward: try to send directly.
      var bestWaiting = null;
      for (var i = 0; i < patients.length; i++) {
        if (patients[i].state === 'waiting' && !patients[i].staffProcessing) {
          bestWaiting = patients[i]; break;
        }
      }
      if (bestWaiting) {
        var waitDest = findDestinationForPatient(bestWaiting);
        if (waitDest && waitDest.wardId) {
          Game.Patients.sendPatientByStaff(bestWaiting, waitDest.slot.pos, waitDest.slot, waitDest.wardId);
          return;
        }
      }

      // For queued patients: summon to desk first.
      var queue = Game.Patients.getQueue ? Game.Patients.getQueue() : [];
      if (queue.length === 0) return;

      var chosenPatient = null;
      for (var qi = 0; qi < queue.length; qi++) {
        if (!queue[qi].staffProcessing) {
          var dest = findDestinationForPatient(queue[qi]);
          if (dest) {
            chosenPatient = queue[qi];
            staff._pendingDest = dest;
            break;
          }
        }
      }
      if (!chosenPatient) return;

      chosenPatient.staffProcessing = true;
      staff.targetPatient = chosenPatient;
      Game.Patients.summonToDesk(chosenPatient, ADMIN_DESK_POS);
      staff.state = 'waitingForPatient';

    } else if (staff.state === 'waitingForPatient') {
      if (!staff.targetPatient) {
        cancelAdminTask(staff);
        return;
      }
      var p = staff.targetPatient;
      var dx = p.mesh.position.x - ADMIN_DESK_POS.x;
      var dz = p.mesh.position.z - ADMIN_DESK_POS.z;
      if (dx * dx + dz * dz < 0.15) {
        setTimedState(staff, 'processing', ADMIN_PROCESS_TIME);
      }

    } else if (staff.state === 'processing') {
      if (!staff.targetPatient) {
        cancelAdminTask(staff);
        return;
      }
      staff.stateTimer -= delta;
      if (staff.stateTimer <= 0) {
        var pending = staff._pendingDest;
        // Re-validate (slot may have been taken).
        if (!pending || pending.slot.occupied) {
          pending = findDestinationForPatient(staff.targetPatient);
        }
        if (pending && !pending.slot.occupied) {
          staff.targetPatient.staffProcessing = false;
          Game.Patients.sendPatientByStaff(staff.targetPatient, pending.slot.pos, pending.slot, pending.wardId);
        } else {
          staff.targetPatient.staffProcessing = false;
        }
        staff.targetPatient = null;
        staff._pendingDest = null;
        staff.state = 'idle';
        staff.assignTimer = 0;
      }
    }
  }

  function cancelAdminTask(staff) {
    if (staff.targetPatient) {
      staff.targetPatient.staffProcessing = false;
    }
    staff.targetPatient = null;
    staff._pendingDest = null;
    staff.state = 'idle';
    staff.assignTimer = 0;
  }

  // ====== NURSE LOGIC ======
  var nurseWarningEl = null;
  var missingMeds = {}; // type -> true

  function updateNurseWarningHUD() {
    if (!nurseWarningEl) {
      nurseWarningEl = document.getElementById('nurse-warning-hud');
    }
    if (!nurseWarningEl) return;

    // Check if any nurse is hired
    var hasNurse = false;
    for (var i = 0; i < hiredStaff.length; i++) {
      if (hiredStaff[i].type === 'nurse') { hasNurse = true; break; }
    }

    if (!hasNurse || Object.keys(missingMeds).length === 0) {
      nurseWarningEl.style.display = 'none';
      return;
    }

    var html = '<div class="nurse-warn-title">' + Game.Lang.t('staff.nurseWarning') + '</div>';
    for (var type in missingMeds) {
      var info = Game.Consumables.TYPES[type];
      if (!info) continue;
      var colorHex = '#' + info.color.toString(16).padStart(6, '0');
      html += '<div class="nurse-warn-item"><span class="nurse-warn-dot" style="background:' + colorHex + '"></span>' + info.name + '</div>';
    }
    nurseWarningEl.innerHTML = html;
    nurseWarningEl.style.display = 'block';
  }

  function updateNurse(staff, delta) {
    var speed = STAFF_SPEED * delta;

    if (staff.state === 'idle') {
      staff.stateTimer += delta;
      if (staff.stateTimer < 1.0) return;
      staff.stateTimer = 0;

      // Rebuild missing meds list each check cycle. FIFO order.
      var newMissing = {};
      var patients = Game.Patients.getPatients ? Game.Patients.getPatients() : [];
      var candidates = [];
      for (var i = 0; i < patients.length; i++) {
        var p = patients[i];
        if (p.state === 'atBed' && !p.treated
            && !p.staffTreating
            && p.pendingConsumables && p.pendingConsumables.length > 0) {
          candidates.push(p);
        }
      }

      for (var ci = 0; ci < candidates.length; ci++) {
        var cand = candidates[ci];
        var requiredMed = cand.pendingConsumables[0];
        var slot = Game.Shelves.findSlotWithItem ? Game.Shelves.findSlotWithItem(requiredMed) : null;

        if (!slot) {
          newMissing[requiredMed] = true;
          continue;
        }

        missingMeds = newMissing;
        updateNurseWarningHUD();
        staff.targetPatient = cand;
        cand.staffTreating = true;
        staff.heldItem = requiredMed;
        staff.targetSlot = slot;
        staff.targetPos = new THREE.Vector3(slot.pos.x, 0, slot.pos.z + 0.8);
        staff.state = 'walkToShelf';
        return;
      }

      missingMeds = newMissing;
      updateNurseWarningHUD();
    } else if (staff.state === 'walkToShelf') {
      var arrived = moveToward(staff.mesh.position, staff.targetPos, speed);
      faceTarget(staff, staff.targetPos);
      if (arrived) {
        setTimedState(staff, 'pickMedicine', 1.0);
      }
    } else if (staff.state === 'pickMedicine') {
      staff.stateTimer -= delta;
      if (staff.stateTimer <= 0) {
        // Check if slot still has item
        if (staff.targetSlot && staff.targetSlot.item === staff.heldItem && Game.Shelves.takeFromSlot) {
          Game.Shelves.takeFromSlot(staff.targetSlot);
          attachHeldItem(staff);
          staff.targetSlot = null;
          // Navigate to patient
          var patientPos = staff.targetPatient.destination ? staff.targetPatient.destination.pos : staff.targetPatient.mesh.position;
          staff.targetPos = new THREE.Vector3(patientPos.x + 1.0, 0, patientPos.z);
          staff.state = 'walkToPatient';
        } else {
          // Medicine was taken while we walked
          cancelNurseTask(staff);
        }
      }
    } else if (staff.state === 'walkToPatient') {
      if (!staff.targetPatient || staff.targetPatient.state !== 'atBed' || staff.targetPatient.treated) {
        cancelNurseTask(staff);
        return;
      }
      if (staff.targetPatient.pendingConsumables && staff.targetPatient.pendingConsumables.indexOf(staff.heldItem) === -1) {
        cancelNurseTask(staff);
        return;
      }
      var arrived = moveToward(staff.mesh.position, staff.targetPos, speed);
      faceTarget(staff, staff.targetPos);
      if (arrived) {
        setTimedState(staff, 'treating', TREAT_APPLY_DURATION);
      }
    } else if (staff.state === 'treating') {
      if (!staff.targetPatient || staff.targetPatient.state !== 'atBed') {
        cancelNurseTask(staff);
        return;
      }
      if (staff.targetPatient.pendingConsumables && staff.targetPatient.pendingConsumables.indexOf(staff.heldItem) === -1) {
        cancelNurseTask(staff);
        return;
      }
      staff.stateTimer -= delta;
      if (staff.stateTimer <= 0) {
        // Apply treatment
        if (Game.Patients.treatPatientByStaff && staff.targetPatient) {
          Game.Patients.treatPatientByStaff(staff.targetPatient, staff.heldItem);
        }
        staff.targetPatient.staffTreating = false;
        staff.targetPatient = null;
        removeHeldItem(staff);
        staff.heldItem = null;
        // Return to work position
        var workPos = getWorkPos(staff);
        staff.targetPos = new THREE.Vector3(workPos.x, 0, workPos.z);
        staff.state = 'returning';
      }
    } else if (staff.state === 'returning') {
      var arrived = moveToward(staff.mesh.position, staff.targetPos, speed);
      faceTarget(staff, staff.targetPos);
      if (arrived) {
        staff.mesh.rotation.y = getWorkPos(staff).rotY || 0;
        staff.state = 'idle';
        staff.stateTimer = 0;
      }
    }
  }

  function cancelNurseTask(staff) {
    if (staff.targetPatient) {
      staff.targetPatient.staffTreating = false;
      staff.targetPatient = null;
    }
    if (staff.heldItem) {
      // Drop medicine - return to shelf
      removeHeldItem(staff);
      if (Game.Shelves.placeOnAnyShelf) {
        Game.Shelves.placeOnAnyShelf(staff.heldItem);
      }
      staff.heldItem = null;
    }
    var workPos = getWorkPos(staff);
    staff.targetPos = new THREE.Vector3(workPos.x, 0, workPos.z);
    staff.state = 'returning';
  }

  function returnToWorkPos(staff) {
    var workPos = getWorkPos(staff);
    staff.targetPos = new THREE.Vector3(workPos.x, 0, workPos.z);
    staff.state = 'returning';
  }

  // ====== HELPER FUNCTIONS ======
  function faceTarget(staff, target) {
    var dx = target.x - staff.mesh.position.x;
    var dz = target.z - staff.mesh.position.z;
    if (dx * dx + dz * dz > 0.01) {
      staff.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  function findNearestShelfPos(pos) {
    var shelves = Game.Shelves.getShelves ? Game.Shelves.getShelves() : [];
    var best = { x: -5.5, z: -11.5 };
    var bestDist = Infinity;
    for (var i = 0; i < shelves.length; i++) {
      var sp = shelves[i].mesh.position;
      var dx = sp.x - pos.x;
      var dz = sp.z - pos.z;
      var d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        best = { x: sp.x, z: sp.z };
      }
    }
    return best;
  }

  function attachHeldItem(staff) {
    if (!staff.heldItem) return;
    var mesh = Game.Consumables.createMesh(staff.heldItem);
    if (mesh) {
      mesh.scale.set(2.0, 2.0, 2.0);
      var rightHand = staff.mesh.userData.rightArm.forearm;
      mesh.position.set(0, -0.15, 0);
      rightHand.add(mesh);
      staff.heldItemMesh = mesh;
    }
  }

  function removeHeldItem(staff) {
    if (staff.heldItemMesh) {
      if (staff.heldItemMesh.parent) {
        staff.heldItemMesh.parent.remove(staff.heldItemMesh);
      }
      staff.heldItemMesh = null;
    }
  }

  // ====== MAIN UPDATE ======
  function updateAllStaff(delta) {
    for (var i = 0; i < hiredStaff.length; i++) {
      var s = hiredStaff[i];
      var isMoving = false;

      switch (s.type) {
        case 'administrator': updateAdministrator(s, delta); break;
        case 'nurse':         updateNurse(s, delta); break;
      }

      // Determine if moving
      if (s.state === 'walkToShelf' || s.state === 'walkToPatient' || s.state === 'walkBackToShelf' ||
          s.state === 'walkToGround' || s.state === 'returning') {
        isMoving = true;
      }

      updateStaffWalkAnimation(s, delta, isMoving);
      updateProgressBar(s);
    }
  }

  // ====== PUBLIC API ======
  window.Game.Staff = {
    TYPES: STAFF_TYPES,

    setup: function(_THREE, _scene, _camera, _controls, _collidables) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;
      collidables = _collidables;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);
      hintEl = document.getElementById('interact-hint');

    },

    update: function(delta) {
      updateAllStaff(delta);
    },

    // Hire a staff member. Admin capped at 1; nurse capped at MAX_NURSES (4).
    hire: function(type) {
      if (!STAFF_TYPES[type]) return null;
      var count = 0;
      for (var i = 0; i < hiredStaff.length; i++) if (hiredStaff[i].type === type) count++;
      var cap = (type === 'nurse') ? MAX_NURSES : 1;
      if (count >= cap) {
        Game.Inventory.showNotification(Game.Lang.t('notify.alreadyHired', [STAFF_TYPES[type].name]));
        return null;
      }
      var member = createStaffMember(type);
      hiredStaff.push(member);
      Game.Inventory.showNotification(Game.Lang.t('notify.hired', [STAFF_TYPES[type].name]), 'rgba(34, 139, 34, 0.85)');
      return member;
    },

    // True when the hiring cap for this type is reached.
    isTypeHired: function(type) {
      var count = 0;
      for (var i = 0; i < hiredStaff.length; i++) if (hiredStaff[i].type === type) count++;
      var cap = (type === 'nurse') ? MAX_NURSES : 1;
      return count >= cap;
    },

    countByType: function(type) {
      var count = 0;
      for (var i = 0; i < hiredStaff.length; i++) if (hiredStaff[i].type === type) count++;
      return count;
    },

    // Fire a staff member — no salary payout (salary disabled).
    fire: function(staffId) {
      for (var i = 0; i < hiredStaff.length; i++) {
        if (hiredStaff[i].id === staffId) {
          var s = hiredStaff[i];

          if (s.targetPatient) {
            if (s.targetPatient.staffTreating) s.targetPatient.staffTreating = false;
            if (s.targetPatient.staffProcessing) s.targetPatient.staffProcessing = false;
          }

          removeProgressBar(s);
          removeHeldItem(s);
          if (s.heldItem && Game.Shelves.placeOnAnyShelf) {
            Game.Shelves.placeOnAnyShelf(s.heldItem);
          }

          scene.remove(s.mesh);
          hiredStaff.splice(i, 1);

          if (s.type === 'nurse') {
            missingMeds = {};
            updateNurseWarningHUD();
          }
          Game.Inventory.showNotification(Game.Lang.t('notify.fired', [STAFF_TYPES[s.type].name]), 'rgba(200, 150, 50, 0.85)');
          return true;
        }
      }
      return false;
    },

    getHiredStaff: function() { return hiredStaff; },

    // Salary disabled — returns 0. Kept for backward compatibility with shift.js.
    getDailySalary: function() { return 0; },


    isPatientBeingDiagnosed: function() { return false; },

    isPatientBeingTreated: function(patient) {
      return !!patient.staffTreating;
    }
  };
})();
