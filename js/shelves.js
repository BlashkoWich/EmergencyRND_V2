(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls;
  var shelves = [];
  var hoveredShelf = null;
  var interactRay, screenCenter;
  var hintEl;
  var allShelfParts = []; // all meshes belonging to shelves (for raycasting)

  function createShelf(x, z, rotY, collidables) {
    var group = new THREE.Group();

    var woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6F47, roughness: 0.6 });
    var sideMat = new THREE.MeshStandardMaterial({ color: 0x7A6040, roughness: 0.65 });

    // Back panel
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.05), woodMat);
    back.position.set(0, 0.75, -0.175);
    back.castShadow = true;
    group.add(back);

    // Side panels
    var sideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.4), sideMat);
    sideL.position.set(-0.58, 0.75, 0);
    sideL.castShadow = true;
    group.add(sideL);

    var sideR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.4), sideMat);
    sideR.position.set(0.58, 0.75, 0);
    sideR.castShadow = true;
    group.add(sideR);

    // 3 shelf boards
    var boardYs = [0.3, 0.7, 1.1];
    for (var i = 0; i < boardYs.length; i++) {
      var board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.4), woodMat);
      board.position.set(0, boardYs[i], 0);
      board.castShadow = true;
      group.add(board);
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY || 0;
    scene.add(group);

    // Store all meshes for raycasting
    group.traverse(function(child) {
      if (child.isMesh) {
        child.userData.shelfRef = shelves.length; // index into shelves array
        allShelfParts.push(child);
      }
    });

    // Collision box
    var box = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.5, 0.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    box.position.set(x, 0.75, z);
    box.rotation.y = rotY || 0;
    scene.add(box);
    collidables.push(box);

    // Shelf data with 9 slots (3 per board, 3 boards)
    var shelfData = {
      mesh: group,
      highlightParts: [],
      slots: []
    };

    // Collect highlightable parts
    group.traverse(function(child) {
      if (child.isMesh) shelfData.highlightParts.push(child);
    });

    // Compute slot world positions: 3 items per board (left, center, right)
    var slotXOffsets = [-0.35, 0, 0.35];
    for (var i = 0; i < boardYs.length; i++) {
      for (var j = 0; j < slotXOffsets.length; j++) {
        var localPos = new THREE.Vector3(slotXOffsets[j], boardYs[i] + 0.04, 0.05);
        var worldPos = localPos.clone();
        group.localToWorld(worldPos);
        shelfData.slots.push({ pos: worldPos, item: null, itemMesh: null });
      }
    }

    shelves.push(shelfData);
    return shelfData;
  }

  function highlightShelf(shelf) {
    for (var i = 0; i < shelf.highlightParts.length; i++) {
      var part = shelf.highlightParts[i];
      part.material = part.material.clone();
      part.material.emissive = new THREE.Color(0x00ff44);
      part.material.emissiveIntensity = 0.35;
    }
  }

  function unhighlightShelf(shelf) {
    for (var i = 0; i < shelf.highlightParts.length; i++) {
      var part = shelf.highlightParts[i];
      part.material.emissive = new THREE.Color(0x000000);
      part.material.emissiveIntensity = 0;
    }
  }

  function getShelfFromMesh(mesh) {
    var current = mesh;
    while (current) {
      if (current.userData && current.userData.shelfRef !== undefined) {
        return shelves[current.userData.shelfRef];
      }
      current = current.parent;
    }
    return null;
  }

  function hasEmptySlot(shelf) {
    for (var i = 0; i < shelf.slots.length; i++) {
      if (!shelf.slots[i].item) return true;
    }
    return false;
  }

  function getFirstEmptySlot(shelf) {
    for (var i = 0; i < shelf.slots.length; i++) {
      if (!shelf.slots[i].item) return shelf.slots[i];
    }
    return null;
  }

  function placeItemOnShelf(slot, type) {
    var info = Game.Consumables.TYPES[type];
    var mesh = Game.Consumables.createMesh(type);
    mesh.position.copy(slot.pos);
    mesh.position.y += info.size.y / 2;
    scene.add(mesh);

    slot.item = type;
    slot.itemMesh = mesh;
  }

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      if (hoveredShelf) { unhighlightShelf(hoveredShelf); hoveredShelf = null; }
      return false;
    }
    if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) {
      if (hoveredShelf) { unhighlightShelf(hoveredShelf); hoveredShelf = null; }
      return false;
    }
    if (Game.Consumables.isHoldingBox()) {
      if (hoveredShelf) { unhighlightShelf(hoveredShelf); hoveredShelf = null; }
      return false;
    }

    // Only interact with shelves if player has item in active slot
    var activeItem = Game.Inventory.getActive();
    if (!activeItem) {
      if (hoveredShelf) { unhighlightShelf(hoveredShelf); hoveredShelf = null; }
      return false;
    }

    interactRay.setFromCamera(screenCenter, camera);
    var hits = interactRay.intersectObjects(allShelfParts);
    var newHovered = null;

    if (hits.length > 0) {
      var shelf = getShelfFromMesh(hits[0].object);
      if (shelf && hasEmptySlot(shelf)) {
        newHovered = shelf;
      }
    }

    if (newHovered !== hoveredShelf) {
      if (hoveredShelf) unhighlightShelf(hoveredShelf);
      if (newHovered) highlightShelf(newHovered);
      hoveredShelf = newHovered;
    }

    if (hoveredShelf) {
      hintEl.textContent = 'Положить на ЛКМ';
      hintEl.style.display = 'block';
      return true;
    }
    return false;
  }

  window.Game.Shelves = {
    hasInteraction: function() { return !!hoveredShelf; },

    setup: function(_THREE, _scene, _camera, _controls, collidables) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);
      hintEl = document.getElementById('interact-hint');

      // Create 2 shelves next to each other near back wall, left of reception
      createShelf(-5.5, -11.5, 0, collidables);
      createShelf(-4.2, -11.5, 0, collidables);

      // Place item on shelf on click
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) return;
        if (Game.Consumables.isHoldingBox()) return;
        if (!hoveredShelf) return;

        var type = Game.Inventory.getActive();
        if (!type) return;

        var slot = getFirstEmptySlot(hoveredShelf);
        if (!slot) return;

        Game.Inventory.removeActive();
        placeItemOnShelf(slot, type);
      });
    },

    update: function(delta) {
      updateInteraction();
    }
  };
})();
