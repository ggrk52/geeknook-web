(() => {
  if (!('IntersectionObserver' in window)) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  const scenes = document.querySelectorAll('[data-paper-desk]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, intersectionRatio }) => {
      if (intersectionRatio < 0.45) return;
      observer.unobserve(target);
      target.classList.remove('paper-desk--waiting');
      if (!reducedMotion.matches) target.classList.add('paper-desk--playing');
    });
  }, { threshold: 0.45 });

  scenes.forEach(scene => {
    scene.classList.add('paper-desk--waiting');
    observer.observe(scene);
  });
})();
