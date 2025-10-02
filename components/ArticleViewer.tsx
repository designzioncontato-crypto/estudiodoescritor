import React, { useState, useEffect } from 'react';
import type { Article, ImageField } from '../types';
import { PencilIcon, TrashIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from './icons';
import * as db from '../utils/db';

const parseMarkdown = (text: string): string => {
  if (!text) return '';

  // 1. Escape HTML to prevent rendering of user-inputted HTML tags.
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Apply markdown-like formatting. Order is important for correct parsing.
  // Bold + Italic: ***text***
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Italic: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<em>$1</em>');
  // Bold: *text*
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  
  // Keep other formats
  // Underline: _text_
  html = html.replace(/_(.*?)_/g, '<u>$1</u>');
  // Strikethrough: ~text~
  html = html.replace(/~(.*?)~/g, '<s>$1</s>');
  
  // 3. Convert newlines to <br> tags.
  html = html.replace(/\n/g, '<br />');

  return html;
};


const ViewableGalleryImage: React.FC<{ image: ImageField }> = ({ image }) => {
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
         return <figure className="w-64 h-40 bg-gray-800 rounded-md flex items-center justify-center"><p className="text-xs text-gray-400">Carregando imagem...</p></figure>;
    }
    
    if (!dataUrl) {
        return (
            <figure className="w-64">
                <div className="w-full h-40 object-cover rounded-md bg-red-900/50 flex items-center justify-center text-center p-2">
                    <p className="text-xs text-red-300">Dados da imagem não encontrados.</p>
                </div>
                {image.caption && <figcaption className="mt-2 text-sm text-gray-300 text-center">{image.caption}</figcaption>}
            </figure>
        );
    }
    
    return (
        <figure className="w-64">
            <img
                src={dataUrl}
                alt={image.caption || 'Article image'}
                className="w-full h-40 object-cover rounded-md bg-gray-800"
            />
            {image.caption && (
                <figcaption className="mt-2 text-sm text-gray-300 text-center">
                    {image.caption}
                </figcaption>
            )}
        </figure>
    );
};

interface ArticleViewerProps {
  article: Article;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  allArticles: Article[];
  onSelectArticle: (id: string) => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}

const ArticleViewer: React.FC<ArticleViewerProps> = ({ article, onEdit, onDelete, allArticles, onSelectArticle, isFocusMode, onToggleFocusMode }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDelete = () => {
    onDelete(article.id);
  };

  const relatedArticles = (article.relatedArticleIds || [])
    .map(id => allArticles.find(a => a.id === id))
    .filter((a): a is Article => a !== undefined);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex-shrink-0 py-4 mb-8 flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white truncate">{article.title}</h1>
        {isConfirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Tem certeza?</span>
            <button
              onClick={handleDelete}
              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded-md text-white"
            >
              Excluir
            </button>
            <button
              onClick={() => setIsConfirmingDelete(false)}
              className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded-md text-white"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleFocusMode}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
              aria-label={isFocusMode ? "Sair do Modo Foco" : "Entrar no Modo Foco"}
            >
              {isFocusMode ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
              <span className="text-sm">{isFocusMode ? 'Sair do Foco' : 'Modo Foco'}</span>
            </button>
            
            <div className="w-px h-6 bg-gray-600"></div>

            <button
              onClick={() => onEdit(article.id)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
              aria-label="Edit article"
            >
              <PencilIcon className="w-5 h-5" />
              <span className="text-sm">Editar</span>
            </button>
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-gray-700"
              aria-label="Delete article"
            >
              <TrashIcon className="w-5 h-5" />
              <span className="text-sm">Excluir</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pr-4 space-y-8">
        {article.sections.length === 0 && (
          <div className="text-center text-gray-500 pt-16">
            <p>Este artigo está vazio.</p>
            <button
              onClick={() => onEdit(article.id)}
              className="mt-4 text-sm text-blue-400 hover:text-blue-300"
            >
              Comece a editar
            </button>
          </div>
        )}
        {article.sections.map((section) => {
          if (section.type === 'images') {
            return (
              <section key={section.id} className="bg-gray-700/50 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">
                  {section.title}
                </h2>
                {section.images.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-4">
                    {section.images.map((image) => (
                      <ViewableGalleryImage key={image.id} image={image} />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Esta galeria está vazia.</p>
                )}
              </section>
            );
          }

          return (
            <section key={section.id} className="bg-gray-700/50 p-6 rounded-lg">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">
                {section.title}
              </h2>
              <div className="space-y-6">
                {section.fields.map((field) => (
                  <div key={field.id}>
                    <h3 className="text-lg font-bold text-white mb-1">{field.title}</h3>
                    <p
                      className="text-white"
                      style={{ lineHeight: 1.6, textAlign: 'justify', overflowWrap: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(field.content) }}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {relatedArticles.length > 0 && (
            <section className="mt-12 pt-6 border-t border-gray-700/50">
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">
                    Artigos Relacionados
                </h2>
                <div className="flex flex-wrap gap-3">
                    {relatedArticles.map(related => (
                        <button
                            key={related.id}
                            onClick={() => onSelectArticle(related.id)}
                            className="text-left p-3 rounded-lg border border-amber-600/20 bg-transparent hover:bg-amber-500/10 hover:border-amber-600/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                            <h3 className="font-semibold text-amber-400 truncate">{related.title}</h3>
                        </button>
                    ))}
                </div>
            </section>
        )}
      </div>
    </div>
  );
};

export default ArticleViewer;