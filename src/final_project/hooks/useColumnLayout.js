import { useRef } from "react";
import { clampWidth, moveColumn } from "../utils/columnLayout";

const DRAG_START_PX = 6;

// Drag a column heading to move it, drag a heading's right edge to resize it,
// double-click that edge to fit the column to its contents.
// Headings carry data-col="<key>"; movable ones also have the class "movable".
export default function useColumnLayout({ order, setOrder, setWidths }) {
  const tableRef = useRef(null);
  const wrapRef = useRef(null);
  const lineRef = useRef(null);
  const ghostRef = useRef(null);
  const tipRef = useRef(null);
  const justDragged = useRef(false);

  // The first resize switches the table to fixed widths: start every column
  // from the width it has on screen, so nothing else jumps.
  // Each shown column's width on screen, rounded up so text that just fits isn't cut off.
  const measureWidths = () => {
    const measured = {};
    tableRef.current?.querySelectorAll("th[data-col]").forEach((th) => {
      measured[th.dataset.col] = Math.ceil(th.getBoundingClientRect().width) + 1;
    });
    return measured;
  };
  const lockWidths = () => {
    const measured = measureWidths();
    setWidths((prev) => ({ ...measured, ...prev }));
  };

  const onResizeStart = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    lockWidths();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startW = handle.parentElement.getBoundingClientRect().width;
    handle.setPointerCapture?.(e.pointerId);
    handle.classList.add("active");
    let frame = 0;
    const move = (ev) => {
      const w = clampWidth(startW + ev.clientX - startX);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidths((prev) => ({ ...prev, [key]: w })));
      const tip = tipRef.current;
      if (tip) {
        tip.textContent = `${w}px`;
        tip.style.display = "block";
        tip.style.left = `${ev.clientX + 12}px`;
        tip.style.top = `${ev.clientY - 30}px`;
      }
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      handle.classList.remove("active");
      if (tipRef.current) tipRef.current.style.display = "none";
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const onResizeFit = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement;
    const table = tableRef.current;
    if (!table) return;
    // Measure what each cell's content needs, ignoring the current clipping.
    let need = 0;
    const range = document.createRange();
    for (const row of table.rows) {
      const cell = row.cells[th.cellIndex];
      if (!cell) continue;
      const style = getComputedStyle(cell);
      const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      let left = Infinity;
      let right = -Infinity;
      const walker = document.createTreeWalker(cell.querySelector(".col-label") ?? cell, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        if (!box.width) continue;
        left = Math.min(left, box.left);
        right = Math.max(right, box.right);
      }
      if (right > left) need = Math.max(need, right - left + pad);
    }
    lockWidths();
    setWidths((prev) => ({ ...prev, [key]: clampWidth(need + 16) }));
  };

  const onHeaderPointerDown = (e, key) => {
    if (e.button !== 0 || e.target.closest(".col-resizer")) return;
    const th = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    let dragging = false;
    let before = null;
    const line = lineRef.current;
    const ghost = ghostRef.current;
    const wrap = wrapRef.current;

    const move = (ev) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_START_PX) return;
        dragging = true;
        th.classList.add("col-dragging");
        document.body.classList.add("col-drag-active");
        if (ghost) {
          ghost.textContent = th.dataset.label ?? key;
          ghost.style.display = "block";
        }
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
      }
      const heads = [...tableRef.current.querySelectorAll("th.movable")];
      const hit = heads.find((h) => {
        const r = h.getBoundingClientRect();
        return ev.clientX < r.left + r.width / 2;
      });
      before = hit ? hit.dataset.col : null;
      const box = wrap.getBoundingClientRect();
      const x = hit ? hit.getBoundingClientRect().left : heads.at(-1).getBoundingClientRect().right;
      if (line) {
        line.style.display = "block";
        line.style.left = `${x - box.left + wrap.scrollLeft - 1}px`;
      }
      // Scroll a wide table while dragging near its edges.
      if (ev.clientX > box.right - 40) wrap.scrollLeft += 14;
      else if (ev.clientX < box.left + 40) wrap.scrollLeft -= 14;
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!dragging) return;
      th.classList.remove("col-dragging");
      document.body.classList.remove("col-drag-active");
      if (ghost) ghost.style.display = "none";
      if (line) line.style.display = "none";
      // The click that follows this pointerup (if any) belongs to the drag.
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      if (ev.type === "pointerup") setOrder(moveColumn(order, key, before));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // A drag ends with a click on the heading; don't let it re-sort the table.
  const wasDrag = () => {
    const was = justDragged.current;
    justDragged.current = false;
    return was;
  };

  return {
    tableRef, wrapRef, lineRef, ghostRef, tipRef, onHeaderPointerDown, onResizeStart, onResizeFit, wasDrag, measureWidths,
  };
}
