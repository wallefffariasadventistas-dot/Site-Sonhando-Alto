(function(){
  var revealSelector = [
    '.section-heading',
    '.pillars-intro',
    '.pillar-row',
    '.benefit-card',
    '.requirements-list li',
    '.university-card',
    '.project-info-card',
    '.stat-card',
    '.galeria-card',
    '.leads-card',
    '.projeto-opcao',
    '.footer-cta-buttons',
    '.footer-col',
    '.about-section > .about-text'
  ].join(',');

  var supportsIO = typeof IntersectionObserver !== 'undefined';

  var io = supportsIO ? new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -60px 0px'}) : null;

  function processNewReveals(){
    var candidates = document.querySelectorAll(revealSelector);
    var fresh = [];
    candidates.forEach(function(el){
      if(!el.classList.contains('reveal')){
        el.classList.add('reveal');
        fresh.push(el);
      }
    });
    if(!fresh.length) return;

    if(!supportsIO){
      fresh.forEach(function(el){ el.classList.add('is-visible'); });
      return;
    }

    var parents = [];
    fresh.forEach(function(el){
      if(el.parentElement && parents.indexOf(el.parentElement) === -1){
        parents.push(el.parentElement);
      }
    });
    parents.forEach(function(parent){
      var kids = Array.prototype.filter.call(parent.children, function(c){
        return fresh.indexOf(c) !== -1;
      });
      kids.forEach(function(el, i){
        el.style.transitionDelay = (Math.min(i,6) * 0.08) + 's';
      });
    });

    fresh.forEach(function(el){ io.observe(el); });
  }

  function start(){
    processNewReveals();
    var n = 0;
    var t = setInterval(function(){
      processNewReveals();
      n++;
      if(n > 15) clearInterval(t);
    }, 1000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
