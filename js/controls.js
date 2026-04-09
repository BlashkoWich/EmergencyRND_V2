(function() {
  window.Game = window.Game || {};

  window.Game.Controls = {
    _camera: null,
    _collidables: null,
    _controls: null,
    _THREE: null,
    _raycaster: null,
    _keys: { forward: false, backward: false, left: false, right: false, sprint: false, jump: false },
    _gameEntered: false,
    _moveSpeed: 4.0,
    _sprintSpeed: 7.0,
    _collisionDistance: 0.4,
    _collisionOrigin: null,
    _savedQuat: null,
    _forward: null,
    _right: null,
    _moveDir: null,
    _moveX: null,
    _moveZ: null,
    _velocityY: 0,
    _jumpSpeed: 5.0,
    _gravity: -12.0,
    _groundY: 1.6,
    _isGrounded: true,
    _velocityX: 0,
    _velocityZ: 0,
    _moveDamping: 12.0,
    _mouseDX: 0,
    _mouseDY: 0,
    _mouseEuler: null,

    setup: function(THREE, camera, collidables, PointerLockControls) {
      this._THREE = THREE;
      this._camera = camera;
      this._collidables = collidables;
      this._raycaster = new THREE.Raycaster();
      this._collisionOrigin = new THREE.Vector3();
      this._forward = new THREE.Vector3();
      this._right = new THREE.Vector3();
      this._moveDir = new THREE.Vector3();
      this._moveX = new THREE.Vector3();
      this._moveZ = new THREE.Vector3();

      var controls = new PointerLockControls(camera, document.body);
      controls.pointerSpeed = 0.5;

      // Replace PointerLockControls' mousemove with our own that clamps deltas
      // (prevents camera teleportation from Pointer Lock API browser bug spikes)
      controls.disconnect();
      document.addEventListener('pointerlockchange', function() {
        if (document.pointerLockElement === document.body) {
          controls.isLocked = true;
          controls.dispatchEvent({ type: 'lock' });
        } else {
          controls.isLocked = false;
          controls.dispatchEvent({ type: 'unlock' });
        }
      });

      // Accumulate mouse deltas — rotation applied once per frame in update()
      var MAX_DELTA = 100;
      this._mouseEuler = new THREE.Euler(0, 0, 0, 'YXZ');
      var self2 = this;
      document.addEventListener('mousemove', function(e) {
        if (!controls.isLocked) return;
        var mx = e.movementX || 0;
        var my = e.movementY || 0;
        if (mx > MAX_DELTA) mx = MAX_DELTA; else if (mx < -MAX_DELTA) mx = -MAX_DELTA;
        if (my > MAX_DELTA) my = MAX_DELTA; else if (my < -MAX_DELTA) my = -MAX_DELTA;
        self2._mouseDX += mx;
        self2._mouseDY += my;
      });

      this._controls = controls;
      var self = this;

      var overlay = document.getElementById('overlay');
      var crosshairEl = document.getElementById('crosshair');

      overlay.addEventListener('click', function() {
        overlay.style.display = 'none';
        controls.lock();
        // Refresh shop locks and start tutorial
        if (Game.Shop && Game.Shop.refreshTabLocks) {
          Game.Shop.refreshTabLocks();
        }
        if (Game.Tutorial && Game.Tutorial.checkStart) {
          Game.Tutorial.checkStart();
        }
      });

      var pauseScreen = document.getElementById('pause-screen');
      pauseScreen.addEventListener('click', function() {
        controls.lock();
        var retryCount = 0;
        var retryInterval = setInterval(function() {
          if (controls.isLocked || retryCount >= 10) {
            clearInterval(retryInterval);
            return;
          }
          controls.lock();
          retryCount++;
        }, 500);
      });
      controls.addEventListener('lock', function() {
        self._savedQuat = camera.quaternion.clone();
        self._gameEntered = true;
        overlay.style.display = 'none';
        document.getElementById('pause-screen').style.display = 'none';
        crosshairEl.style.display = 'block';
      });
      controls.addEventListener('unlock', function() {
        if (Game.Tutorial && Game.Tutorial.isActive()) {
          if (Game.Tutorial.isAllowed('movement')) {
            var reLock = function() {
              document.removeEventListener('click', reLock);
              if (Game.Tutorial && Game.Tutorial.isActive() && Game.Tutorial.isAllowed('movement')) {
                controls.lock();
              }
            };
            document.addEventListener('click', reLock);
          }
          return;
        }
        if (Game.Ads && Game.Ads.isActive()) return;
        if (Game.Shop && Game.Shop.isOpen()) return;
        if (Game.Patients && Game.Patients.isPopupOpen()) return;
        if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
        if (Game.Shift && Game.Shift.isPopupOpen()) return;
        if (Game.Levels && Game.Levels.isPopupOpen()) return;
        if (Game.Cashier && Game.Cashier.isPopupOpen()) return;
        if (self._gameEntered) {
          document.getElementById('pause-screen').style.display = 'flex';
          crosshairEl.style.display = 'none';
          document.getElementById('interact-hint').style.display = 'none';
          return;
        }

        overlay.style.display = 'flex';
        crosshairEl.style.display = 'none';
        document.getElementById('interact-hint').style.display = 'none';
      });

      // WASD (layout-independent via e.code)
      var keys = this._keys;
      document.addEventListener('keydown', function(e) {
        switch (e.code) {
          case 'KeyW': keys.forward = true; break;
          case 'KeyS': keys.backward = true; break;
          case 'KeyA': keys.left = true; break;
          case 'KeyD': keys.right = true; break;
          case 'ShiftLeft': keys.sprint = true; break;
          case 'Space': keys.jump = true; e.preventDefault(); break;
        }
      });
      document.addEventListener('keyup', function(e) {
        switch (e.code) {
          case 'KeyW': keys.forward = false; break;
          case 'KeyS': keys.backward = false; break;
          case 'KeyA': keys.left = false; break;
          case 'KeyD': keys.right = false; break;
          case 'ShiftLeft': keys.sprint = false; break;
          case 'Space': keys.jump = false; break;
        }
      });

      return controls;
    },

    update: function(delta) {
      var camera = this._camera;

      // Restore saved orientation after re-lock to prevent camera jump
      if (this._savedQuat) {
        camera.quaternion.copy(this._savedQuat);
        this._savedQuat = null;
        return;
      }

      // Apply accumulated mouse deltas (collected in mousemove, applied once per frame)
      if (this._mouseDX !== 0 || this._mouseDY !== 0) {
        var HALF_PI = Math.PI / 2;
        var euler = this._mouseEuler;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= this._mouseDX * 0.002 * this._controls.pointerSpeed;
        euler.x -= this._mouseDY * 0.002 * this._controls.pointerSpeed;
        euler.x = Math.max(-HALF_PI, Math.min(HALF_PI, euler.x));
        camera.quaternion.setFromEuler(euler);
        this._mouseDX = 0;
        this._mouseDY = 0;
      }

      // --- Smooth movement ---
      var keys = this._keys;
      var baseSpeed = keys.sprint ? this._sprintSpeed : this._moveSpeed;

      var forward = this._forward;
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();

      var right = this._right;
      right.set(0, 0, 0);
      right.crossVectors(forward, camera.up).normalize();

      var targetVX = 0;
      var targetVZ = 0;
      var moveDir = this._moveDir.set(0, 0, 0);
      if (keys.forward)  moveDir.add(forward);
      if (keys.backward) moveDir.sub(forward);
      if (keys.left)     moveDir.sub(right);
      if (keys.right)    moveDir.add(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        targetVX = moveDir.x * baseSpeed;
        targetVZ = moveDir.z * baseSpeed;
      }

      // Lerp velocity towards target
      var damping = 1 - Math.exp(-this._moveDamping * delta);
      this._velocityX += (targetVX - this._velocityX) * damping;
      this._velocityZ += (targetVZ - this._velocityZ) * damping;

      // Apply with collision
      var dx = this._velocityX * delta;
      var dz = this._velocityZ * delta;

      if (dx !== 0) {
        var moveX = this._moveX.set(dx > 0 ? 1 : -1, 0, 0);
        if (this._canMove(moveX)) {
          camera.position.x += dx;
        } else {
          this._velocityX = 0;
        }
      }
      if (dz !== 0) {
        var moveZ = this._moveZ.set(0, 0, dz > 0 ? 1 : -1);
        if (this._canMove(moveZ)) {
          camera.position.z += dz;
        } else {
          this._velocityZ = 0;
        }
      }

      // Jump
      if (keys.jump && this._isGrounded) {
        this._velocityY = this._jumpSpeed;
        this._isGrounded = false;
      }

      this._velocityY += this._gravity * delta;
      camera.position.y += this._velocityY * delta;

      if (camera.position.y <= this._groundY) {
        camera.position.y = this._groundY;
        this._velocityY = 0;
        this._isGrounded = true;
      }
    },

    _canMove: function(direction) {
      this._collisionOrigin.copy(this._camera.position);
      this._collisionOrigin.y = 0.5;
      this._raycaster.set(this._collisionOrigin, direction);
      this._raycaster.far = this._collisionDistance;
      var hits = this._raycaster.intersectObjects(this._collidables);
      return hits.length === 0;
    }
  };
})();
