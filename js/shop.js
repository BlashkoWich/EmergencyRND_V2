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

      // Buy buttons + count spans
      var items = shopEl.querySelectorAll('.shop-item');
      for (var i = 0; i < items.length; i++) {
        var itemEl = items[i];
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
            Game.Consumables.spawnInDeliveryZone(t);
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
