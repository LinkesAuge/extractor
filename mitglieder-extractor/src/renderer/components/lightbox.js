/**
 * Full-screen image lightbox overlay.
 * @module components/lightbox
 */

/**
 * Show a lightbox overlay with the given image source.
 * Clicking the overlay closes it.
 * @param {string} src - Image source (data URL or path).
 */
export function showLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Screenshot preview');
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Screenshot preview';
  lb.appendChild(img);
  const close = () => {
    lb.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  lb.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(lb);
}
