
import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
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
  // A posição é gerenciada no estado para permitir ajustes após medir o tamanho do menu.
  // Começa com opacidade 0 para evitar um piscar visual antes que a posição seja corrigida.
  const [menuPosition, setMenuPosition] = useState({ top: y, left: x, opacity: 0 });

  // useLayoutEffect é executado de forma síncrona após as mutações do DOM, mas antes do navegador pintar.
  // Isso é ideal para medir elementos do DOM e ajustar estilos para evitar piscar.
  useLayoutEffect(() => {
    if (menuRef.current) {
      const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window;
      const { width: menuWidth, height: menuHeight } = menuRef.current.getBoundingClientRect();

      let newTop = y;
      let newLeft = x;

      // Ajusta a posição se o menu ultrapassar os limites da janela de visualização.
      // Adiciona um pequeno buffer (8px) para evitar que toque na borda.
      if (y + menuHeight > viewportHeight) {
        newTop = viewportHeight - menuHeight - 8;
      }
      if (x + menuWidth > viewportWidth) {
        newLeft = viewportWidth - menuWidth - 8;
      }

      // Garante que o menu também não saia do topo ou da esquerda da tela.
      newTop = Math.max(8, newTop);
      newLeft = Math.max(8, newLeft);

      // Define a posição final ajustada e torna o menu visível.
      setMenuPosition({ top: newTop, left: newLeft, opacity: 1 });
    }
  }, [x, y]);

  // Efeito para lidar com o fechamento do menu ao clicar fora ou pressionar Escape.
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

  return (
    <div
      ref={menuRef}
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        opacity: menuPosition.opacity,
      }}
      // Usa posicionamento 'fixed' para colocar o menu em relação à janela de visualização.
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
    </div>
  );
};

export default ContextMenu;