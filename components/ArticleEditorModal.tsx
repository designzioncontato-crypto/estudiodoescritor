import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Article, Section, Field, Folder, ImageField, ImagesSection } from '../types';
import { PlusIcon, TrashIcon, XIcon, ChevronUpIcon, ChevronDownIcon, ImageIcon } from './icons';
import * as db from '../utils/db';
import ImageCropModal from './ImageCropModal';


const EditableGalleryImage: React.FC<{
    image: ImageField;
    onUpdateCaption: (newCaption: string) => void;
    onDelete: () => void;
}> = ({ image, onUpdateCaption, onDelete }) => {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        db.getImage(image.id).then(url => {
            if (isMounted && url) {
                setDataUrl(url);
            }
            setIsLoading(false);
        }).catch(() => {
            if (isMounted) setIsLoading(false);
        });
        return () => { isMounted = false; };
    }, [image.id]);

    if (isLoading) {
        return <div className="w-48 h-48 bg-gray-700 rounded-lg flex items-center justify-center"><p className="text-xs text-gray-400">Carregando...</p></div>;
    }

    if (!dataUrl) {
         return <div className="w-48 h-48 bg-red-900/50 rounded-lg flex items-center justify-center text-center p-2"><p className="text-xs text-red-300">Imagem não encontrada no banco de dados.</p></div>;
    }

    return (
        <div className="relative w-48 h-48 bg-gray-700 rounded-lg overflow-hidden group flex flex-col">
            <img src={dataUrl} alt={image.caption || 'Imagem'} className="w-full h-3/4 object-cover"/>
            <input
                type="text"
                value={image.caption}
                onChange={(e) => onUpdateCaption(e.target.value)}
                placeholder="Legenda..."
                className="w-full bg-gray-800 text-white px-2 py-1 text-xs focus:outline-none h-1/4 border-t border-gray-700"
            />
            <button
                onClick={onDelete}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                aria-label="Excluir imagem"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
    );
};


interface ArticleEditorModalProps {
  article: Article;
  onSave: (article: Article) => void;
  onClose: () => void;
  allFolders: Folder[];
  allArticles: Article[];
}

const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({ article: initialArticle, onSave, onClose, allFolders, allArticles }) => {
  const [article, setArticle] = useState<Article>(initialArticle);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [croppingImage, setCroppingImage] = useState<{ dataUrl: string, sectionId: string } | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const potentialRelatedArticles = useMemo(() => {
    if (!initialArticle.folderId) return [];
    
    let currentFolder = allFolders.find(f => f.id === initialArticle.folderId);
    if (!currentFolder) return [];
    
    let rootFolder = currentFolder;
    while (rootFolder.parentId) {
        const parent = allFolders.find(f => f.id === rootFolder.parentId);
        if (!parent) break;
        rootFolder = parent;
    }

    const folderIdsInTree = new Set<string>();
    const queue = [rootFolder.id];
    folderIdsInTree.add(rootFolder.id);
    
    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = allFolders.filter(f => f.parentId === currentId);
        for (const child of children) {
            folderIdsInTree.add(child.id);
            queue.push(child.id);
        }
    }
    
    return allArticles.filter(a => folderIdsInTree.has(a.folderId) && a.id !== initialArticle.id);
    
}, [initialArticle.folderId, allFolders, allArticles, initialArticle.id]);


  const filteredPotentialArticles = useMemo(() => {
    return potentialRelatedArticles.filter(
        (related) =>
            !(article.relatedArticleIds || []).includes(related.id) &&
            related.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [potentialRelatedArticles, article.relatedArticleIds, searchQuery]);


  const handleUpdate = <T extends keyof Article>(field: T, value: Article[T]) => {
    setArticle(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSectionUpdate = <T extends keyof Section>(sectionId: string, field: T, value: Section[T]) => {
    handleUpdate('sections', article.sections.map(s => s.id === sectionId ? {...s, [field]: value} : s));
  };
  
  const handleFieldUpdate = (sectionId: string, fieldId: string, field: keyof Field, value: string) => {
    const newSections = article.sections.map(s => {
      if (s.id === sectionId && s.type === 'fields') {
        return {
          ...s,
          fields: s.fields.map(f => f.id === fieldId ? { ...f, [field]: value } : f)
        };
      }
      return s;
    });
    handleUpdate('sections', newSections);
  };
  
  const handleAddSection = () => {
    const newSection: Section = {
      id: crypto.randomUUID(),
      type: 'fields',
      title: 'Nova Seção',
      fields: [],
    };
    handleUpdate('sections', [...article.sections, newSection]);
  };

  const handleAddImageSection = () => {
    const newSection: ImagesSection = {
      id: crypto.randomUUID(),
      type: 'images',
      title: 'Nova Galeria',
      images: [],
    };
    handleUpdate('sections', [...article.sections, newSection]);
  };

  const handleDeleteSection = (sectionId: string) => {
    const sectionToDelete = article.sections.find(s => s.id === sectionId);
    if (sectionToDelete && sectionToDelete.type === 'images') {
        // Delete all associated images from DB
        sectionToDelete.images.forEach(image => db.deleteImage(image.id));
    }
    handleUpdate('sections', article.sections.filter(s => s.id !== sectionId));
  };

  const handleReorderSection = (sectionId: string, direction: 'up' | 'down') => {
    const sectionIndex = article.sections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) return;

    const newIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    if (newIndex < 0 || newIndex >= article.sections.length) return;

    const newSections = [...article.sections];
    const [movedSection] = newSections.splice(sectionIndex, 1);
    newSections.splice(newIndex, 0, movedSection);

    handleUpdate('sections', newSections);
  };
  
  const handleAddField = (sectionId: string) => {
    const newField: Field = {
      id: crypto.randomUUID(),
      title: 'Novo Campo',
      content: '',
    };
    const newSections = article.sections.map(s => {
      if (s.id === sectionId && s.type === 'fields') {
        return { ...s, fields: [...s.fields, newField] };
      }
      return s;
    });
    handleUpdate('sections', newSections);
  };

  const handleDeleteField = (sectionId: string, fieldId: string) => {
    const newSections = article.sections.map(s => {
        if (s.id === sectionId && s.type === 'fields') {
            return {...s, fields: s.fields.filter(f => f.id !== fieldId)};
        }
        return s;
    });
    handleUpdate('sections', newSections);
  };
  
  const handleReorderField = (sectionId: string, fieldId: string, direction: 'up' | 'down') => {
    const newSections = article.sections.map(s => {
      if (s.id === sectionId && s.type === 'fields') {
        const fieldIndex = s.fields.findIndex(f => f.id === fieldId);
        if (fieldIndex === -1) return s;

        const newIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
        if (newIndex < 0 || newIndex >= s.fields.length) return s;

        const newFields = [...s.fields];
        const [movedField] = newFields.splice(fieldIndex, 1);
        newFields.splice(newIndex, 0, movedField);
        
        return { ...s, fields: newFields };
      }
      return s;
    });
    handleUpdate('sections', newSections);
  };

  const handleFileSelect = (sectionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setCroppingImage({ dataUrl, sectionId });
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset input to allow selecting the same file again
  };

  const handleCropSave = async (croppedDataUrl: string, sectionId: string) => {
    const newImage: ImageField = {
      id: crypto.randomUUID(),
      caption: '',
    };
    
    await db.putImage(newImage.id, croppedDataUrl);

    const newSections = article.sections.map(s => {
        if (s.id === sectionId && s.type === 'images') {
            return { ...s, images: [...s.images, newImage] };
        }
        return s;
    });
    handleUpdate('sections', newSections);
    setCroppingImage(null); // Close the crop modal
  };

  const handleDeleteImage = (sectionId: string, imageId: string) => {
    db.deleteImage(imageId); // Delete from DB
    const newSections = article.sections.map(s => {
        if (s.id === sectionId && s.type === 'images') {
            return { ...s, images: s.images.filter(img => img.id !== imageId) };
        }
        return s;
    });
    handleUpdate('sections', newSections);
  };

  const handleUpdateImageCaption = (sectionId: string, imageId: string, newCaption: string) => {
    const newSections = article.sections.map(s => {
        if (s.id === sectionId && s.type === 'images') {
            return {
                ...s,
                images: s.images.map(img => img.id === imageId ? { ...img, caption: newCaption } : img)
            };
        }
        return s;
    });
    handleUpdate('sections', newSections);
  };

  const handleToggleRelatedArticle = (relatedArticleId: string) => {
    const currentRelatedIds = article.relatedArticleIds || [];
    const newRelatedIds = currentRelatedIds.includes(relatedArticleId)
        ? currentRelatedIds.filter(id => id !== relatedArticleId)
        : [...currentRelatedIds, relatedArticleId];
    handleUpdate('relatedArticleIds', newRelatedIds);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
    >
        {croppingImage && (
            <ImageCropModal
                imageSrc={croppingImage.dataUrl}
                onSave={(croppedDataUrl) => handleCropSave(croppedDataUrl, croppingImage.sectionId)}
                onClose={() => setCroppingImage(null)}
            />
        )}

      <div 
        className="bg-gray-800 w-full max-w-4xl h-[90vh] rounded-lg shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ display: croppingImage ? 'none' : 'flex' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <input
            type="text"
            value={article.title}
            onChange={(e) => handleUpdate('title', e.target.value)}
            placeholder="Título do Artigo"
            className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none"
          />
          <button onClick={onClose} className="p-2 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow p-6 overflow-y-auto space-y-8">
          {article.sections.map((section, sectionIndex) => {
            const commonHeader = (
              <div className="flex items-center justify-between mb-4">
                 <input
                    type="text"
                    value={section.title}
                    onChange={(e) => handleSectionUpdate(section.id, 'title', e.target.value)}
                    placeholder="Título da Seção"
                    className="w-full bg-transparent text-xl font-semibold text-gray-200 focus:outline-none"
                />
                <div className="flex items-center shrink-0">
                    <button
                        onClick={() => handleReorderSection(section.id, 'up')}
                        disabled={sectionIndex === 0}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move section up"
                    >
                        <ChevronUpIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => handleReorderSection(section.id, 'down')}
                        disabled={sectionIndex === article.sections.length - 1}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move section down"
                    >
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => handleDeleteSection(section.id)}
                        className="p-1 text-gray-500 hover:text-red-400 rounded-full"
                        aria-label="Delete section"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
              </div>
            );

            if (section.type === 'images') {
              return (
                <div key={section.id} className="bg-gray-900/50 p-4 rounded-lg">
                  {commonHeader}
                  <div className="flex flex-wrap justify-center gap-4 pt-2">
                    {section.images.map(image => (
                       <EditableGalleryImage
                          key={image.id}
                          image={image}
                          onUpdateCaption={(newCaption) => handleUpdateImageCaption(section.id, image.id, newCaption)}
                          onDelete={() => handleDeleteImage(section.id, image.id)}
                       />
                    ))}
                    <label className="w-48 h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-400 cursor-pointer transition-colors">
                        <ImageIcon className="w-10 h-10 mb-2"/>
                        <span className="text-sm">Adicionar Imagem</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(section.id, e)}/>
                    </label>
                  </div>
                </div>
              );
            }

            return (
              <div key={section.id} className="bg-gray-900/50 p-4 rounded-lg">
                {commonHeader}
                <div className="space-y-4">
                  {section.fields.map((field, fieldIndex) => (
                    <div key={field.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={field.title}
                          onChange={(e) => handleFieldUpdate(section.id, field.id, 'title', e.target.value)}
                          placeholder="Título do campo"
                          className="flex-grow bg-gray-700 text-white rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <div className="flex items-center">
                          <button
                            onClick={() => handleReorderField(section.id, field.id, 'up')}
                            disabled={fieldIndex === 0}
                            className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move field up"
                          >
                            <ChevronUpIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReorderField(section.id, field.id, 'down')}
                            disabled={fieldIndex === section.fields.length - 1}
                            className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move field down"
                          >
                            <ChevronDownIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteField(section.id, field.id)} 
                            className="p-1 text-gray-500 hover:text-red-400 rounded-full"
                            aria-label="Delete field"
                          >
                             <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={field.content}
                        onChange={(e) => handleFieldUpdate(section.id, field.id, 'content', e.target.value)}
                        placeholder="Conteúdo..."
                        rows={4}
                        className="w-full bg-gray-700 text-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleAddField(section.id)}
                  className="mt-4 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Adicionar Campo
                </button>
              </div>
            );
          })}
          
          <div className="flex gap-4">
            <button
              onClick={handleAddSection}
              className="w-full py-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Adicionar Seção de Texto
            </button>
            <button
              onClick={handleAddImageSection}
              className="w-full py-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-5 h-5" />
              Adicionar Galeria de Imagens
            </button>
          </div>
          
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-200 mb-4">Artigos Relacionados</h3>
            <div className="relative" ref={searchContainerRef}>
              <div 
                className="flex flex-wrap gap-2 items-center w-full bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus-within:ring-2 focus-within:ring-blue-500"
                onClick={() => searchContainerRef.current?.querySelector('input')?.focus()}
              >
                {(article.relatedArticleIds || []).map(id => {
                  const related = allArticles.find(a => a.id === id);
                  if (!related) return null;
                  return (
                    <span key={id} className="flex items-center gap-1.5 bg-blue-600 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                      {related.title}
                      <button 
                        type="button"
                        onClick={() => handleToggleRelatedArticle(id)}
                        className="text-blue-200 hover:text-white rounded-full hover:bg-black/20"
                        aria-label={`Remover ${related.title}`}
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Adicionar artigo relacionado..."
                  className="bg-transparent flex-grow focus:outline-none text-sm min-w-[150px] py-1"
                />
              </div>

              {isDropdownOpen && (
                <ul className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredPotentialArticles.length > 0 ? (
                    filteredPotentialArticles.map(related => (
                      <li 
                        key={related.id}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handleToggleRelatedArticle(related.id);
                            setSearchQuery('');
                        }}
                        className="px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 cursor-pointer"
                      >
                        {related.title}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-sm text-gray-500">
                      {potentialRelatedArticles.length === (article.relatedArticleIds || []).length 
                        ? 'Todos os artigos já foram relacionados.'
                        : 'Nenhum artigo encontrado.'
                      }
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-700 shrink-0">
          <button
            onClick={() => onSave(article)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArticleEditorModal;
