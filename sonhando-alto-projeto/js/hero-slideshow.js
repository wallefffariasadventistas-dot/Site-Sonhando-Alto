(function(){
  function initSlideshow(id){
    var wrap = document.getElementById(id);
    if(!wrap) return;
    var slides = wrap.querySelectorAll('.hero-bg-slide');
    if(!slides.length) return;
    var current = 0;
    slides[0].classList.add('is-active');

    function nextSlide(){
      var prev = current;
      current = (current + 1) % slides.length;
      slides[current].classList.add('is-active');
      slides[prev].classList.remove('is-active');
    }

    setInterval(nextSlide, 9000);
  }

  initSlideshow('heroBgSlideshow');
  initSlideshow('heroBgSlideshowMobile');
})();
