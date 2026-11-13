import './info-tooltips.css';

// Delegation also covers result cards that are replaced after loading or tab changes.
export function bindInfoTooltips(root, selector) {
  let active = null;
  const hide = () => {
    if (!active) return;
    const {button, tip} = active;
    button.setAttribute('aria-expanded', 'false');
    if (typeof tip.hidePopover === 'function' && tip.matches(':popover-open')) tip.hidePopover();
    tip.hidden = true;
    active = null;
  };
  const show = button => {
    if (active?.button === button) return;
    hide();
    const tip = button.querySelector('.info-tooltip');
    if (!tip) return;
    active = {button, tip};
    button.setAttribute('aria-expanded', 'true');
    tip.dataset.floatingTooltip = '';
    tip.hidden = false;
    if (typeof tip.showPopover === 'function') {
      tip.setAttribute('popover', 'manual');
      tip.showPopover(); // Top layer keeps help outside clipped scroll containers.
    }
    const width = Math.min(360, window.innerWidth - 32);
    tip.style.width = `${width}px`;
    tip.style.maxWidth = `${width}px`;
    tip.style.maxHeight = `${window.innerHeight - 32}px`;
    const anchor = button.getBoundingClientRect();
    const height = tip.getBoundingClientRect().height;
    tip.style.left = `${Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16))}px`;
    const below = anchor.bottom + 8;
    tip.style.top = `${below + height <= window.innerHeight - 16 ? below : Math.max(16, anchor.top - height - 8)}px`;
  };
  const find = event => event.target.closest?.(selector);
  const enter = event => { const button = find(event); if (button && root.contains(button)) show(button); };
  const leave = event => {
    if (active && !active.button.contains(event.relatedTarget) && document.activeElement !== active.button) hide();
  };
  const blur = event => { if (active && !active.button.contains(event.relatedTarget)) hide(); };
  const keydown = event => { if (event.key === 'Escape') hide(); };
  const outside = event => { if (active && !active.button.contains(event.target)) hide(); };
  const listeners = [[root,'pointerover',enter], [root,'focusin',enter], [root,'click',enter],
    [root,'pointerout',leave], [root,'focusout',blur], [root,'keydown',keydown],
    [document,'pointerdown',outside], [window,'resize',hide], [root,'scroll',hide,true]];
  for (const [target,event,handler,capture] of listeners) target.addEventListener(event,handler,capture);
  return () => { hide(); for (const [target,event,handler,capture] of listeners) target.removeEventListener(event,handler,capture); };
}
