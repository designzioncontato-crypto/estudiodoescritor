import React, { useMemo } from 'react';
import type { Folder } from '../types';
import FolderItem from './FolderItem';
import { PlusIcon, DownloadIcon, FileTextIcon } from './icons';

// Define a type for folders with children for tree traversal
type FolderWithChildren = Folder & { children: FolderWithChildren[] };

interface SidebarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  onCreateFolder: () => void;
  onCreateSubfolder: (parentId: string) => void;
  onUpdateFolder: (id: string, newName: string, newColor: string) => void;
  onDeleteFolder: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onToggleFolderExpansion: (folderId: string) => void;
  onReorderFolder: (folderId: string, direction: 'up' | 'down') => void;
  onSaveBackup: () => void;
  onExportPdf: () => void;
  newlyCreatedFolderId: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  folders, 
  selectedFolderId, 
  expandedFolderIds,
  onCreateFolder, 
  onCreateSubfolder,
  onUpdateFolder,
  onDeleteFolder,
  onSelectFolder,
  onToggleFolderExpansion,
  onReorderFolder,
  onSaveBackup,
  onExportPdf,
  newlyCreatedFolderId
}) => {
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

  const renderFolderTree = (foldersToRender: FolderWithChildren[], level: number) => {
    return foldersToRender.map((folder, index) => {
      const isExpanded = expandedFolderIds.has(folder.id);
      const hasChildren = folder.children.length > 0;
      const isFirst = index === 0;
      const isLast = index === foldersToRender.length - 1;

      return (
        <div key={folder.id} style={{ paddingLeft: `${level * 16}px` }}>
          <FolderItem
            folder={folder}
            isSelected={folder.id === selectedFolderId}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            onSelect={onSelectFolder}
            onUpdate={onUpdateFolder}
            onDelete={onDeleteFolder}
            onCreateSubfolder={onCreateSubfolder}
            onToggleExpand={onToggleFolderExpansion}
            onReorder={onReorderFolder}
            isFirst={isFirst}
            isLast={isLast}
            shouldFocusOnMount={folder.id === newlyCreatedFolderId}
          />
          {isExpanded && hasChildren && renderFolderTree(folder.children, level + 1)}
        </div>
      );
    });
  };

  return (
    <aside className="w-64 bg-gray-900/70 h-screen flex flex-col p-3 backdrop-blur-sm border-r border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-200">Pastas</h1>
        <button
          onClick={onCreateFolder}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          aria-label="Create new folder"
        >
          <PlusIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      <nav 
        className="flex-grow space-y-1 overflow-y-auto"
      >
        {renderFolderTree(folderTree, 0)}
      </nav>
      <div className="mt-auto pt-4 border-t border-gray-700/50 flex flex-col items-center gap-2">
          <button 
            onClick={onSaveBackup}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <DownloadIcon className="w-4 h-4" />
            Salvar Backup
          </button>
          <button 
            onClick={onExportPdf}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FileTextIcon className="w-4 h-4" />
            Exportar em PDF
          </button>
          <p className="text-xs text-center text-gray-500">Estúdio do Escritor</p>
      </div>
    </aside>
  );
};

export default Sidebar;