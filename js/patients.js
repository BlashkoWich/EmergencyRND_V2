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
  var hintEl, popupEl, popupName, popupSymptom, popupDiagnosis, popupSupply, popupSupplyIcon;
  var btnBed, btnWait, bedCount, chairCount;

  // --- Interaction raycaster ---
  var interactRay;
  var screenCenter;

  function getQueuePosition(index) {
    return new THREE.Vector3(0, 0, -9 + index);
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
      animating: false
    };

    patients.push(patient);
    queue.push(patient);
    updateQueueTargets();

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
    if (!controls.isLocked || popupPatient) {
      hintEl.style.display = 'none';
      return;
    }

    interactRay.setFromCamera(screenCenter, camera);

    var meshes = [];
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      if (p.animating) continue;
      if (p.state === 'queued' || p.state === 'interacting' || p.state === 'atBed') {
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
      var activeType = Game.Inventory.getActive();
      if (activeType) {
        var typeName = Game.Consumables.TYPES[activeType].name;
        hintEl.textContent = 'ЛКМ — Применить ' + typeName;
      } else {
        hintEl.textContent = 'Нужен расходник';
      }
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = 'Нажмите ЛКМ для взаимодействия';
      hintEl.style.display = 'block';
    }
  }

  function openPopup(patient) {
    popupPatient = patient;
    patient.state = 'interacting';
    popupName.textContent = patient.name + ' ' + patient.surname;
    popupSymptom.textContent = patient.symptom;
    popupDiagnosis.textContent = patient.diagnosis;
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
    btnWait.disabled = freeChairs === 0;
    btnWait.style.opacity = freeChairs > 0 ? '1' : '0.4';
    chairCount.textContent = '(' + freeChairs + '/' + waitingChairs.length + ')';

    controls.unlock();
  }

  function closePopup() {
    popupEl.style.display = 'none';
    popupPatient = null;
    controls.lock();
  }

  function sendPatient(patient, dest, slot) {
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

  function updateIndicators() {
    var t = Date.now() * 0.003;
    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      if (p.indicator) {
        p.indicator.position.x = p.mesh.position.x;
        p.indicator.position.z = p.mesh.position.z;
        p.indicator.position.y = 2.0 + Math.sin(t + p.id) * 0.08;
      }
    }
  }

  // --- Treatment ---
  function treatPatient(patient) {
    Game.Inventory.removeActive();
    patient.animating = true;
    Game.Inventory.showNotification('Пациент вылечен!');

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

  function removePatient(patient) {
    if (patient.indicator) {
      scene.remove(patient.indicator);
      patient.indicator = null;
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
          removePatient(anim.patient);
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

  function updatePatients(delta) {
    for (var i = 0; i < patients.length; i++) {
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
      btnBed = document.getElementById('btn-bed');
      btnWait = document.getElementById('btn-wait');
      bedCount = document.getElementById('bed-count');
      chairCount = document.getElementById('chair-count');

      // Click to interact
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (popupPatient) return;
        if (!hoveredPatient) return;

        if (hoveredPatient.state === 'atBed') {
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

      // Spawn first patient immediately
      spawnPatient(true);
    },

    update: function(delta) {
      // Spawn patients
      spawnTimer += delta;
      if (spawnTimer >= SPAWN_INTERVAL) {
        spawnTimer = 0;
        spawnPatient();
      }

      updatePatients(delta);
      updateAnimations(delta);
      updateIndicators();
      updateInteraction();
    }
  };
})();
