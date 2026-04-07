/* =====================================================
   Game.Ads — Rewarded ad system
   Shows ad offer when player has insufficient funds.
   Fake 20-second ad video, $200 reward on completion.
   ===================================================== */
(function () {
  'use strict';

  var AD_REWARD = 200;
  var AD_DURATION = 20; // seconds

  // DOM refs
  var offerPopup, adOverlay, rewardOverlay;
  var progressBar, timerLabel, closeBtn, confirmDialog;

  var frozen = false;
  var adTimer = null;
  var adElapsed = 0;
  var adInterval = null;
  var active = false; // any ad UI is showing

  function setup() {
    offerPopup = document.getElementById('ad-offer-popup');
    adOverlay = document.getElementById('ad-overlay');
    rewardOverlay = document.getElementById('ad-reward-animation');
    progressBar = document.getElementById('ad-progress-fill');
    timerLabel = document.getElementById('ad-timer');
    closeBtn = document.getElementById('ad-close-btn');
    confirmDialog = document.getElementById('ad-confirm-dialog');

    // Offer popup buttons
    document.getElementById('ad-watch-btn').addEventListener('click', startAd);
    document.getElementById('ad-decline-btn').addEventListener('click', hideOffer);

    // Close button during ad
    closeBtn.addEventListener('click', showConfirm);

    // Confirm dialog buttons
    document.getElementById('ad-confirm-yes').addEventListener('click', function () {
      hideConfirm();
      cancelAd();
    });
    document.getElementById('ad-confirm-no').addEventListener('click', hideConfirm);
  }

  /* ---------- Offer popup ---------- */

  function showOffer() {
    active = true;
    offerPopup.style.display = 'flex';
  }

  function hideOffer() {
    offerPopup.style.display = 'none';
    active = false;
  }

  /* ---------- Ad playback ---------- */

  function startAd() {
    offerPopup.style.display = 'none';
    adOverlay.style.display = 'flex';
    frozen = true;
    adElapsed = 0;
    updateProgress();

    // Reset slide animations
    var slides = adOverlay.querySelectorAll('.ad-slide');
    for (var i = 0; i < slides.length; i++) {
      slides[i].style.animation = 'none';
      slides[i].offsetHeight; // reflow
      slides[i].style.animation = '';
    }

    adInterval = setInterval(function () {
      adElapsed++;
      updateProgress();
      if (adElapsed >= AD_DURATION) {
        completeAd();
      }
    }, 1000);
  }

  function updateProgress() {
    var pct = Math.min((adElapsed / AD_DURATION) * 100, 100);
    progressBar.style.width = pct + '%';
    var remaining = AD_DURATION - adElapsed;
    timerLabel.textContent = remaining > 0 ? Game.Lang.t('ad.timer', [remaining]) : Game.Lang.t('ad.done');
  }

  function completeAd() {
    clearInterval(adInterval);
    adInterval = null;
    adOverlay.style.display = 'none';

    // Show reward animation
    rewardOverlay.style.display = 'flex';
    // Reset animation
    var rewardText = rewardOverlay.querySelector('.ad-reward-amount');
    rewardText.style.animation = 'none';
    rewardText.offsetHeight;
    rewardText.style.animation = '';

    Game.Cashier.earn(AD_REWARD);

    setTimeout(function () {
      rewardOverlay.style.display = 'none';
      frozen = false;
      active = false;
    }, 2500);
  }

  function cancelAd() {
    clearInterval(adInterval);
    adInterval = null;
    adOverlay.style.display = 'none';
    frozen = false;
    active = false;
  }

  /* ---------- Close confirmation ---------- */

  function showConfirm() {
    confirmDialog.style.display = 'flex';
  }

  function hideConfirm() {
    confirmDialog.style.display = 'none';
  }

  /* ---------- Public API ---------- */

  window.Game = window.Game || {};
  window.Game.Ads = {
    setup: setup,
    show: showOffer,
    isActive: function () { return active; },
    isFrozen: function () { return frozen; }
  };
})();
