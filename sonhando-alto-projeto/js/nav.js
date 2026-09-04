(function(){
  var nav = document.getElementById('siteNav');
  var toggleBtn = document.getElementById('navToggleBtn');
  var closeBtn = document.getElementById('navCloseBtn');
  var drawer = document.getElementById('navDrawer');
  var backdrop = document.getElementById('navBackdrop');

  function onScroll(){
    if(!nav) return;
    if(window.scrollY > 10){
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  function openDrawer(){
    drawer.classList.add('open');
    backdrop.classList.add('open');
  }
  function closeDrawer(){
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
  }

  if(toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if(closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if(backdrop) backdrop.addEventListener('click', closeDrawer);
  if(drawer){
    drawer.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', closeDrawer);
    });
  }
})();
