(function() {
  window.Game = window.Game || {};

  var slots = [null, null, null, null, null, null];
  var activeSlot = 0;
  var barEl, slotEls, notificationEl, hintsEl, hintShopEl, hintDropEl;
  var notificationTimer = null;

  function createUI() {
    // Container for inventory + hints
    var container = document.createElement('div');
    container.id = 'inventory-container';

    // Inventory bar
    barEl = document.createElement('div');
    barEl.id = 'inventory-bar';

    for (var i = 0; i < 6; i++) {
      var slot = document.createElement('div');
      slot.className = 'inv-slot' + (i === 0 ? ' active' : '');
      slot.dataset.index = i;

      var item = document.createElement('div');
      item.className = 'inv-item';
      slot.appendChild(item);

      var label = document.createElement('span');
      label.className = 'inv-label';
      label.textContent = String(i + 1);
      slot.appendChild(label);

      barEl.appendChild(slot);
    }
    container.appendChild(barEl);

    // Hints row
    hintsEl = document.createElement('div');
    hintsEl.id = 'inventory-hints';

    hintShopEl = document.createElement('span');
    hintShopEl.className = 'inv-hint';
    hintShopEl.textContent = 'Q — Магазин';
    hintsEl.appendChild(hintShopEl);

    hintDropEl = document.createElement('span');
    hintDropEl.className = 'inv-hint';
    hintDropEl.textContent = 'G — Бросить';
    hintDropEl.style.display = 'none';
    hintsEl.appendChild(hintDropEl);

    container.appendChild(hintsEl);
    document.body.appendChild(container);
    slotEls = barEl.querySelectorAll('.inv-slot');

    // Notification
    notificationEl = document.createElement('div');
    notificationEl.id = 'notification';
    document.body.appendChild(notificationEl);
  }

  function refreshUI() {
    var types = Game.Consumables.TYPES;
    for (var i = 0; i < 6; i++) {
      var el = slotEls[i];
      var itemEl = el.querySelector('.inv-item');
      el.className = 'inv-slot' + (i === activeSlot ? ' active' : '');

      if (slots[i]) {
        var info = types[slots[i]];
        itemEl.style.backgroundColor = '#' + info.color.toString(16).padStart(6, '0');
        itemEl.style.display = 'block';
        itemEl.title = info.name;
      } else {
        itemEl.style.display = 'none';
        itemEl.title = '';
      }
    }

    // Show/hide drop hint based on active slot content
    if (hintDropEl) {
      hintDropEl.style.display = slots[activeSlot] ? 'inline' : 'none';
    }
  }

  window.Game.Inventory = {
    setup: function() {
      createUI();

      document.addEventListener('keydown', function(e) {
        var digit = null;
        switch (e.code) {
          case 'Digit1': digit = 0; break;
          case 'Digit2': digit = 1; break;
          case 'Digit3': digit = 2; break;
          case 'Digit4': digit = 3; break;
          case 'Digit5': digit = 4; break;
          case 'Digit6': digit = 5; break;
        }
        if (digit !== null) {
          activeSlot = digit;
          refreshUI();
        }
      });

      refreshUI();
    },

    addItem: function(type) {
      for (var i = 0; i < 6; i++) {
        if (slots[i] === null) {
          slots[i] = type;
          refreshUI();
          return true;
        }
      }
      return false;
    },

    removeActive: function() {
      var type = slots[activeSlot];
      if (type) {
        slots[activeSlot] = null;
        refreshUI();
      }
      return type;
    },

    getActive: function() {
      return slots[activeSlot];
    },

    getActiveIndex: function() {
      return activeSlot;
    },

    isFull: function() {
      for (var i = 0; i < 6; i++) {
        if (slots[i] === null) return false;
      }
      return true;
    },

    countType: function(type) {
      var count = 0;
      for (var i = 0; i < 6; i++) {
        if (slots[i] === type) count++;
      }
      return count;
    },

    showNotification: function(text) {
      notificationEl.textContent = text;
      notificationEl.style.display = 'block';
      notificationEl.style.opacity = '1';
      if (notificationTimer) clearTimeout(notificationTimer);
      notificationTimer = setTimeout(function() {
        notificationEl.style.opacity = '0';
        setTimeout(function() {
          notificationEl.style.display = 'none';
        }, 400);
      }, 2000);
    }
  };
})();
