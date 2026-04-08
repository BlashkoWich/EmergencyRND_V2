(function() {
  window.Game = window.Game || {};

  var level = 1;
  var xp = 0;
  var XP_THRESHOLDS = [10, 150, 400]; // L1->L2 (after tutorial), L2->L3, L3->L4
  var MAX_LEVEL = 4;

  var UNLOCK_DESCRIPTIONS = {
    2: [
      Game.Lang.t('levels.unlock2.0'),
      Game.Lang.t('levels.unlock2.1'),
      Game.Lang.t('levels.unlock2.2')
    ],
    3: [
      Game.Lang.t('levels.unlock3.0'),
      Game.Lang.t('levels.unlock3.1'),
      Game.Lang.t('levels.unlock3.2'),
      Game.Lang.t('levels.unlock3.3')
    ],
    4: [
      Game.Lang.t('levels.unlock4.0')
    ]
  };

  var UNLOCK_LEVELS = {
    consumables: 1,
    instruments: 2,
    furniture: 3,
    upgrades: 3,
    staff: 4
  };

  // DOM elements
  var levelValueEl, xpFillEl, xpTextEl;
  var popupEl, popupTitleEl, popupUnlocksEl, popupCloseBtn;
  var animContainer;
  var isLevelUpPopupOpen = false;
  var controls;

  function updateHUD() {
    if (!levelValueEl) return;
    levelValueEl.textContent = level;

    var threshold = XP_THRESHOLDS[level - 1];
    if (threshold) {
      var pct = Math.min(100, Math.round(xp / threshold * 100));
      xpFillEl.style.width = pct + '%';
      xpTextEl.textContent = xp + '/' + threshold;
    } else {
      // Max level
      xpFillEl.style.width = '100%';
      xpTextEl.textContent = 'MAX';
    }
  }

  function showXPAnimation(amount, breakdown) {
    if (!animContainer) return;

    var el = document.createElement('div');
    el.className = 'xp-float';

    var parts = [];
    if (breakdown.treatment > 0) {
      parts.push('+' + breakdown.treatment + ' ' + Game.Lang.t('levels.xp.treatment'));
    }
    if (breakdown.diagnosis > 0) {
      parts.push('+' + breakdown.diagnosis + ' ' + Game.Lang.t('levels.xp.diagnostics'));
    }
    el.textContent = parts.join(' + ');

    // Position near top-right (near balance/level HUD)
    el.style.top = '100px';
    el.style.right = '20px';

    animContainer.appendChild(el);

    // Remove after animation
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1900);
  }

  function showLevelUpPopup(newLevel) {
    if (!popupEl) return;
    isLevelUpPopupOpen = true;

    popupTitleEl.textContent = Game.Lang.t('levelUp.title', [newLevel]);

    var descs = UNLOCK_DESCRIPTIONS[newLevel] || [];
    popupUnlocksEl.innerHTML = '';
    for (var i = 0; i < descs.length; i++) {
      var p = document.createElement('div');
      p.className = 'level-up-item';
      p.textContent = '\u2714 ' + descs[i];
      popupUnlocksEl.appendChild(p);
    }

    popupEl.style.display = 'block';
    if (controls) controls.unlock();
  }

  function closeLevelUpPopup() {
    popupEl.style.display = 'none';
    isLevelUpPopupOpen = false;
    if (controls) controls.lock();

    // Refresh shop tab locks
    if (Game.Shop && Game.Shop.refreshTabLocks) {
      Game.Shop.refreshTabLocks();
    }
  }

  function onLevelUp(newLevel) {
    showLevelUpPopup(newLevel);
  }

  window.Game.Levels = {
    setup: function(_controls) {
      controls = _controls;

      // Cache HUD elements
      levelValueEl = document.getElementById('level-value');
      xpFillEl = document.getElementById('xp-fill');
      xpTextEl = document.getElementById('xp-text');

      // Cache popup elements
      popupEl = document.getElementById('level-up-popup');
      popupTitleEl = document.getElementById('level-up-title');
      popupUnlocksEl = document.getElementById('level-up-unlocks');
      popupCloseBtn = document.getElementById('level-up-close');

      animContainer = document.getElementById('xp-animation-container');

      if (popupCloseBtn) {
        popupCloseBtn.addEventListener('click', closeLevelUpPopup);
      }

      // Level select screen buttons
      var levelSelectScreen = document.getElementById('level-select-screen');
      var levelBtns = document.querySelectorAll('.level-card-btn');
      for (var i = 0; i < levelBtns.length; i++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var chosenLevel = parseInt(btn.dataset.level, 10);
            level = chosenLevel;
            xp = 0;
            updateHUD();
            // Hide level select, start game
            if (levelSelectScreen) levelSelectScreen.style.display = 'none';
            if (Game.Controls && Game.Controls._controls) {
              Game.Controls._controls.lock();
            }
            // Refresh shop locks
            if (Game.Shop && Game.Shop.refreshTabLocks) {
              Game.Shop.refreshTabLocks();
            }
            // Start tutorial for level 1
            if (Game.Tutorial && Game.Tutorial.checkStart) {
              Game.Tutorial.checkStart();
            }
          });
        })(levelBtns[i]);
      }

      updateHUD();
    },

    setLevel: function(newLevel) {
      level = Math.max(1, Math.min(MAX_LEVEL, newLevel));
      xp = 0;
      updateHUD();
      // Refresh shop locks if available
      if (Game.Shop && Game.Shop.refreshTabLocks) {
        Game.Shop.refreshTabLocks();
      }
    },

    getLevel: function() { return level; },
    getXP: function() { return xp; },
    getXPThreshold: function() {
      return level <= MAX_LEVEL ? (XP_THRESHOLDS[level - 1] || null) : null;
    },

    isPopupOpen: function() { return isLevelUpPopupOpen; },

    awardXP: function(amount, breakdown) {
      if (level >= MAX_LEVEL) return;

      xp += amount;
      showXPAnimation(amount, breakdown || { treatment: amount, diagnosis: 0 });

      // Check for level up
      var threshold = XP_THRESHOLDS[level - 1];
      if (threshold && xp >= threshold) {
        xp -= threshold;
        level++;
        updateHUD();
        onLevelUp(level);
      } else {
        updateHUD();
      }
    },

    isTabUnlocked: function(tabName) {
      var required = UNLOCK_LEVELS[tabName];
      if (required === undefined) return true;
      return level >= required;
    },

    canDiagnose: function() {
      return level >= 2;
    },

    getSeverityPool: function() {
      if (level === 1) return ['mild'];
      if (level === 2) return ['mild', 'medium'];
      return ['mild', 'medium', 'severe'];
    },

    getSpawnMode: function() {
      return level >= 2 ? 'wave' : 'sequential';
    },

    getDiagnosisChance: function() {
      if (level >= 4) return 0.30;
      if (level >= 3) return 0.25;
      return 0.20;
    },

    getSpawnInterval: function() {
      if (level >= 4) return 10;
      if (level >= 3) return 20;
      return 10; // fallback for sequential (not used directly)
    }
  };
})();
