(function() {
  window.Game = window.Game || {};

  var THREE, camera, controls;
  var ray, center;
  var modules = [];
  var activeModule = null;
  var hitResults = {};
  var prevActive = null;
  var holdFrames = 0;
  var HOLD_MIN = 4; // keep active module for at least N frames to prevent flicker

  window.Game.Interaction = {
    setup: function(_THREE, _camera, _controls) {
      THREE = _THREE;
      camera = _camera;
      controls = _controls;
      ray = new THREE.Raycaster();
      center = new THREE.Vector2(0, 0);
    },

    register: function(name, getMeshesFn, recursive, maxDist) {
      modules.push({
        name: name,
        getMeshes: getMeshesFn,
        recursive: !!recursive,
        maxDist: maxDist || 5
      });
    },

    update: function() {
      var newActive = null;
      hitResults = {};

      if (!controls.isLocked) {
        activeModule = null;
        prevActive = null;
        holdFrames = 0;
        return;
      }

      ray.setFromCamera(center, camera);

      var bestDist = Infinity;

      for (var i = 0; i < modules.length; i++) {
        var mod = modules[i];
        var meshes = mod.getMeshes();
        if (!meshes || meshes.length === 0) continue;

        ray.far = mod.maxDist;
        var hits = ray.intersectObjects(meshes, mod.recursive);

        if (hits.length > 0) {
          hitResults[mod.name] = hits;
          if (hits[0].distance < bestDist) {
            bestDist = hits[0].distance;
            newActive = mod.name;
          }
        }
      }

      // Hysteresis: keep previous module active for a few frames to prevent flicker
      if (newActive === prevActive) {
        holdFrames = HOLD_MIN;
      } else if (newActive !== null) {
        // Switched to a different module — switch immediately
        prevActive = newActive;
        holdFrames = HOLD_MIN;
      } else {
        // Nothing hit — hold previous for a few frames
        holdFrames--;
        if (holdFrames > 0) {
          newActive = prevActive;
        } else {
          prevActive = null;
        }
      }

      activeModule = newActive;
    },

    isActive: function(name) {
      return activeModule === name;
    },

    getActive: function() {
      return activeModule;
    },

    hasAny: function() {
      return activeModule !== null;
    },

    getHits: function(name) {
      return hitResults[name] || null;
    },

    getRay: function() {
      return ray;
    }
  };
})();
