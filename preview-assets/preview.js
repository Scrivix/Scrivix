(() => {
  const story = document.querySelector('.story');
  const lesson = document.querySelector('.lesson-story');
  const canvas = document.querySelector('.canvas-story');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smartVideo = document.querySelector('.smart-shape-video');

  if (smartVideo && !reducedMotion.matches && 'IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reducedMotion.matches) {
        smartVideo.play().catch(() => {});
      } else {
        smartVideo.pause();
      }
    }, { threshold: .35 });
    videoObserver.observe(smartVideo);
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) smartVideo.pause();
    });
  }

  if (!story || !lesson || !canvas || reducedMotion.matches) return;

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

    const lessonRect = lesson.getBoundingClientRect();
    const lessonDistance = Math.max(1, lessonRect.height - window.innerHeight);
    const lessonProgress = clamp(-lessonRect.top / lessonDistance);
    lesson.style.setProperty('--lesson-reveal', clamp((lessonProgress - .18) / .48).toFixed(3));

    const canvasRect = canvas.getBoundingClientRect();
    const canvasDistance = Math.max(1, canvasRect.height - window.innerHeight);
    const canvasProgress = clamp(-canvasRect.top / canvasDistance);
    canvas.style.setProperty('--canvas-reveal', clamp((canvasProgress - .18) / .48).toFixed(3));
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
