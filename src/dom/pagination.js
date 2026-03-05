/**
 * Reusable pagination for tables that fill available vertical space.
 *
 * The table wrapper is height:auto (shrinks to rows). Row count is derived
 * by measuring the available height in `root` and subtracting sibling elements.
 */

export const createTablePagination = (root, opts) => {
  const resolve = (selectorOrEl) =>
    typeof selectorOrEl === "string"
      ? root.querySelector(selectorOrEl)
      : selectorOrEl;

  const tableWrapper = resolve(opts.tableWrapper);
  const table = resolve(opts.table);
  const paginationContainer = resolve(opts.paginationContainer);
  const renderRows = opts.renderRows;
  const defaultPerPage = opts.defaultPerPage ?? 6;
  const onPageRender = opts.onPageRender ?? null;

  let allItems = opts.allItems ?? [];
  let currentPage = 1;
  let itemsPerPage = defaultPerPage;

  const calculateItemsPerPage = () => {
    if (!root || !table || !tableWrapper) return;

    // Use tableWrapper's direct parent as reference container
    const container = tableWrapper.parentElement;
    if (!container) return;

    const containerStyle = getComputedStyle(container);
    const paddingTop = parseFloat(containerStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0;
    const gap = parseFloat(containerStyle.gap) || parseFloat(containerStyle.rowGap) || 0;
    const containerInnerHeight = container.clientHeight - paddingTop - paddingBottom;

    let siblingsHeight = 0;
    let siblingCount = 0;
    Array.from(container.children).forEach((child) => {
      if (child !== tableWrapper) {
        siblingsHeight += child.offsetHeight;
        siblingCount++;
      }
    });

    const totalGaps = gap * Math.max(0, siblingCount); // gaps between all children
    const availableForTable = containerInnerHeight - siblingsHeight - totalGaps;

    const thead = table.querySelector("thead");
    const theadHeight = thead ? thead.offsetHeight : 40;
    const availableForRows = availableForTable - theadHeight;

    const firstRow = table.querySelector("tbody tr");
    const rowHeight = firstRow ? firstRow.offsetHeight : 49;

    if (rowHeight > 0 && availableForRows > 0) {
      itemsPerPage = Math.max(1, Math.floor(availableForRows / rowHeight));
    }
  };

  const renderPagination = () => {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";

    if (allItems.length <= itemsPerPage) {
      paginationContainer.style.display = "none";
      return;
    }

    paginationContainer.style.display = "flex";
    const totalPages = Math.ceil(allItems.length / itemsPerPage);

    // How many page buttons fit on one line with the two chevrons.
    // Each button is 32px + 8px gap = 40px per slot.
    const btnSlot = 40;
    const containerWidth =
      paginationContainer.clientWidth ||
      paginationContainer.offsetWidth ||
      600;
    const maxVisible = Math.max(1, Math.floor(containerWidth / btnSlot) - 2);

    // Prev button
    const prevBtn = document.createElement("button");
    prevBtn.className = "page-btn prev";
    prevBtn.textContent = "<";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        render();
      }
    });
    paginationContainer.appendChild(prevBtn);

    // Page numbers — window of maxVisible
    let startPage, endPage;
    if (totalPages <= maxVisible) {
      startPage = 1;
      endPage = totalPages;
    } else {
      startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      endPage = startPage + maxVisible - 1;
      if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.className = `page-btn ${i === currentPage ? "active" : ""}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener("click", () => {
        currentPage = i;
        render();
      });
      paginationContainer.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.className = "page-btn next";
    nextBtn.textContent = ">";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        render();
      }
    });
    paginationContainer.appendChild(nextBtn);
  };

  const render = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const visible = allItems.slice(startIndex, startIndex + itemsPerPage);
    renderRows(visible);
    renderPagination();
    if (onPageRender) onPageRender();
  };

  const update = (newItems) => {
    allItems = newItems ?? [];
    currentPage = 1;
    // Render with default count first so we have rows to measure height from
    render();
    // Recalculate from actual dimensions, re-render to exact fit
    calculateItemsPerPage();
    render();
  };

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const prev = itemsPerPage;
      calculateItemsPerPage();
      if (itemsPerPage !== prev) {
        const totalPages = Math.ceil(allItems.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages || 1;
        render();
      }
    }, 150);
  };
  window.addEventListener("resize", onResize);

  const destroy = () => {
    window.removeEventListener("resize", onResize);
    clearTimeout(resizeTimer);
  };

  return { update, destroy, render };
};
