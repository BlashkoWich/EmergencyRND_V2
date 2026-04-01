(function() {
  window.Game = window.Game || {};

  var controls;
  var shopEl;
  var isShopOpen = false;
  var countEls = {}; // type -> span element

  function updateCounts() {
    var types = Game.Consumables.TYPES;
    for (var type in types) {
      if (!countEls[type]) continue;
      var inInventory = Game.Inventory.countType(type);
      var onGround = Game.Consumables.countGroundItems(type);
      var inBoxes = Game.Consumables.countBoxItems(type);
      var total = inInventory + onGround + inBoxes;
      countEls[type].textContent = total > 0 ? '(есть: ' + total + ')' : '';
    }
    // Instruments
    var instrTypes = Game.Consumables.INSTRUMENT_TYPES;
    for (var type in instrTypes) {
      if (!countEls[type]) continue;
      var inInventory = Game.Inventory.countType(type);
      var onGround = Game.Consumables.countGroundItems(type);
      var total = inInventory + onGround;
      countEls[type].textContent = total > 0 ? '(есть: ' + total + ')' : '';
    }
  }

  window.Game.Shop = {
    isOpen: function() { return isShopOpen; },

    setup: function(_controls) {
      controls = _controls;
      shopEl = document.getElementById('shop-popup');
      var closeBtn = document.getElementById('shop-close');

      // --- Tab switching ---
      var tabs = shopEl.querySelectorAll('.shop-tab');
      var tabContents = {
        consumables: document.getElementById('shop-tab-consumables'),
        instruments: document.getElementById('shop-tab-instruments')
      };
      for (var t = 0; t < tabs.length; t++) {
        (function(tab) {
          tab.addEventListener('click', function() {
            for (var k = 0; k < tabs.length; k++) tabs[k].classList.remove('active');
            tab.classList.add('active');
            for (var key in tabContents) tabContents[key].style.display = 'none';
            tabContents[tab.dataset.tab].style.display = '';
          });
        })(tabs[t]);
      }

      // --- Consumable buy buttons + count spans ---
      var consumableItems = document.querySelectorAll('#shop-tab-consumables .shop-item');
      for (var i = 0; i < consumableItems.length; i++) {
        var itemEl = consumableItems[i];
        var type = itemEl.dataset.type;

        // Create count span
        var countSpan = document.createElement('span');
        countSpan.className = 'shop-item-count';
        itemEl.insertBefore(countSpan, itemEl.querySelector('.shop-buy-btn'));
        countEls[type] = countSpan;

        // Buy button handler
        (function(btn, t) {
          btn.addEventListener('click', function() {
            var balance = Game.Cashier.getBalance();
            if (balance < 10) {
              Game.Inventory.showNotification('Недостаточно средств!');
              return;
            }
            Game.Cashier.spend(10);
            Game.Consumables.spawnBoxInDeliveryZone(t);
            updateCounts();
          });
        })(itemEl.querySelector('.shop-buy-btn'), type);
      }

      // --- Instrument buy buttons + count spans ---
      var instrumentItems = document.querySelectorAll('#shop-tab-instruments .shop-item');
      for (var i = 0; i < instrumentItems.length; i++) {
        var itemEl = instrumentItems[i];
        var type = itemEl.dataset.type;

        // Create count span
        var countSpan = document.createElement('span');
        countSpan.className = 'shop-item-count';
        itemEl.insertBefore(countSpan, itemEl.querySelector('.shop-buy-btn'));
        countEls[type] = countSpan;

        // Buy button handler
        (function(btn, t) {
          btn.addEventListener('click', function() {
            var balance = Game.Cashier.getBalance();
            if (balance < 1) {
              Game.Inventory.showNotification('Недостаточно средств!');
              return;
            }
            Game.Cashier.spend(1);
            Game.Consumables.spawnInstrumentInDeliveryZone(t);
            updateCounts();
          });
        })(itemEl.querySelector('.shop-buy-btn'), type);
      }

      // Close button
      closeBtn.addEventListener('click', function() {
        shopEl.style.display = 'none';
        isShopOpen = false;
        controls.lock();
      });

      // KeyQ to toggle shop
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'KeyQ') return;
        if (Game.Patients.isPopupOpen()) return;
        if (Game.Cashier.isPopupOpen()) return;
        if (Game.Diagnostics && Game.Diagnostics.isActive()) return;

        if (isShopOpen) {
          shopEl.style.display = 'none';
          isShopOpen = false;
          controls.lock();
        } else if (controls.isLocked) {
          isShopOpen = true;
          shopEl.style.display = 'block';
          controls.unlock();
          updateCounts();
        }
      });
    }
  };
})();
