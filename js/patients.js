(function() {
  window.Game = window.Game || {};

  // --- Patient data pools ---
  var NAMES = ['Иван','Алексей','Дмитрий','Сергей','Андрей','Михаил','Николай','Павел','Олег','Виктор',
               'Мария','Анна','Елена','Ольга','Наталья','Татьяна','Светлана','Ирина','Екатерина','Юлия'];
  var SURNAMES = ['Иванов','Петров','Сидоров','Козлов','Новиков','Морозов','Волков','Соколов','Лебедев','Попов',
                  'Иванова','Петрова','Сидорова','Козлова','Новикова','Морозова','Волкова','Соколова','Лебедева','Попова'];
  var SYMPTOMS = ['Головная боль','Боль в горле','Кашель','Температура 38.5\u00B0','Тошнота','Боль в спине',
                  'Головокружение','Слабость','Боль в животе','Одышка'];
  var CAUSES = ['Переохлаждение','Вирусная инфекция','Стресс','Аллергическая реакция','Пищевое отравление',
                'Физическая перегрузка','Хроническое заболевание','Бактериальная инфекция','Недосыпание','Обезвоживание'];
  var SUPPLIES = ['Бинт','Антисептик','Шприц','Капельница','Термометр','Таблетки','Мазь','Пластырь','Ингалятор','Компресс'];
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

  // --- UI elements ---
  var hintEl, popupEl, popupName, popupSymptom, popupCause, popupSupply;
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

    var patient = {
      id: patientIdCounter++,
      name: randomFrom(NAMES),
      surname: randomFrom(SURNAMES),
      symptom: randomFrom(SYMPTOMS),
      cause: randomFrom(CAUSES),
      supply: randomFrom(SUPPLIES),
      mesh: mesh,
      state: 'queued',
      targetPos: null,
      queueTarget: null,
      destination: null
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
      if (p.state === 'queued' || p.state === 'interacting') {
        p.mesh.traverse(function(child) {
          if (child.isMesh) meshes.push(child);
        });
      }
    }

    var hits = interactRay.intersectObjects(meshes);
    var newHovered = null;

    if (hits.length > 0) {
      newHovered = getPatientFromMesh(hits[0].object);
    }

    if (newHovered !== hoveredPatient) {
      if (hoveredPatient) unhighlightPatient(hoveredPatient);
      if (newHovered) highlightPatient(newHovered);
      hoveredPatient = newHovered;
    }

    hintEl.style.display = hoveredPatient ? 'block' : 'none';
  }

  function openPopup(patient) {
    popupPatient = patient;
    patient.state = 'interacting';
    popupName.textContent = patient.name + ' ' + patient.surname;
    popupSymptom.textContent = patient.symptom;
    popupCause.textContent = patient.cause;
    popupSupply.textContent = patient.supply;
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
        }
      }
    }
  }

  window.Game.Patients = {
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
      popupCause = document.getElementById('popup-cause');
      popupSupply = document.getElementById('popup-supply');
      btnBed = document.getElementById('btn-bed');
      btnWait = document.getElementById('btn-wait');
      bedCount = document.getElementById('bed-count');
      chairCount = document.getElementById('chair-count');

      // Click to interact
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (popupPatient) return;
        if (!hoveredPatient) return;
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
      updateInteraction();
    }
  };
})();
