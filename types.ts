export interface Folder {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
}

export interface Field {
  id: string;
  title: string;
  content: string;
}

export interface ImageField {
  id: string;
  caption: string;
}

export interface ImageData {
  id: string;
  dataUrl: string;
}

export interface FieldsSection {
  id:string;
  type: 'fields';
  title: string;
  fields: Field[];
}

export interface ImagesSection {
  id: string;
  type: 'images';
  title: string;
  images: ImageField[];
}

export type Section = FieldsSection | ImagesSection;


export interface Article {
  id: string;
  title: string;
  folderId: string;
  sortOrder: number;
  sections: Section[];
  relatedArticleIds: string[];
  parentId: string | null;
}

export interface ProjectState {
  folders: Folder[];
  articles: Article[];
  expandedFolderIds: string[];
  expandedArticleIds: string[];
}