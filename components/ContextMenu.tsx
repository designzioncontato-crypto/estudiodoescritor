
import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IconProps } from './icons';

interface Action {
  label: string;
  icon: React.FC<IconProps>;
  action: () => void;
  isDestructive?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  actions: Action[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, actions }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  // Position is managed in state to allow adjustments after measuring the menu size.
  // Starts with opacity 0 to prevent a visual flicker before the position is corrected.
  const [menuPosition, setMenuPosition] = useState({ top: y, left: x, opacity: 0 });

  // useLayoutEffect runs synchronously after DOM mutations but before the browser paints.
  // This is ideal for measuring DOM elements and adjusting styles to prevent flickers.
  useLayoutEffect(() => {
    if (menuRef.current) {
      const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window;
      const { width: menuWidth, height: menuHeight } = menuRef.current.getBoundingClientRect();
      const margin = 8; // Margin from the viewport edges

      let finalTop = y;
      let finalLeft = x;

      // --- Horizontal Positioning ---
      // If the menu overflows the right edge, move it to the left of the cursor.
      if (finalLeft + menuWidth > viewportWidth - margin) {
        finalLeft = x - menuWidth;
      }
      // If it's still off-screen to the left (e.g., on a narrow screen), clamp it to the edge.
      if (finalLeft < margin) {
        finalLeft = margin;
      }

      // --- Vertical Positioning ---
      // If the menu overflows the bottom edge, move it above the cursor.
      if (finalTop + menuHeight > viewportHeight - margin) {
        finalTop = y - menuHeight;
      }
      // If it's still off-screen to the top, clamp it to the edge.
      if (finalTop < margin) {
        finalTop = margin;
      }

      // Set the final adjusted position and make the menu visible.
      setMenuPosition({ top: finalTop, left: finalLeft, opacity: 1 });
    }
  }, [x, y]);

  // Effect to handle closing the menu on outside click or Escape key press.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        opacity: menuPosition.opacity,
      }}
      // Use 'fixed' positioning to place the menu relative to the viewport.
      className="fixed z-50 w-48 bg-gray-800 border border-gray-600 rounded-md shadow-lg p-1 transition-opacity duration-75"
      onClick={(e) => e.stopPropagation()}
    >
      <ul className="flex flex-col">
        {actions.map(({ label, icon: Icon, action, isDestructive, disabled }) => (
          <li key={label}>
            <button
              onClick={() => {
                if (disabled) return;
                action();
                onClose();
              }}
              disabled={disabled}
              className={`w-full flex items-center px-3 py-2 text-sm text-left rounded transition-colors ${
                disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : isDestructive
                  ? 'text-red-400 hover:bg-red-500/20'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4 mr-3" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
};

export default ContextMenu;
