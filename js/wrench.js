(function() {
  window.Game = window.Game || {};

  var THREE, camera, controls;
  var equipped = false;
  var wrenchGroup = null;

  function createWrenchMesh() {
    var group = new THREE.Group();

    var metalMat = new THREE.MeshLambertMaterial({ color: 0x888899 });
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x333344 });

    // Handle (long shaft)
    var handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), metalMat);
    handle.position.y = 0;
    group.add(handle);

    // Grip band (dark)
    var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8), darkMat);
    grip.position.y = -0.06;
    group.add(grip);

    // Head (open-end box)
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.05), metalMat);
    head.position.y = 0.14;
    group.add(head);

    // Open jaw notch (dark cube on the head edge)
    var notch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.025), darkMat);
    notch.position.set(0.025, 0.14, 0.025);
    group.add(notch);

    // First-person placement: front-lower-right of camera
    group.position.set(0.28, -0.22, -0.45);
    group.rotation.set(Math.PI / 8, 0, -Math.PI / 5);
    group.visible = false;

    return group;
  }

  function canToggle() {
    if (!controls || !controls.isLocked) return false;
    if (Game.Patients && Game.Patients.isPopupOpen && Game.Patients.isPopupOpen()) return false;
    if (Game.Shop && Game.Shop.isOpen && Game.Shop.isOpen()) return false;
    if (Game.Cashier && Game.Cashier.isPopupOpen && Game.Cashier.isPopupOpen()) return false;
    if (Game.Diagnostics && Game.Diagnostics.isActive && Game.Diagnostics.isActive()) return false;
    if (Game.Furniture && Game.Furniture.isCarrying && Game.Furniture.isCarrying()) return false;
    return true;
  }

  function onKeyDown(e) {
    if (e.code !== 'KeyR') return;
    if (!canToggle()) return;
    equipped = !equipped;
    if (wrenchGroup) wrenchGroup.visible = equipped;
    if (Game.Inventory && Game.Inventory.showNotification) {
      Game.Inventory.showNotification(
        equipped ? Game.Lang.t('wrench.equipped') : Game.Lang.t('wrench.unequipped'),
        'rgba(80, 120, 180, 0.85)'
      );
    }
  }

  window.Game.Wrench = {
    setup: function(_THREE, _scene, _camera, _controls) {
      THREE = _THREE;
      camera = _camera;
      controls = _controls;

      wrenchGroup = createWrenchMesh();
      camera.add(wrenchGroup);
      // Ensure camera is in the scene graph so children render
      if (!camera.parent) _scene.add(camera);

      document.addEventListener('keydown', onKeyDown);
    },

    isEquipped: function() { return equipped; },

    setEquipped: function(val) {
      equipped = !!val;
      if (wrenchGroup) wrenchGroup.visible = equipped;
    }
  };
})();
