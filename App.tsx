import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ArticleListPanel from './components/ArticleListPanel';
import ArticleEditorModal from './components/ArticleEditorModal';
import ArticleViewer from './components/ArticleViewer';
import WelcomeScreen from './components/WelcomeScreen';
import PdfExportModal from './components/PdfExportModal';
import { generatePdf } from './utils/pdf-generator';
import type { Folder, Article, ProjectState, Section } from './types';
import * as db from './utils/db';
import { DEFAULT_FOLDER_COLOR } from './constants';

const PROJECT_STORAGE_KEY = 'writers-desk-project';

const App: React.FC = () => {
  // --- Project State ---
  const [projectState, setProjectState] = useState<ProjectState | null>(null);

  // --- UI State ---
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newlyCreatedFolderId, setNewlyCreatedFolderId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // --- Automatic Saving Effect ---
  useEffect(() => {
    if (projectState) {
        try {
            // Now that images are in IndexedDB, the project state should be small enough.
            localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectState));
        } catch (error) {
            console.error("Could not save project to localStorage", error);
            alert("Falha ao salvar o projeto. Pode ser que o armazenamento local esteja cheio.");
        }
    }
  }, [projectState]);

  // --- UI Effects ---
  useEffect(() => {
    if (projectState?.folders.length > 0 && !selectedFolderId) {
      const firstFolder = projectState.folders.sort((a,b) => a.sortOrder - b.sortOrder).find(f => !f.parentId);
      setSelectedFolderId(firstFolder?.id ?? projectState.folders[0].id);
    }
    if (projectState?.folders.length === 0) {
      setSelectedFolderId(null);
    }
  }, [projectState?.folders, selectedFolderId]);
  
  useEffect(() => {
    setSelectedArticleId(null);
  }, [selectedFolderId]);

  // --- Data Migration for Image Storage ---
  const migrateProjectState = async (project: ProjectState): Promise<ProjectState> => {
    const migratedArticles: Article[] = [];
    let migrationNeeded = false;

    for (const article of project.articles) {
        const migratedSections: Section[] = [];
        for (const section of article.sections) {
            // Check if section is an image section and its images have dataUrl (old format)
            if (section.type === 'images' && section.images.length > 0 && 'dataUrl' in section.images[0]) {
                migrationNeeded = true;
                const newImages = [];
                for (const image of section.images as any[]) {
                    if (image.dataUrl) {
                        await db.putImage(image.id, image.dataUrl);
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { dataUrl, ...rest } = image;
                        newImages.push(rest);
                    } else {
                        newImages.push(image);
                    }
                }
                migratedSections.push({ ...section, images: newImages });
            } else {
                migratedSections.push(section);
            }
        }
        migratedArticles.push({ ...article, sections: migratedSections });
    }

    if (migrationNeeded) {
        console.log("Project data migrated to use IndexedDB for images.");
        return { ...project, articles: migratedArticles };
    }
    
    return project;
  };

  // --- Project Management Handlers ---
  const handleContinueProject = useCallback(async () => {
    try {
        const savedProject = localStorage.getItem(PROJECT_STORAGE_KEY);
        if (savedProject) {
            const parsedProject = JSON.parse(savedProject);
            
            // Backwards compatibility for fields that may not exist
            parsedProject.expandedFolderIds = parsedProject.expandedFolderIds || [];
            parsedProject.expandedArticleIds = parsedProject.expandedArticleIds || [];
            parsedProject.articles = (parsedProject.articles || []).map((a: Article) => ({ 
              ...a, 
              parentId: a.parentId === undefined ? null : a.parentId,
              sections: (a.sections || []).map((section: any) => 
                section.type ? section : { ...section, type: 'fields' as const }
              )
            }));

            // Run migration for images from localStorage to IndexedDB
            const projectAfterMigration = await migrateProjectState(parsedProject);
            setProjectState(projectAfterMigration);
        }
    } catch (error) {
        console.error("Could not load project from localStorage", error);
        handleNewProject();
    }
  }, []);

  const handleNewProject = useCallback(() => {
    setProjectState({
        folders: [],
        articles: [],
        expandedFolderIds: [],
        expandedArticleIds: [],
    });
    setSelectedFolderId(null);
    setSelectedArticleId(null);
  }, []);

  const handleLoadBackup = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (typeof result === 'string') {
          const loadedData = JSON.parse(result);

          let loadedProject: ProjectState;
          
          // Check for new backup format { projectState, images }
          if (loadedData.projectState && Array.isArray(loadedData.images)) {
            loadedProject = loadedData.projectState as ProjectState;
            await db.clearImages();
            await db.putAllImages(loadedData.images);
          } else {
            // Handle old backup format
            loadedProject = loadedData as ProjectState;
          }
          
          // Basic validation and backward compatibility
          if (loadedProject.folders && loadedProject.articles) {
            loadedProject.expandedFolderIds = loadedProject.expandedFolderIds || [];
            loadedProject.expandedArticleIds = loadedProject.expandedArticleIds || [];
            loadedProject.articles = (loadedProject.articles || []).map((a: Article) => ({
              ...a, 
              parentId: a.parentId === undefined ? null : a.parentId,
              sections: (a.sections || []).map((section: any) => 
                section.type ? section : { ...section, type: 'fields' as const }
              )
            }));
            
            // Run migration on the loaded project in case it's an old backup with inline images
            const projectAfterMigration = await migrateProjectState(loadedProject);

            setProjectState(projectAfterMigration);
            setSelectedFolderId(null);
            setSelectedArticleId(null);
          } else {
            alert('Arquivo de backup inválido.');
          }
        }
      } catch (error) {
        console.error("Failed to parse backup file", error);
        alert('Falha ao carregar o backup. O arquivo pode estar corrompido.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSaveBackup = useCallback(async () => {
    if (!projectState) return;
    try {
        const images = await db.getAllImages();
        const backupData = {
          projectState,
          images
        };

        const projectJson = JSON.stringify(backupData, null, 2);
        const blob = new Blob([projectJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const formattedDate = `${day}-${month}-${year}`;

        a.href = url;
        a.download = `EscritorDB-${formattedDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to save backup", error);
        alert('Falha ao salvar o backup.');
    }
  }, [projectState]);

  const handleGeneratePdf = useCallback(async (selectedFolderIds: string[]) => {
    if (!projectState) return;
    setIsGeneratingPdf(true);
    try {
        await generatePdf(projectState, selectedFolderIds);
    } catch (error) {
        console.error("Failed to generate PDF", error);
        alert("Ocorreu um erro ao gerar o PDF.");
    } finally {
        setIsGeneratingPdf(false);
        setIsPdfModalOpen(false);
    }
}, [projectState]);

  // --- Folder Handlers ---
  const createFolder = useCallback((parentId: string | null = null) => {
    setProjectState(prev => {
        if (!prev) return null;
        const siblings = prev.folders.filter(f => f.parentId === parentId);
        const maxSortOrder = siblings.reduce((max, f) => Math.max(max, f.sortOrder), -1);
        const newFolder: Folder = {
          id: crypto.randomUUID(),
          name: parentId ? 'Nova Subpasta' : 'Nova Pasta',
          color: DEFAULT_FOLDER_COLOR,
          parentId,
          sortOrder: maxSortOrder + 1,
        };
        setSelectedFolderId(newFolder.id);
        setNewlyCreatedFolderId(newFolder.id);
        if(parentId && !prev.expandedFolderIds.includes(parentId)) {
            setTimeout(() => { // ensure this runs after the main state update
                setProjectState(p => p ? {...p, expandedFolderIds: [...p.expandedFolderIds, parentId]} : null);
            }, 0);
        }
        setTimeout(() => setNewlyCreatedFolderId(null), 50);
        return {...prev, folders: [...prev.folders, newFolder]};
    });
  }, []);

  const handleCreateFolder = useCallback(() => createFolder(null), [createFolder]);
  const handleCreateSubfolder = useCallback((parentId: string) => createFolder(parentId), [createFolder]);

  const handleUpdateFolder = useCallback((id: string, newName: string, newColor: string) => {
    setProjectState(prev => prev ? {
        ...prev,
        folders: prev.folders.map(folder =>
            folder.id === id ? { ...folder, name: newName, color: newColor } : folder
        ),
    } : null);
  }, []);

  const handleDeleteFolder = useCallback((id: string) => {
    setProjectState(prev => {
        if (!prev) return null;
        const folderToDelete = prev.folders.find(f => f.id === id);
        if (!folderToDelete) return prev;

        const idsToDelete = new Set<string>([id]);
        const queue = [id];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const children = prev.folders.filter(f => f.parentId === currentId);
            for (const child of children) {
                idsToDelete.add(child.id);
                queue.push(child.id);
            }
        }
        
        const newFolders = prev.folders.filter(f => !idsToDelete.has(f.id));
        const articlesToDelete = prev.articles.filter(a => idsToDelete.has(a.folderId));
        // Delete images associated with articles being deleted
        articlesToDelete.forEach(article => {
          article.sections.forEach(section => {
            if (section.type === 'images') {
              section.images.forEach(image => db.deleteImage(image.id));
            }
          });
        });
        const newArticles = prev.articles.filter(a => !idsToDelete.has(a.folderId));
        
        if (selectedFolderId && idsToDelete.has(selectedFolderId)) {
            if (folderToDelete.parentId && !idsToDelete.has(folderToDelete.parentId)) {
                setSelectedFolderId(folderToDelete.parentId);
            } else if (newFolders.length > 0) {
                setSelectedFolderId(newFolders[0].id);
            } else {
                setSelectedFolderId(null);
            }
        }
        return { ...prev, folders: newFolders, articles: newArticles };
    });
  }, [selectedFolderId]);

  const handleReorderFolder = useCallback((folderId: string, direction: 'up' | 'down') => {
    setProjectState(prev => {
        if (!prev) return null;
        const currentFolders = prev.folders;
        const folderToMove = currentFolders.find(f => f.id === folderId);
        if (!folderToMove) return prev;
    
        const siblings = currentFolders
          .filter(f => f.parentId === folderToMove.parentId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        
        const currentIndex = siblings.findIndex(f => f.id === folderId);
        let targetSibling: Folder | undefined;

        if (direction === 'up' && currentIndex > 0) {
          targetSibling = siblings[currentIndex - 1];
        } else if (direction === 'down' && currentIndex < siblings.length - 1) {
          targetSibling = siblings[currentIndex + 1];
        } else {
            return prev;
        }

        const nextFolders = currentFolders.map(f => {
          if (f.id === folderToMove.id) return {...f, sortOrder: targetSibling!.sortOrder };
          if (f.id === targetSibling.id) return {...f, sortOrder: folderToMove.sortOrder };
          return f;
        });
        return { ...prev, folders: nextFolders };
    });
  }, []);

  const handleToggleFolderExpansion = useCallback((folderId: string) => {
    setProjectState(prev => {
        if (!prev) return null;
        const newExpanded = new Set(prev.expandedFolderIds);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        return { ...prev, expandedFolderIds: Array.from(newExpanded) };
    });
  }, []);
  
  // --- Article Handlers ---
  const handleCreateArticle = useCallback(() => {
    if (!selectedFolderId) return;
    setProjectState(prev => {
        if (!prev) return null;
        const siblings = prev.articles.filter(a => a.folderId === selectedFolderId && a.parentId === null);
        const maxSortOrder = siblings.reduce((max, a) => Math.max(max, a.sortOrder || 0), -1);
        const newArticle: Article = {
          id: crypto.randomUUID(),
          title: 'Novo Artigo',
          folderId: selectedFolderId,
          sortOrder: maxSortOrder + 1,
          sections: [],
          relatedArticleIds: [],
          parentId: null,
        };
        setEditingArticle(newArticle);
        return { ...prev, articles: [...prev.articles, newArticle] };
    });
  }, [selectedFolderId]);

  const handleCreateSubArticle = useCallback((parentId: string) => {
    setProjectState(prev => {
      if (!prev) return null;
      const parentArticle = prev.articles.find(a => a.id === parentId);
      if (!parentArticle) return prev;

      const siblings = prev.articles.filter(a => a.parentId === parentId);
      const maxSortOrder = siblings.reduce((max, a) => Math.max(max, a.sortOrder), -1);

      const newArticle: Article = {
        id: crypto.randomUUID(),
        title: 'Novo Subartigo',
        folderId: parentArticle.folderId,
        parentId: parentId,
        sortOrder: maxSortOrder + 1,
        sections: [],
        relatedArticleIds: [],
      };
      
      const newExpandedArticleIds = prev.expandedArticleIds.includes(parentId)
        ? prev.expandedArticleIds
        : [...prev.expandedArticleIds, parentId];

      setEditingArticle(newArticle);
      return { 
        ...prev, 
        articles: [...prev.articles, newArticle],
        expandedArticleIds: newExpandedArticleIds,
      };
    });
  }, []);

  const handleUpdateArticleTitle = useCallback((articleId: string, newTitle: string) => {
    setProjectState(prev => {
        if (!prev) return null;
        return {
            ...prev,
            articles: prev.articles.map(a =>
                a.id === articleId ? { ...a, title: newTitle } : a
            ),
        };
    });
  }, []);

  const handleReorderArticle = useCallback((articleId: string, direction: 'up' | 'down') => {
    setProjectState(prev => {
        if (!prev) return null;
        const currentArticles = prev.articles;
        const articleToMove = currentArticles.find(a => a.id === articleId);
        if (!articleToMove) return prev;
    
        const siblings = currentArticles
          .filter(a => a.parentId === articleToMove.parentId && a.folderId === articleToMove.folderId)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        
        const currentIndex = siblings.findIndex(a => a.id === articleId);
        if (currentIndex === -1) return prev;

        let targetSibling: Article | undefined;

        if (direction === 'up' && currentIndex > 0) {
          targetSibling = siblings[currentIndex - 1];
        } else if (direction === 'down' && currentIndex < siblings.length - 1) {
          targetSibling = siblings[currentIndex + 1];
        }

        if (!targetSibling) {
            return prev;
        }

        const nextArticles = currentArticles.map(a => {
          if (a.id === articleToMove.id) return { ...a, sortOrder: targetSibling!.sortOrder };
          if (a.id === targetSibling.id) return { ...a, sortOrder: articleToMove.sortOrder };
          return a;
        });
        return { ...prev, articles: nextArticles };
    });
  }, []);

  const handleToggleArticleExpansion = useCallback((articleId: string) => {
    setProjectState(prev => {
        if (!prev) return null;
        const newExpanded = new Set(prev.expandedArticleIds);
        if (newExpanded.has(articleId)) {
            newExpanded.delete(articleId);
        } else {
            newExpanded.add(articleId);
        }
        return { ...prev, expandedArticleIds: Array.from(newExpanded) };
    });
  }, []);
  
  const handleEditArticle = useCallback((articleId: string) => {
    const articleToEdit = projectState?.articles.find(a => a.id === articleId);
    if (articleToEdit) {
      setEditingArticle(articleToEdit);
    }
  }, [projectState?.articles]);
  
  const handleSaveArticle = useCallback((updatedArticle: Article) => {
    setProjectState(prev => prev ? {
        ...prev,
        articles: prev.articles.map(a => a.id === updatedArticle.id ? updatedArticle : a)
    } : null);
    setEditingArticle(null);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditingArticle(null);
  }, []);

  const handleDeleteArticle = useCallback((articleId: string) => {
    setProjectState(prev => {
        if (!prev) return null;

        const idsToDelete = new Set<string>([articleId]);
        const queue = [articleId];
        const articlesToDelete: Article[] = [];
        const initialArticle = prev.articles.find(a => a.id === articleId);
        if (initialArticle) articlesToDelete.push(initialArticle);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const children = prev.articles.filter(a => a.parentId === currentId);
            for (const child of children) {
                idsToDelete.add(child.id);
                articlesToDelete.push(child);
                queue.push(child.id);
            }
        }
        
        // Delete associated images from IndexedDB
        articlesToDelete.forEach(article => {
          article.sections.forEach(section => {
            if (section.type === 'images') {
              section.images.forEach(image => db.deleteImage(image.id));
            }
          });
        });

        const newArticles = prev.articles.filter(a => !idsToDelete.has(a.id));

        if (selectedArticleId && idsToDelete.has(selectedArticleId)) {
            setSelectedArticleId(null);
        }
        return { ...prev, articles: newArticles };
    });
  }, [selectedArticleId]);
  
  if (!projectState) {
    return <WelcomeScreen 
        hasExistingProject={!!localStorage.getItem(PROJECT_STORAGE_KEY)}
        onContinue={handleContinueProject}
        onNew={handleNewProject}
        onLoadBackup={handleLoadBackup}
    />;
  }
  
  const { folders, articles } = projectState;
  const expandedFolderIdsSet = new Set(projectState.expandedFolderIds);
  const expandedArticleIdsSet = new Set(projectState.expandedArticleIds);
  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const articlesInSelectedFolder = articles.filter(a => a.folderId === selectedFolderId);
  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  return (
    <div className="flex h-screen font-sans">
      <Sidebar 
        folders={folders} 
        selectedFolderId={selectedFolderId}
        expandedFolderIds={expandedFolderIdsSet}
        onCreateFolder={handleCreateFolder}
        onCreateSubfolder={handleCreateSubfolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
        onSelectFolder={setSelectedFolderId}
        onToggleFolderExpansion={handleToggleFolderExpansion}
        onReorderFolder={handleReorderFolder}
        onSaveBackup={handleSaveBackup}
        onExportPdf={() => setIsPdfModalOpen(true)}
        newlyCreatedFolderId={newlyCreatedFolderId}
      />
      
      <ArticleListPanel
        selectedFolder={selectedFolder}
        articles={articlesInSelectedFolder}
        selectedArticleId={selectedArticleId}
        expandedArticleIds={expandedArticleIdsSet}
        onSelectArticle={setSelectedArticleId}
        onCreateArticle={handleCreateArticle}
        onCreateSubArticle={handleCreateSubArticle}
        onReorderArticle={handleReorderArticle}
        onToggleArticleExpansion={handleToggleArticleExpansion}
        onUpdateArticleTitle={handleUpdateArticleTitle}
        onDeleteArticle={handleDeleteArticle}
      />

      <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-gray-800">
         {selectedArticle ? (
            <ArticleViewer 
                article={selectedArticle}
                onEdit={handleEditArticle}
                onDelete={handleDeleteArticle}
                allArticles={articles}
                onSelectArticle={setSelectedArticleId}
            />
         ) : selectedFolder ? (
           <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <h2 className="text-2xl font-semibold mb-2">{selectedFolder.name}</h2>
            <p>Selecione um artigo para ver ou crie um novo para começar.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <h2 className="text-2xl font-semibold mb-2">Bem-vindo ao Estúdio do Escritor</h2>
            <p>Selecione uma pasta para ver os artigos.</p>
          </div>
        )}
      </main>

      {editingArticle && (
        <ArticleEditorModal 
          article={editingArticle}
          onSave={handleSaveArticle}
          onClose={handleCloseEditor}
          allFolders={folders}
          allArticles={articles}
        />
      )}

      {isPdfModalOpen && (
        <PdfExportModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            folders={folders}
            onGenerate={handleGeneratePdf}
            isGenerating={isGeneratingPdf}
        />
      )}
    </div>
  );
};

export default App;