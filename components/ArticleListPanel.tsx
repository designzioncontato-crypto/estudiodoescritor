import React, { useMemo } from 'react';
import type { Folder, Article } from '../types';
import { PlusIcon } from './icons';
import ArticleItem from './ArticleItem';

type ArticleWithChildren = Article & { children: ArticleWithChildren[] };

interface ArticleListPanelProps {
  selectedFolder: Folder | undefined;
  articles: Article[];
  selectedArticleId: string | null;
  expandedArticleIds: Set<string>;
  onSelectArticle: (id: string) => void;
  onCreateArticle: () => void;
  onCreateSubArticle: (parentId: string) => void;
  onReorderArticle: (articleId: string, direction: 'up' | 'down') => void;
  onToggleArticleExpansion: (articleId: string) => void;
  onUpdateArticleTitle: (articleId: string, newTitle: string) => void;
  onDeleteArticle: (articleId: string) => void;
}

const ArticleListPanel: React.FC<ArticleListPanelProps> = ({
  selectedFolder,
  articles,
  selectedArticleId,
  expandedArticleIds,
  onSelectArticle,
  onCreateArticle,
  onCreateSubArticle,
  onReorderArticle,
  onToggleArticleExpansion,
  onUpdateArticleTitle,
  onDeleteArticle,
}) => {
  const articleTree = useMemo(() => {
    const map = new Map<string, ArticleWithChildren>();
    articles.forEach(article => map.set(article.id, { ...article, children: [] }));
    
    const roots: ArticleWithChildren[] = [];
    map.forEach(article => {
      if (article.parentId && map.has(article.parentId)) {
        map.get(article.parentId)!.children.push(article);
      } else {
        roots.push(article);
      }
    });

    const sortArticles = (articleList: ArticleWithChildren[]) => {
      articleList.sort((a, b) => a.sortOrder - b.sortOrder);
      articleList.forEach(a => sortArticles(a.children));
    };
    sortArticles(roots);

    return roots;
  }, [articles]);
  
  const renderArticleTree = (articlesToRender: ArticleWithChildren[], level: number) => {
    return articlesToRender.map((article, index) => {
      const isExpanded = expandedArticleIds.has(article.id);
      const hasChildren = article.children.length > 0;
      const isFirst = index === 0;
      const isLast = index === articlesToRender.length - 1;

      return (
        <div key={article.id}>
          <div style={{ paddingLeft: `${level * 16}px` }}>
            <ArticleItem
                article={article}
                isSelected={article.id === selectedArticleId}
                isExpanded={isExpanded}
                hasChildren={hasChildren}
                onSelect={onSelectArticle}
                onUpdateTitle={onUpdateArticleTitle}
                onDelete={onDeleteArticle}
                onCreateSubArticle={onCreateSubArticle}
                onToggleExpand={onToggleArticleExpansion}
                onReorder={onReorderArticle}
                isFirst={isFirst}
                isLast={isLast}
            />
          </div>
          {isExpanded && hasChildren && renderArticleTree(article.children, level + 1)}
        </div>
      );
    });
  };


  if (!selectedFolder) {
    return (
      <div className="w-80 bg-gray-800/50 h-screen flex flex-col p-3 border-r border-gray-700/50">
        {/* Placeholder when no folder is selected */}
      </div>
    );
  }

  return (
    <aside className="w-80 bg-gray-800/50 h-screen flex flex-col p-3 border-r border-gray-700/50">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-700/50">
        <h2 className="text-lg font-semibold text-gray-200 truncate" title={selectedFolder.name}>
          {selectedFolder.name}
        </h2>
        <button
          onClick={onCreateArticle}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          aria-label="Create new article"
        >
          <PlusIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto space-y-1">
        {articles.length > 0 ? (
          renderArticleTree(articleTree, 0)
        ) : (
          <div className="text-center text-gray-500 pt-10">
            <p>Nenhum artigo nesta pasta.</p>
            <button
              onClick={onCreateArticle}
              className="mt-4 text-sm text-blue-400 hover:text-blue-300"
            >
              Criar um novo artigo
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ArticleListPanel;