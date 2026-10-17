/* Guardian — interactive website. No framework or tracking libraries required. */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const globeArea = byId('globe-interaction');
  const canvas = byId('globe-canvas');
  const head = byId('guardian-head');
  const options = [
    { icon: '✦', name: 'Plan your week', caption: 'A clearer path to what matters' },
    { icon: '◈', name: 'Explore ideas', caption: 'Fresh angles on big questions' },
    { icon: '◎', name: 'Remember details', caption: 'Context you choose to keep' },
    { icon: '✉', name: 'Draft a reply', caption: 'Find just the right words' },
    { icon: '⌁', name: 'Research a topic', caption: 'Go deeper, find the signal' },
    { icon: '◷', name: 'Organize your time', caption: 'Make your day feel lighter' },
    { icon: '✳', name: 'Create together', caption: 'From first spark to final draft' },
    { icon: '✓', name: 'Manage next steps', caption: 'A little less to juggle' },
    { icon: '◇', name: 'Explore the world', caption: 'Think through your next trip' }
  ];
  let active = 0;
  const wrapIndex = (n) => (n + options.length) % options.length;

  function showOptions(animate = true) {
    [-1, 0, 1].forEach((offset, n) => {
      const prefix = `card-${'abc'[n]}`;
      const option = options[wrapIndex(active + offset)];
      const card = byId(`orbit-card-${'abc'[n]}`);
      if (!card) return;
      if (animate && !prefersReducedMotion) {
        card.classList.remove('card-arrived');
        void card.offsetWidth;
        card.classList.add('card-arrived');
      }
      byId(`${prefix}-icon`).textContent = option.icon;
      byId(`${prefix}-title`).textContent = option.name;
      byId(`${prefix}-caption`).textContent = option.caption;
    });
    globeArea.setAttribute('aria-label', `Interactive rotating Guardian globe. Currently exploring ${options[active].name}. Drag or use arrow keys to explore more.`);
  }

  const globe = {
    longitude: -0.38,
    latitude: 0.17,
    aimLongitude: -0.38,
    aimLatitude: 0.17,
    last: 0,
    size: 0,
    dpr: 1,
    interaction: 0
  };
  let isDragging = false;
  let pointerStart = null;
  let totalDragged = 0;
  let dragIndex = 0;
  let pointerDownPosition = null;
  let frame = 0;
  let lastGlobePaint = 0;
  let globeInView = true;
  const ctx = canvas && canvas.getContext('2d', { alpha: true });

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const bounds = canvas.getBoundingClientRect();
    const size = Math.max(1, Math.round(Math.min(bounds.width, bounds.height)));
    globe.size = size;
    globe.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * globe.dpr);
    canvas.height = Math.round(size * globe.dpr);
    ctx.setTransform(globe.dpr, 0, 0, globe.dpr, 0, 0);
    drawGlobe();
  }

  function project(lat, lon) {
    const p = lat * Math.PI / 180;
    const a = lon * Math.PI / 180 + globe.longitude;
    const cp = Math.cos(p), sp = Math.sin(p);
    const ca = Math.cos(a), sa = Math.sin(a);
    const ct = Math.cos(globe.latitude), st = Math.sin(globe.latitude);
    return {
      x: cp * sa,
      y: -(sp * ct - cp * ca * st),
      z: cp * ca * ct + sp * st
    };
  }

  function paintPath(points, radius, cx, cy, alpha) {
    ctx.beginPath();
    let open = false;
    let last = null;
    for (const point of points) {
      const out = project(point[0], point[1]);
      if (out.z <= 0.018) { open = false; last = null; continue; }
      const x = cx + out.x * radius, y = cy + out.y * radius;
      if (!open || (last && Math.hypot(x - last.x, y - last.y) > radius * 0.19)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      open = true;
      last = { x, y };
    }
    ctx.strokeStyle = `rgba(218,180,134,${alpha})`;
    ctx.stroke();
  }

  function drawGlobe() {
    if (!ctx || !globe.size) return;
    const s = globe.size, cx = s / 2, cy = s / 2;
    const radius = s * .478;
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.clip();
    const tone = ctx.createRadialGradient(cx - radius * .48, cy - radius * .46, radius * .08, cx + radius * .14, cy + radius * .10, radius * 1.28);
    tone.addColorStop(0, 'rgba(255,255,255,.26)');
    tone.addColorStop(.55, 'rgba(217,228,242,.14)');
    tone.addColorStop(1, 'rgba(103,132,178,.25)');
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, s, s);

    // Latitude and longitude wires suggest a 3D glass globe, not a flat map.
    ctx.lineWidth = Math.max(.35, s / 850);
    for (let lat = -75; lat <= 75; lat += 15) {
      const points = [];
      for (let lon = -180; lon <= 180; lon += 3) points.push([lat, lon]);
      paintPath(points, radius, cx, cy, .12);
    }
    for (let lon = -180; lon < 180; lon += 20) {
      const points = [];
      for (let lat = -90; lat <= 90; lat += 3) points.push([lat, lon]);
      paintPath(points, radius, cx, cy, .12);
    }

    const data = window.GUARDIAN_WORLD;
    if (data) {
      ctx.lineWidth = Math.max(.6, s * .0026);
      for (const line of data.coasts) paintPath(line, radius, cx, cy, .60);
      for (const [lat, lon, strength] of data.dots) {
        const point = project(lat, lon);
        if (point.z <= .02) continue;
        const x = cx + point.x * radius;
        const y = cy + point.y * radius;
        const r = (strength * 1.15 + point.z * .75) * s / 440;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(206,158,107,${Math.min(.9, .22 + point.z * .64)})`;
        ctx.fill();
        if (strength > .89 && point.z > .5) {
          ctx.beginPath();
          ctx.arc(x, y, r * 2.65, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(235,194,138,.09)';
          ctx.fill();
        }
      }
    }
    ctx.restore();
    const edge = ctx.createRadialGradient(cx, cy, radius * .79, cx, cy, radius);
    edge.addColorStop(0, 'rgba(255,255,255,0)');
    edge.addColorStop(1, 'rgba(255,255,255,.75)');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,.74)';
    ctx.lineWidth = s * .008;
    ctx.stroke();
    ctx.fillStyle = edge;
    ctx.fill();
  }

  function rotateFeature(direction) {
    active = wrapIndex(active + direction);
    globe.aimLongitude += direction * Math.PI / 5.5;
    globe.interaction = performance.now();
    showOptions();
  }

  byId('globe-next')?.addEventListener('click', () => rotateFeature(1));
  byId('globe-prev')?.addEventListener('click', () => rotateFeature(-1));

  globeArea?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); rotateFeature(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); rotateFeature(-1); }
  });
  globeArea?.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isDragging = true;
    totalDragged = 0;
    pointerStart = { x: e.clientX, y: e.clientY, initialLongitude: globe.aimLongitude, initialLatitude: globe.aimLatitude };
    dragIndex = active;
    pointerDownPosition = { x: e.clientX, y: e.clientY, onHead: !!head && (() => { const r = head.getBoundingClientRect(); return e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12; })() };
    globe.interaction = performance.now();
    globeArea.classList.add('dragging');
    globeArea.setPointerCapture(e.pointerId);
  });
  globeArea?.addEventListener('pointermove', (e) => {
    if (!isDragging || !pointerStart) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    totalDragged = dx;
    globe.aimLongitude = pointerStart.initialLongitude + dx * .007;
    globe.aimLatitude = Math.max(-.7, Math.min(.7, pointerStart.initialLatitude - dy * .004));
    globe.interaction = performance.now();
    const steps = Math.trunc(dx / 95);
    const next = wrapIndex(dragIndex + steps);
    if (next !== active) { active = next; showOptions(); }
  });
  const endDrag = () => { isDragging = false; pointerStart = null; pointerDownPosition = null; globeArea?.classList.remove('dragging'); };
  globeArea?.addEventListener('pointerup', (e) => {
    if (pointerDownPosition?.onHead && Math.hypot(e.clientX - pointerDownPosition.x, e.clientY - pointerDownPosition.y) < 15) surpriseFace(head);
    endDrag();
  });
  globeArea?.addEventListener('pointercancel', endDrag);
  globeArea?.addEventListener('lostpointercapture', endDrag);

  // Every Guardian face gets its own gaze, based on its own position on screen.
  // The old design moved a full-size layer inside a fully filled eye; it looked static.
  // Our smaller illuminated pupils now visibly move within each eye socket.
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const faces = [...document.querySelectorAll('[data-guardian-face]')].map((node, index) => ({
    node,
    range: Number(node.dataset.gaze) || 6,
    x: 0,
    y: 0,
    mood: 'curious',
    lockedUntil: 0,
    blinkAt: performance.now() + 1800 + index * 1150,
    idlePhase: index * 1.37
  }));
  const brandEyes = [...document.querySelectorAll('.brand-robot')];
  let pointer = null;
  let lastActivity = performance.now();
  let heroTipUntil = 0;
  let cloudTipUntil = 0;
  const heroTip = byId('hero-face-thought');
  const cloudTip = byId('cloud-thought');
  const cloudButton = byId('guardian-cloud');

  function showThought(node, message, until) {
    if (!node) return;
    node.textContent = message;
    node.classList.add('is-visible');
    if (node === heroTip) heroTipUntil = until;
    if (node === cloudTip) cloudTipUntil = until;
  }

  function surpriseFace(node, label) {
    const face = faces.find((entry) => entry.node === node || entry.node.contains(node) || node.contains(entry.node));
    if (!face) return;
    const now = performance.now();
    lastActivity = now;
    face.lockedUntil = now + 1350;
    setMood(face, 'surprised');
    if (face.node === head) showThought(heroTip, label || 'Oh! Hi there! ✦', now + 2100);
    if (face.node.dataset.personality === 'cloud') showThought(cloudTip, label || 'You found me! ♡', now + 2100);
  }

  function setMood(face, mood) {
    if (face.mood === mood) return;
    face.node.classList.remove('mood-happy', 'mood-curious', 'mood-sleepy', 'mood-surprised');
    face.node.classList.add(`mood-${mood}`);
    face.mood = mood;
  }
  faces.forEach((face) => setMood(face, 'happy'));

  window.addEventListener('pointermove', (event) => {
    lastActivity = performance.now();
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      pointer = { x: event.clientX, y: event.clientY };
    }
  }, { passive: true });
  window.addEventListener('keydown', () => { lastActivity = performance.now(); }, { passive: true });
  window.addEventListener('pointerdown', () => { lastActivity = performance.now(); }, { passive: true });
  window.addEventListener('touchstart', () => { lastActivity = performance.now(); }, { passive: true });
  window.addEventListener('blur', () => { pointer = null; });
  cloudButton?.addEventListener('click', () => surpriseFace(cloudButton, 'You made me smile! ♡'));
  cloudButton?.addEventListener('pointerenter', () => { lastActivity = performance.now(); showThought(cloudTip, 'Psst... say hello! ✳', performance.now() + 2400); });
  globeArea?.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) surpriseFace(head, 'Double hello! ✨'); });
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) pointer = null;
  }, { passive: true });

  function animateFaces(now) {
    // Gaze follows the pointer across the entire viewport, including outside
    // the globe and the demo. Short idle glances make Guardian feel curious.
    for (const face of faces) {
      let targetX = 0, targetY = 0;
      const rect = face.node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nearby = !!pointer && finePointer &&
        Math.abs(pointer.x - cx) < Math.max(110, rect.width * .9) &&
        Math.abs(pointer.y - cy) < Math.max(85, rect.height * 1.15);
      const sleeping = now - lastActivity > 18500;
      if (now >= face.lockedUntil) {
        if (sleeping) setMood(face, 'sleepy');
        else if (nearby) setMood(face, 'happy');
        else setMood(face, 'curious');
      }
      if (pointer && finePointer && !sleeping) {
        // tanh keeps the pupil inside its socket while offering a clear gaze.
        targetX = Math.tanh((pointer.x - cx) / Math.max(82, rect.width * .72));
        targetY = Math.tanh((pointer.y - cy) / Math.max(78, rect.height * 1.1));
      } else if (!prefersReducedMotion) {
        // Gentle personality, not jitter: small coordinated micro-glances.
        targetX = Math.sin(now / 2450 + face.idlePhase) * .24;
        targetY = Math.sin(now / 3400 + face.idlePhase) * .16;
      }
      const easing = prefersReducedMotion ? 1 : .145;
      face.x += (targetX - face.x) * easing;
      face.y += (targetY - face.y) * easing;
      face.node.style.setProperty('--eye-x', `${(face.x * face.range).toFixed(2)}px`);
      face.node.style.setProperty('--eye-y', `${(face.y * face.range * .68).toFixed(2)}px`);
      face.node.style.setProperty('--face-tilt', `${(face.x * 3.5).toFixed(2)}deg`);

      if (!prefersReducedMotion && !sleeping && face.mood !== 'surprised' && now > face.blinkAt) {
        face.node.classList.remove('blinking');
        void face.node.offsetWidth;
        face.node.classList.add('blinking');
        face.blinkAt = now + 3100 + Math.random() * 3400;
        window.setTimeout(() => face.node.classList.remove('blinking'), 230);
      }
    }
    if (heroTip && now > heroTipUntil) heroTip.classList.remove('is-visible');
    if (cloudTip && now > cloudTipUntil) cloudTip.classList.remove('is-visible');
    if (head) {
      const hero = faces.find(face => face.node === head);
      if (hero) head.style.transform = `translate(-50%,-50%) rotate(${(hero.x * 3.5).toFixed(2)}deg)`;
    }
    // Even the small nav brand reacts. Keep movement small to avoid jitter.
    const primary = faces[0];
    for (const brand of brandEyes) {
      brand.style.setProperty('--eye-x', `${((primary?.x || 0) * 1.6).toFixed(2)}px`);
      brand.style.setProperty('--eye-y', `${((primary?.y || 0) * 1.1).toFixed(2)}px`);
    }
  }

  function tick(now) {
    const dt = Math.min(50, now - (globe.last || now));
    globe.last = now;
    if (!isDragging && !prefersReducedMotion && now - globe.interaction > 2800) {
      globe.aimLongitude += dt * .000085;
    }
    const easing = prefersReducedMotion ? 1 : .075;
    globe.longitude += (globe.aimLongitude - globe.longitude) * easing;
    globe.latitude += (globe.aimLatitude - globe.latitude) * easing;
    animateFaces(now);
    // Complex cartography is expensive. Paint the globe at ~24fps only while visible;
    // the eyes update independently at the browser's animation cadence.
    if ((!prefersReducedMotion || frame++ < 4) && globeInView && now - lastGlobePaint > 42) {
      drawGlobe();
      lastGlobePaint = now;
    }
    requestAnimationFrame(tick);
  }
  if (canvas && ctx) {
    if ('IntersectionObserver' in window && globeArea) {
      new IntersectionObserver(entries => {
        globeInView = entries[0]?.isIntersecting ?? true;
      }, { rootMargin: '120px 0px' }).observe(globeArea);
    }
    if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
    window.addEventListener('resize', resizeCanvas, { passive: true });
    resizeCanvas();
  }
  // Faces must not depend on WebGL/canvas availability.
  requestAnimationFrame(tick);
  showOptions(false);
  // Blink scheduling is centralized in animateFaces to avoid duplicate blinks.

  // Mobile navigation.
  const toggle = byId('menu-toggle'), links = byId('nav-links');
  toggle?.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
    links?.classList.toggle('is-open', !expanded);
  });
  links?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    links.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));

  // Illustrative, explicitly non-live chat examples.
  const dialogue = {
    idea: ["I have a big idea, but I'm not sure where to start.", "Let's make it feel manageable. We can begin with the big picture, then choose one small step that creates momentum."],
    plan: ["My week is a little overwhelming.", "Let's find your three priorities, protect some focus time, and leave room for the unexpected."],
    learn: ["Can you help me understand something complicated?", "Absolutely. We'll break it down clearly, explore different perspectives, and take it at your pace."]
  };
  const chat = byId('chat-dialogue');
  document.querySelectorAll('.prompt-chip').forEach((chip) => chip.addEventListener('click', () => {
    const messages = dialogue[chip.dataset.prompt];
    if (!messages || !chat) return;
    document.querySelectorAll('.prompt-chip').forEach((button) => button.classList.toggle('is-active', button === chip));
    chat.replaceChildren();
    const user = document.createElement('div');
    user.className = 'chat-bubble chat-user';
    user.textContent = messages[0];
    const ai = document.createElement('div');
    ai.className = 'chat-bubble chat-ai';
    const star = document.createElement('span');
    star.className = 'chat-ai-symbol';
    star.textContent = '✦';
    const answer = document.createElement('span');
    answer.textContent = messages[1];
    ai.append(star, answer);
    chat.append(user, ai);
    const cloud = byId('guardian-cloud');
    surpriseFace(cloud, chip.dataset.prompt === 'idea' ? 'Ooh, big ideas! ✦' : chip.dataset.prompt === 'plan' ? 'We can do this! ♡' : 'Let’s get curious ✳');
    cloud?.classList.remove('reacting');
    if (cloud && !prefersReducedMotion) {
      void cloud.offsetWidth;
      cloud.classList.add('reacting');
      window.setTimeout(() => cloud.classList.remove('reacting'), 640);
    }
  }));

  // Real waitlist API endpoint, backed by Cloudflare Pages Functions + D1.
  // This deliberately does NOT claim a successful signup when the API is unavailable.
  const form = byId('waitlist-form'), status = byId('form-status');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const email = byId('waitlist-email')?.value.trim() || '';
    const website = form.querySelector('input[name="website"]')?.value || '';
    if (!form.reportValidity() || !email) return;
    button.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Adding you to the list…';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, website }),
          signal: controller.signal
        });
      } finally { clearTimeout(timer); }
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'The waitlist is not accepting signups yet.');
      status.className = 'form-status success';
      status.textContent = 'You’re on the list! We’ll share news when Guardian is ready. ✦';
      form.reset();
    } catch (err) {
      status.className = 'form-status error';
      status.textContent = 'Signups are not live yet. Please check back soon.';
      console.warn('Guardian waitlist submission unavailable:', err.message);
    } finally { button.disabled = false; }
  });

  // Scroll reveals; disabled for visitors asking for reduced motion.
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const items = document.querySelectorAll('.section-intro, .feature-card, .uses-heading, .use-tile, .experience-copy, .experience-panel, .philosophy-inner, .waitlist-inner');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: .08, rootMargin: '0px 0px -35px 0px' });
    items.forEach((node) => { node.classList.add('reveal'); observer.observe(node); });
  }
  const year = byId('footer-year');
  if (year) year.textContent = String(new Date().getFullYear());
})();