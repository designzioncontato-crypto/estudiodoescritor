import React, { useState, useMemo, useCallback } from 'react';
import type { Folder } from '../types';
import { XIcon } from './icons';

type FolderWithChildren = Folder & { children: FolderWithChildren[] };

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onGenerate: (selectedFolderIds: string[]) => void;
  isGenerating: boolean;
}

const PdfExportModal: React.FC<PdfExportModalProps> = ({ isOpen, onClose, folders, onGenerate, isGenerating }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const folderTree = useMemo(() => {
    const map = new Map<string, FolderWithChildren>();
    folders.forEach(folder => map.set(folder.id, { ...folder, children: [] }));
    
    const roots: FolderWithChildren[] = [];
    map.forEach(folder => {
      if (folder.parentId && map.has(folder.parentId)) {
        map.get(folder.parentId)!.children.push(folder);
      } else {
        roots.push(folder);
      }
    });

    const sortFolders = (folderList: FolderWithChildren[]) => {
      folderList.sort((a, b) => a.sortOrder - b.sortOrder);
      folderList.forEach(f => sortFolders(f.children));
    };
    sortFolders(roots);

    return roots;
  }, [folders]);

  const handleToggleSelection = useCallback((folderId: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(folderId)) {
      newSelectedIds.delete(folderId);
    } else {
      newSelectedIds.add(folderId);
    }
    setSelectedIds(newSelectedIds);
  }, [selectedIds]);

  const handleSelectAll = () => {
    setSelectedIds(new Set(folders.map(f => f.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const renderFolderNode = (folder: FolderWithChildren, level: number) => (
    <div key={folder.id} style={{ paddingLeft: `${level * 20}px` }}>
      <label className="flex items-center space-x-3 py-1 cursor-pointer">
        <input
          type="checkbox"
          className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          checked={selectedIds.has(folder.id)}
          onChange={() => handleToggleSelection(folder.id)}
        />
        <span className="text-gray-200">{folder.name}</span>
      </label>
      {folder.children.length > 0 && renderFolderTree(folder.children, level + 1)}
    </div>
  );

  const renderFolderTree = (tree: FolderWithChildren[], level: number) => (
    <div className="space-y-1">
      {tree.map(folder => renderFolderNode(folder, level))}
    </div>
  );
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 w-full max-w-lg rounded-lg shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Exportar em PDF</h2>
          <button onClick={onClose} disabled={isGenerating} className="p-2 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white disabled:opacity-50">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 flex-grow overflow-y-auto max-h-[60vh]">
            <p className="text-gray-400 mb-4">Selecione as pastas que deseja incluir no seu PDF.</p>
            <div className="flex gap-4 mb-4">
                <button onClick={handleSelectAll} className="text-sm text-blue-400 hover:underline">Selecionar Tudo</button>
                <button onClick={handleClearSelection} className="text-sm text-blue-400 hover:underline">Limpar Seleção</button>
            </div>
            <div className="border border-gray-700 rounded-lg p-3 bg-gray-900/50">
              {renderFolderTree(folderTree, 0)}
            </div>
        </div>

        <div className="flex justify-end p-4 border-t border-gray-700">
          <button
            onClick={() => onGenerate(Array.from(selectedIds))}
            disabled={selectedIds.size === 0 || isGenerating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="O 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Gerando PDF...
              </>
            ) : 'Gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfExportModal;