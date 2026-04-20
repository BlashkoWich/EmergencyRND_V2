(function() {
  window.Game = window.Game || {};

  // Player diagnostics minigames were removed — diagnosis is now only performed by
  // the hired diagnostician. This module remains as a no-op stub so that other
  // modules (controls.js, shop.js, ads.js) can safely call the legacy API.
  window.Game.Diagnostics = {
    setup: function() {},
    update: function() {},
    isActive: function() { return false; },
    getPatient: function() { return null; },
    startMinigame: function() {}
  };
})();
