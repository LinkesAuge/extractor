/**
 * Interaktive Region-Auswahl per Overlay im Browser.
 * Legt ein transparentes DIV ueber die Seite, der User zieht ein Rechteck auf.
 */

/**
 * Zeigt ein Overlay im Browser und laesst den User ein Rechteck aufziehen.
 * @param {import('playwright').Page} page - Die Playwright-Seite
 * @returns {Promise<{x: number, y: number, width: number, height: number}>}
 */
const REGION_SELECT_TIMEOUT_MS = 120000;

async function selectRegion(page) {
  const region = await Promise.race([
    page.evaluate(() => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = '__region_overlay__';
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '2147483647',
        cursor: 'crosshair',
        background: 'rgba(0, 0, 0, 0.3)',
      });

      const selBox = document.createElement('div');
      selBox.id = '__region_selection__';
      Object.assign(selBox.style, {
        position: 'fixed',
        border: '2px dashed #00aaff',
        background: 'rgba(0, 170, 255, 0.15)',
        pointerEvents: 'none',
        zIndex: '2147483647',
        display: 'none',
      });

      const label = document.createElement('div');
      label.id = '__region_label__';
      Object.assign(label.style, {
        position: 'fixed',
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#00aaff',
        fontFamily: 'monospace',
        fontSize: '13px',
        padding: '4px 8px',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: '2147483647',
        display: 'none',
      });

      const helpText = document.createElement('div');
      Object.assign(helpText.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        fontSize: '16px',
        padding: '12px 24px',
        borderRadius: '8px',
        zIndex: '2147483647',
        pointerEvents: 'none',
        textAlign: 'center',
      });
      helpText.textContent = 'Ziehe ein Rechteck um den Bereich, den du erfassen willst';

      document.body.appendChild(overlay);
      document.body.appendChild(selBox);
      document.body.appendChild(label);
      document.body.appendChild(helpText);

      let startX = 0;
      let startY = 0;
      let drawing = false;
      let currentConfirmHandler = null;

      function updateBox(e) {
        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);

        Object.assign(selBox.style, {
          left: x + 'px',
          top: y + 'px',
          width: w + 'px',
          height: h + 'px',
          display: 'block',
        });

        label.textContent = `${Math.round(x)}, ${Math.round(y)}  |  ${Math.round(w)} x ${Math.round(h)}`;
        Object.assign(label.style, {
          left: (x + w + 8) + 'px',
          top: y + 'px',
          display: 'block',
        });
      }

      overlay.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
        drawing = true;
        selBox.style.display = 'none';
        label.style.display = 'none';
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        updateBox(e);
      });

      overlay.addEventListener('mouseup', (e) => {
        if (!drawing) return;
        drawing = false;

        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);

        if (w < 20 || h < 20) {
          selBox.style.display = 'none';
          label.style.display = 'none';
          return;
        }

        helpText.textContent = `Auswahl: ${Math.round(w)} x ${Math.round(h)} px  —  Klicke nochmal um zu bestaetigen, oder ziehe neu`;

        // Remove previous confirm handler if user redraws before confirming
        if (currentConfirmHandler) {
          overlay.removeEventListener('click', currentConfirmHandler);
        }

        currentConfirmHandler = function confirm() {
          overlay.removeEventListener('click', confirm);
          currentConfirmHandler = null;
          overlay.remove();
          selBox.remove();
          label.remove();
          helpText.remove();

          resolve({
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(w),
            height: Math.round(h),
          });
        };
        overlay.addEventListener('click', currentConfirmHandler, { once: true });
      });
    });
  }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Region-Auswahl: Zeitlimit ueberschritten (2 Minuten).')), REGION_SELECT_TIMEOUT_MS)
    ),
  ]);

  return region;
}

export default selectRegion;
