/* Shared by the teaser and scaling sweep: identical per-cell number-to-pixel motion. */
(() => {
  const clamp=value=>Math.max(0,Math.min(1,value));
  const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
  function create(raster,{cellSize=20}={}) {
    const canvas=document.createElement('canvas');
    canvas.setAttribute('aria-hidden','true');
    // One pre-rendered number atlas: no per-frame font shaping or DOM cells.
    const extent = raster.width * cellSize;
    canvas.width = extent;
    canvas.height = extent;
    const atlas = document.createElement('canvas');
    atlas.width = extent; atlas.height = extent;
    const ink = atlas.getContext('2d');
    ink.font = `500 ${cellSize * .75}px monospace`;
    ink.textAlign = 'center'; ink.textBaseline = 'middle';
    ink.lineJoin = 'round'; ink.lineWidth = cellSize / 20;
    const cells = [];
    raster.pixels.forEach((row, y) => row.forEach((index, x) => {
      const color = raster.palette[index];
      const rgb = color.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16));
      if (rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 205) {
        ink.strokeStyle = '#53677280';
        ink.strokeText(index, (x + .5) * cellSize, (y + .5) * cellSize);
      }
      ink.fillStyle = color;
      ink.fillText(index, (x + .5) * cellSize, (y + .5) * cellSize);
      const diagonal = (x / (raster.width - 1) + 1 - y / (raster.height - 1)) / 2;
      // A little deterministic variation softens the diagonal into a wave.
      const ripple = Math.sin(x * 1.73 + y * 2.31) * .035;
      cells.push({ x: x * cellSize, y: y * cellSize, color, wave: clamp(diagonal + ripple) });
    }));
    return {canvas,context:canvas.getContext('2d'),atlas,cells,cellSize};
  }
  function paint(specimen,elapsed) {
    const { context: ctx, canvas, atlas, cells, cellSize } = specimen;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const cell of cells) {
      const appear = smooth((elapsed - cell.wave * 390) / 260);
      const fill = smooth((elapsed - 720 - cell.wave * 1130) / 470);
      if (appear === 0) continue;
      if (fill === 1) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = cell.color;
        ctx.fillRect(cell.x, cell.y, cellSize, cellSize);
        continue;
      }
      if (fill > 0) {
        // The colored square grows around its own palette index.
        const edge = cellSize * (.2 + .8 * fill), inset = (cellSize - edge) / 2;
        ctx.globalAlpha = fill;
        ctx.fillStyle = cell.color;
        ctx.fillRect(cell.x + inset, cell.y + inset, edge, edge);
      }
      ctx.globalAlpha = appear * (1 - fill);
      const drift = (1 - appear) * cellSize * .2;
      ctx.drawImage(atlas, cell.x, cell.y, cellSize, cellSize, cell.x - drift, cell.y + drift, cellSize, cellSize);
    }
    ctx.globalAlpha = 1;
  }
  window.PixelGridTransition={create,paint,duration:2320};
})();
