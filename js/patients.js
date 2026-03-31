(function() {
  window.Game = window.Game || {};

  // --- Patient data pools ---
  var NAMES = ['Иван','Алексей','Дмитрий','Сергей','Андрей','Михаил','Николай','Павел','Олег','Виктор',
               'Мария','Анна','Елена','Ольга','Наталья','Татьяна','Светлана','Ирина','Екатерина','Юлия'];
  var SURNAMES = ['Иванов','Петров','Сидоров','Козлов','Новиков','Морозов','Волков','Соколов','Лебедев','Попов',
                  'Иванова','Петрова','Сидорова','Козлова','Новикова','Морозова','Волкова','Соколова','Лебедева','Попова'];
  var MEDICAL_DATA = {
    painkiller: {
      symptoms: ['Сильная головная боль','Острая боль в спине','Боль в суставах','Мигрень','Зубная боль'],
      diagnoses: ['Мышечный спазм','Остеохондроз','Невралгия','Перенапряжение','Воспаление сустава']
    },
    antihistamine: {
      symptoms: ['Кожная сыпь','Отёк лица','Зуд по всему телу','Слезоточивость','Чихание и насморк'],
      diagnoses: ['Аллергическая реакция','Крапивница','Поллиноз','Пищевая аллергия','Контактный дерматит']
    },
    strepsils: {
      symptoms: ['Сильная боль в горле','Сухой кашель','Першение в горле','Осиплость голоса','Затруднённое глотание'],
      diagnoses: ['Фарингит','Ларингит','Тонзиллит','Простуда','ОРВИ']
    }
  };
  var CONSUMABLE_KEYS = Object.keys(MEDICAL_DATA);
  var BODY_COLORS = [0x4477aa, 0x44aa77, 0xaa7744, 0x7744aa, 0xaa4466, 0x5599bb, 0x88aa44];

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
  var hintEl, popupEl, popupName, popupSymptom, popupDiagnosis, popupSupply, popupSupplyIcon, popupSeverity;
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

    var body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.25), bodyMat);
    body.position.y = 0.85; body.castShadow = true; group.add(body);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skinMat);
    head.position.y = 1.35; head.castShadow = true; group.add(head);

    var legMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.7 });
    for (var i = 0; i < 2; i++) {
      var dx = i === 0 ? -0.1 : 0.1;
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.18), legMat);
      leg.position.set(dx, 0.25, 0); leg.castShadow = true; group.add(leg);
    }

    group.userData.bodyParts = [body, head];
    return group;
  }

  function spawnPatient(instant) {
    var mesh = createPatientMesh();
    mesh.position.set(0, 0, 1);
    scene.add(mesh);

    var consumableType = randomFrom(CONSUMABLE_KEYS);
    var data = MEDICAL_DATA[consumableType];
    var roll = Math.random();
    var severity = roll < 0.60 ? SEVERITIES[2] : roll < 0.85 ? SEVERITIES[1] : SEVERITIES[0];

    var patient = {
      id: patientIdCounter++,
      name: randomFrom(NAMES),
      surname: randomFrom(SURNAMES),
      symptom: randomFrom(data.symptoms),
      diagnosis: randomFrom(data.diagnoses),
      requiredConsumable: consumableType,
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
      particleTimer: 0
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
      } else {
        var activeType = Game.Inventory.getActive();
        if (activeType) {
          var typeName = Game.Consumables.TYPES[activeType].name;
          hintEl.textContent = 'ЛКМ — Применить ' + typeName;
        } else {
          hintEl.textContent = 'Нужен расходник';
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
    popupName.textContent = patient.name + ' ' + patient.surname;
    popupSymptom.textContent = patient.symptom;
    popupDiagnosis.textContent = patient.diagnosis;
    popupSeverity.textContent = patient.severity.label;
    var sevColors = { severe: '#ff4444', medium: '#ffcc00', mild: '#44cc44' };
    popupSeverity.style.color = sevColors[patient.severity.key] || '#7abfff';
    var typeInfo = Game.Consumables.TYPES[patient.requiredConsumable];
    popupSupply.textContent = typeInfo.name;
    var c = typeInfo.color;
    popupSupplyIcon.style.backgroundColor = 'rgb(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ')';
    popupEl.style.display = 'block';

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
  function createBedIndicator(patient) {
    var typeInfo = Game.Consumables.TYPES[patient.requiredConsumable];
    var canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    var ctx = canvas.getContext('2d');

    // Draw colored circle
    var hex = typeInfo.color;
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw "+" symbol
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(32, 18); ctx.lineTo(32, 46);
    ctx.moveTo(18, 32); ctx.lineTo(46, 32);
    ctx.stroke();

    var texture = new THREE.CanvasTexture(canvas);
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.3, 0.3, 1);
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

  function updateIndicators() {
    var t = Date.now() * 0.003;
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      if (p.indicator) {
        p.indicator.position.x = p.mesh.position.x;
        p.indicator.position.z = p.mesh.position.z;
        p.indicator.position.y = 2.0 + Math.sin(t + p.id) * 0.08;
      }
      if (p.healthBar) {
        p.healthBar.position.x = p.mesh.position.x;
        p.healthBar.position.z = p.mesh.position.z;
        p.healthBar.position.y = 1.7;
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
    Game.Inventory.showNotification('Неправильный расходник!');

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
      if (p.state === 'queued' && p.queueTarget) {
        moveToward(p.mesh.position, p.queueTarget, PATIENT_SPEED * delta);
        p.mesh.rotation.y = Math.PI;
      }
      if (p.state === 'walking' && p.targetPos) {
        var arrived = moveToward(p.mesh.position, p.targetPos, PATIENT_SPEED * delta);
        var dir = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
        if (arrived) {
          p.state = (p.destination && beds.indexOf(p.destination) !== -1) ? 'atBed' : 'waiting';
          p.targetPos = null;
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
        moveToward(p.mesh.position, p.targetPos, PATIENT_SPEED * delta);
      }
      // Leaving: walk to exit then beyond
      if (p.state === 'leaving' && p.targetPos) {
        var dir3 = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
        if (dir3.lengthSq() > 0.01) {
          p.mesh.rotation.y = Math.atan2(dir3.x, dir3.z);
        }
        var arrived3 = moveToward(p.mesh.position, p.targetPos, PATIENT_SPEED * delta);
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
    }
  }

  window.Game.Patients = {
    hasInteraction: function() { return !!hoveredPatient || !!popupPatient; },
    isPopupOpen: function() { return !!popupPatient; },
    getHoveredPatient: function() { return hoveredPatient; },

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
      popupSymptom = document.getElementById('popup-symptom');
      popupDiagnosis = document.getElementById('popup-diagnosis');
      popupSupply = document.getElementById('popup-supply');
      popupSupplyIcon = document.getElementById('popup-supply-icon');
      popupSeverity = document.getElementById('popup-severity');
      btnBed = document.getElementById('btn-bed');
      btnWait = document.getElementById('btn-wait');
      btnDismiss = document.getElementById('btn-dismiss');
      bedCount = document.getElementById('bed-count');
      chairCount = document.getElementById('chair-count');

      // Click to interact
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (popupPatient) return;
        if (!hoveredPatient) return;

        if (hoveredPatient.state === 'atBed') {
          if (hoveredPatient.treated) return;
          var activeType = Game.Inventory.getActive();
          if (!activeType) {
            Game.Inventory.showNotification('Выберите расходник в инвентаре');
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
