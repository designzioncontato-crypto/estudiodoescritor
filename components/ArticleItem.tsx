import React, { useState, useRef, useEffect } from 'react';
import type { Article } from '../types';
import { PencilIcon, TrashIcon, PlusCircleIcon, ChevronRightIcon, ArrowUpIcon, ArrowDownIcon } from './icons';
import ContextMenu from './ContextMenu';

interface ArticleItemProps {
  article: Article;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: (id: string) => void;
  onUpdateTitle: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onCreateSubArticle: (parentId: string) => void;
  onToggleExpand: (id: string) => void;
  onReorder: (articleId: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

const ArticleItem: React.FC<ArticleItemProps> = ({
  article,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onUpdateTitle,
  onDelete,
  onCreateSubArticle,
  onToggleExpand,
  onReorder,
  isFirst,
  isLast,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number } | null>(null);
  const [title, setTitle] = useState(article.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update internal title state if the prop changes from outside
  useEffect(() => {
    setTitle(article.title);
  }, [article.title]);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleUpdate = () => {
    if (title.trim() && title.trim() !== article.title) {
      onUpdateTitle(article.id, title.trim());
    } else {
      setTitle(article.title); // Revert if empty or unchanged
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUpdate();
    } else if (e.key === 'Escape') {
      setTitle(article.title);
      setIsEditing(false);
    }
  };

  const handleDeleteConfirm = () => {
    onDelete(article.id);
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
    onSelect(article.id);
    if (hasChildren) {
      onToggleExpand(article.id);
    }
  };

  return (
    <div className="relative">
      {isConfirmingDelete ? (
        <div className="bg-red-900/30 p-2 rounded-lg text-center h-[40px] flex items-center justify-center">
          <p className="text-sm text-white mr-2">Apagar?</p>
          <div className="flex justify-center gap-2">
            <button onClick={handleDeleteConfirm} className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded-md">Sim</button>
            <button onClick={() => setIsConfirmingDelete(false)} className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">Não</button>
          </div>
        </div>
      ) : isEditing ? (
        <div className="flex items-center w-full p-2 h-[40px]">
           <div className="flex items-center justify-center w-5 h-5 mr-1 shrink-0"></div>
           <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleUpdate}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-900 text-white rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        <div className="group relative" onContextMenu={handleContextMenu}>
            <button
              onClick={handleMainClick}
              className={`flex items-center w-full text-left p-2 pr-8 rounded-lg truncate transition-colors duration-150 ${
                isSelected 
                  ? 'bg-blue-600/60 text-white' 
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <div className="flex items-center justify-center w-5 h-5 mr-1 shrink-0">
                {hasChildren && (
                  <ChevronRightIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                )}
              </div>
              <span className="truncate flex-grow">{article.title}</span>
            </button>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className="p-1 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-600 hover:text-white focus:opacity-100 transition-opacity"
                    aria-label={`Renomear ${article.title}`}
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
            { label: 'Mover para Cima', icon: ArrowUpIcon, action: () => onReorder(article.id, 'up'), disabled: isFirst },
            { label: 'Mover para Baixo', icon: ArrowDownIcon, action: () => onReorder(article.id, 'down'), disabled: isLast },
            { label: 'Criar Subartigo', icon: PlusCircleIcon, action: () => onCreateSubArticle(article.id) },
            { label: 'Excluir', icon: TrashIcon, action: () => setIsConfirmingDelete(true), isDestructive: true },
          ]}
        />
      )}
    </div>
  );
};

export default ArticleItem;
