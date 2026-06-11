/* Horizontal menu with tap-triggered dropdowns (WordPress-style) on mobile,
   where :hover isn't available. Tap a parent to drop its panel; tap outside to
   close. Desktop is untouched (CSS hover). */
(function () {
  var mq = window.matchMedia('(max-width:640px)');
  function closeAll(except) {
    document.querySelectorAll('.site-nav .has-sub.open').forEach(function (o) {
      if (o !== except) o.classList.remove('open');
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.site-nav .has-sub > a');
    if (a && mq.matches) {
      e.preventDefault();
      var li = a.parentElement, isOpen = li.classList.contains('open');
      closeAll(li);
      li.classList.toggle('open', !isOpen);
      a.blur();
      return;
    }
    if (mq.matches && !e.target.closest('.site-nav .has-sub.open')) closeAll(null);
  });
})();
