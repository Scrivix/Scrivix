(() => {
  const story = document.querySelector('.story');
  const lesson = document.querySelector('.lesson-story');
  const canvas = document.querySelector('.canvas-story');
  const smartDemo = document.querySelector('.smart-shape-demo');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileDemo = window.matchMedia('(max-width: 700px)');
  const smartVideo = document.querySelector('.smart-shape-video');
  const smartPlayer = document.querySelector('.smart-shape-player');
  const playButton = document.querySelector('.smart-shape-play');

  if (!story || !lesson || !canvas || !smartDemo || !smartVideo || !smartPlayer || !playButton) return;
  smartVideo.pause();

  const canScrubVideo = () => !reducedMotion.matches && !mobileDemo.matches && Number.isFinite(smartVideo.duration) && smartVideo.duration > 0;

  playButton.addEventListener('click', () => {
    smartVideo.controls = true;
    smartVideo.play().catch(() => {});
  });
  smartVideo.addEventListener('play', () => smartPlayer.classList.add('is-playing'));
  smartVideo.addEventListener('ended', () => smartPlayer.classList.remove('is-playing'));

  reducedMotion.addEventListener('change', () => {
    smartVideo.controls = !canScrubVideo();
    if (reducedMotion.matches) {
      smartVideo.pause();
      story.style.removeProperty('--progress');
      story.style.removeProperty('--ipad-left');
      story.style.removeProperty('--reveal');
      lesson.style.removeProperty('--lesson-reveal');
      canvas.style.removeProperty('--canvas-reveal');
      smartDemo.style.removeProperty('--smart-progress');
    }
    requestUpdate();
  });

  smartVideo.addEventListener('loadedmetadata', () => {
    if (canScrubVideo()) {
      smartVideo.pause();
      smartVideo.controls = false;
    }
    requestUpdate();
  });

  mobileDemo.addEventListener('change', () => {
    smartVideo.pause();
    smartVideo.controls = !canScrubVideo();
    requestUpdate();
  });

  let ticking = false;
  const clamp = (value) => Math.max(0, Math.min(1, value));

  function update() {
    if (reducedMotion.matches) {
      ticking = false;
      return;
    }
    const rect = story.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    const progress = clamp(-rect.top / distance);
    const reveal = clamp((progress - .22) / .43);
    story.style.setProperty('--progress', progress.toFixed(3));
    story.style.setProperty('--ipad-left', `${(50 - reveal * 25).toFixed(1)}%`);
    story.style.setProperty('--reveal', reveal.toFixed(3));

    const lessonRect = lesson.getBoundingClientRect();
    const lessonDistance = Math.max(1, lessonRect.height - window.innerHeight);
    const lessonProgress = clamp(-lessonRect.top / lessonDistance);
    lesson.style.setProperty('--lesson-reveal', clamp((lessonProgress - .18) / .48).toFixed(3));

    const canvasRect = canvas.getBoundingClientRect();
    const canvasDistance = Math.max(1, canvasRect.height - window.innerHeight);
    const canvasProgress = clamp(-canvasRect.top / canvasDistance);
    canvas.style.setProperty('--canvas-reveal', clamp((canvasProgress - .18) / .48).toFixed(3));

    if (canScrubVideo()) {
      const smartRect = smartDemo.getBoundingClientRect();
      const smartDistance = Math.max(1, smartRect.height - window.innerHeight);
      const smartProgress = clamp(-smartRect.top / smartDistance);
      const targetTime = Math.min(Math.max(0, smartVideo.duration - .04), smartProgress * smartVideo.duration);
      smartDemo.style.setProperty('--smart-progress', `${(smartProgress * 100).toFixed(1)}%`);
      if (Math.abs(smartVideo.currentTime - targetTime) > .04) {
        smartVideo.currentTime = targetTime;
      }
    }
    ticking = false;
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  if (!reducedMotion.matches) requestUpdate();
})();
