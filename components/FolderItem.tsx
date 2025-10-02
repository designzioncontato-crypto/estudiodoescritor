import React, { useState, useRef, useEffect } from 'react';
import type { Folder } from '../types';
import { FolderIcon, PencilIcon, PaletteIcon, TrashIcon, PlusCircleIcon, ChevronRightIcon, ArrowUpIcon, ArrowDownIcon } from './icons';
import AdvancedColorPicker from './ColorPicker';
import ContextMenu from './ContextMenu';

interface FolderItemProps {
  folder: Folder;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, newName: string, newColor: string) => void;
  onDelete: (id: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  onToggleExpand: (id: string) => void;
  shouldFocusOnMount: boolean;
  onReorder: (folderId: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onUpdate,
  onDelete,
  onCreateSubfolder,
  onToggleExpand,
  shouldFocusOnMount,
  onReorder,
  isFirst,
  isLast,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number } | null>(null);
  const [name, setName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shouldFocusOnMount) {
      setIsEditing(true);
    }
  }, [shouldFocusOnMount]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleUpdate = () => {
    if (name.trim()) {
      onUpdate(folder.id, name.trim(), folder.color);
    } else {
      setName(folder.name); // Revert if empty
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUpdate();
    } else if (e.key === 'Escape') {
      setName(folder.name);
      setIsEditing(false);
    }
  };

  const handleColorCommitAndClose = (committedColor: string) => {
    if (committedColor !== folder.color) {
      onUpdate(folder.id, folder.name, committedColor);
    }
    setIsPickingColor(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(folder.id);
    setIsConfirmingDelete(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ show: true, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };
  
  const handleMainClick = () => {
    onSelect(folder.id);
    if (hasChildren) {
      onToggleExpand(folder.id);
    }
  };

  const baseClasses = "flex items-center w-full text-left p-2 rounded-lg transition-colors duration-200";
  const selectedClasses = isSelected ? "bg-blue-600/50" : "hover:bg-gray-700/70";

  return (
    <div className="relative">
      {isConfirmingDelete ? (
        <div className="bg-red-900/30 p-2 rounded-lg text-center">
          <p className="text-sm text-white mb-2">Apagar pasta?</p>
          <div className="flex justify-center gap-2">
            <button onClick={handleDeleteConfirm} className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded-md">Apagar</button>
            <button onClick={() => setIsConfirmingDelete(false)} className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">Cancelar</button>
          </div>
        </div>
      ) : isEditing ? (
        <div className="flex items-center w-full p-2">
          <FolderIcon className="w-6 h-6 mr-3 shrink-0" style={{ color: folder.color }} />
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={handleNameChange}
            onBlur={handleUpdate}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-900 text-white rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        <div className="group relative">
            <button
              onClick={handleMainClick}
              onContextMenu={handleContextMenu}
              className={`${baseClasses} ${selectedClasses} pr-8`}
            >
              <div className="flex items-center justify-center w-5 h-5 mr-1 shrink-0">
                 {hasChildren && (
                    <ChevronRightIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                 )}
              </div>
              <FolderIcon className="w-6 h-6 mr-2 shrink-0" style={{ color: folder.color }} />
              <span className="truncate flex-grow">{folder.name}</span>
            </button>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className="p-1 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-600 hover:text-white focus:opacity-100 transition-opacity"
                    aria-label={`Renomear ${folder.name}`}
                >
                    <PencilIcon className="w-4 h-4"/>
                </button>
            </div>
        </div>
      )}
      
      {contextMenu?.show && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          actions={[
            { label: 'Mover para Cima', icon: ArrowUpIcon, action: () => onReorder(folder.id, 'up'), disabled: isFirst },
            { label: 'Mover para Baixo', icon: ArrowDownIcon, action: () => onReorder(folder.id, 'down'), disabled: isLast },
            { label: 'Criar Subpasta', icon: PlusCircleIcon, action: () => onCreateSubfolder(folder.id) },
            { label: 'Alterar Cor', icon: PaletteIcon, action: () => setIsPickingColor(true) },
            { label: 'Excluir', icon: TrashIcon, action: () => setIsConfirmingDelete(true), isDestructive: true },
          ]}
        />
      )}

      {isPickingColor && (
        <AdvancedColorPicker
          onClose={handleColorCommitAndClose}
          currentColor={folder.color}
        />
      )}
    </div>
  );
};

export default FolderItem;
