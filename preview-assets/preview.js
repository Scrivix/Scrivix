(() => {
  const story = document.querySelector('.story');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!story || reducedMotion.matches) return;

  let ticking = false;
  const clamp = (value) => Math.max(0, Math.min(1, value));

  function update() {
    const rect = story.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    const progress = clamp(-rect.top / distance);
    const reveal = clamp((progress - .22) / .43);
    story.style.setProperty('--progress', progress.toFixed(3));
    story.style.setProperty('--shift', `${((1 - reveal) * 52).toFixed(1)}%`);
    story.style.setProperty('--reveal', reveal.toFixed(3));
    ticking = false;
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  requestUpdate();
})();
