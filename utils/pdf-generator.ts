import type { ProjectState, Folder, Article } from '../types';
import * as db from './db';

// These libraries are loaded from a CDN in index.html, so we declare them here
// to satisfy TypeScript without needing to install their types.
declare const jspdf: any;
declare const html2canvas: any;

const parseMarkdownForPdf = (text: string): string => {
  if (!text) return '';
  let html = text;
  // Note: no HTML escaping is needed here as the output is for html2canvas
  // and not direct browser rendering where XSS could be a concern.
  
  // Apply markdown-like formatting. Order is important for correct parsing.
  // Bold + Italic: ***text***
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Italic: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<em>$1</em>');
  // Bold: *text*
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

  // Keep other formats
  html = html.replace(/_(.*?)_/g, '<u>$1</u>');
  html = html.replace(/~(.*?)~/g, '<s>$1</s>');
  
  html = html.replace(/\n/g, '<br />');
  return html;
};

async function buildHtmlForPdf(project: ProjectState, selectedFolderIds: string[]): Promise<string> {
    let contentHtml = '';
    const { folders, articles } = project;
    const foldersById = new Map(folders.map(f => [f.id, f]));
    const articlesById = new Map(articles.map(a => [a.id, a]));

    const renderArticle = async (article: Article, level: number): Promise<string> => {
        let articleHtml = `<div class="article" style="margin-left: ${level * 20}px;">`;
        articleHtml += `<h2 style="font-size: 24px; color: #000000; border-bottom: 1px solid #DDDDDD; padding-bottom: 8px; margin-bottom: 16px;">${article.title}</h2>`;

        for (const section of article.sections) {
          if (section.type === 'images') {
              articleHtml += `<div class="section" style="margin-bottom: 24px; page-break-inside: avoid;">`;
              articleHtml += `<h3 style="font-size: 20px; color: #D97706; margin-bottom: 12px;">${section.title}</h3>`;
              
              // Create a flex container to mimic the gallery layout from the viewer
              articleHtml += `<div class="gallery-container" style="display: flex; flex-wrap: wrap; justify-content: center; margin: -8px;">`;

              for (const image of section.images) {
                  const dataUrl = await db.getImage(image.id);
                  if (dataUrl) {
                    // Each image is a figure-like element with a fixed width and margin to create the gap
                    articleHtml += `<div class="image-wrapper" style="width: 256px; margin: 8px;">`;
                    // The image has a fixed height and object-fit: cover to respect the crop and aspect ratio
                    articleHtml += `<img src="${dataUrl}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 6px; background-color: #F3F4F6;" />`;
                    if (image.caption) {
                        articleHtml += `<p style="font-size: 14px; color: #555555; font-style: italic; text-align: center; margin-top: 8px;">${image.caption}</p>`;
                    }
                    articleHtml += `</div>`;
                  }
              }
              articleHtml += `</div>`; // Close gallery-container
              articleHtml += `</div>`;
          } else { // 'fields' section
              articleHtml += `<div class="section" style="margin-bottom: 24px;">`;
              articleHtml += `<h3 style="font-size: 20px; color: #D97706; margin-bottom: 12px;">${section.title}</h3>`;
              section.fields.forEach(field => {
                  articleHtml += `<div class="field" style="margin-bottom: 16px;">`;
                  articleHtml += `<h4 style="font-size: 16px; color: #000000; font-weight: 600; margin-bottom: 4px;">${field.title}</h4>`;
                  articleHtml += `<p style="line-height: 1.6; color: #000000; text-align: justify;">${parseMarkdownForPdf(field.content)}</p>`;
                  articleHtml += `</div>`;
              });
              articleHtml += `</div>`;
          }
        }
        
        const relatedArticles = (article.relatedArticleIds || [])
            .map(id => articlesById.get(id))
            .filter(Boolean);

        if (relatedArticles.length > 0) {
            articleHtml += `<div class="related-articles" style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #DDDDDD;">`;
            articleHtml += `<h3 style="font-size: 20px; color: #D97706; margin-bottom: 12px;">Artigos Relacionados</h3>`;
            articleHtml += `<ul>`;
            relatedArticles.forEach(related => {
                 articleHtml += `<li style="list-style-type: disc; margin-left: 20px;">${related!.title}</li>`;
            });
            articleHtml += `</ul>`;
            articleHtml += `</div>`;
        }

        articleHtml += `</div>`;
        return articleHtml;
    };

    const renderFolder = async (folderId: string): Promise<void> => {
        const folder = foldersById.get(folderId);
        if (!folder) return;

        contentHtml += `<div class="folder" style="margin-bottom: 32px; page-break-before: auto; page-break-inside: avoid;">`;
        contentHtml += `<h1 style="font-size: 32px; font-weight: bold; color: #000000; margin-bottom: 24px;">${folder.name}</h1>`;

        const rootArticlesInFolder = articles
            .filter(a => a.folderId === folderId && !a.parentId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
            
        const articlesByParentId = new Map<string, Article[]>();
        articles.forEach(a => {
            if (a.parentId) {
                if (!articlesByParentId.has(a.parentId)) {
                    articlesByParentId.set(a.parentId, []);
                }
                articlesByParentId.get(a.parentId)!.push(a);
            }
        });

        const renderArticleTree = async (articleList: Article[], level: number): Promise<void> => {
            for (const article of articleList) {
                contentHtml += await renderArticle(article, level);
                const children = articlesByParentId.get(article.id) || [];
                if (children.length > 0) {
                    children.sort((a, b) => a.sortOrder - b.sortOrder);
                    await renderArticleTree(children, level + 1);
                }
            }
        };
        
        await renderArticleTree(rootArticlesInFolder, 0);
        contentHtml += `</div>`;
    };
    
    const rootFoldersToRender = folders
        .filter(f => selectedFolderIds.includes(f.id) && !f.parentId)
        .sort((a,b) => a.sortOrder - b.sortOrder);

    const foldersByParentId = new Map<string, Folder[]>();
    folders.forEach(f => {
        if (f.parentId) {
            if (!foldersByParentId.has(f.parentId)) {
                foldersByParentId.set(f.parentId, []);
            }
            foldersByParentId.get(f.parentId)!.push(f);
        }
    });

    const renderFolderTree = async (folderList: Folder[]): Promise<void> => {
        for (const folder of folderList) {
            if (selectedFolderIds.includes(folder.id)) {
                await renderFolder(folder.id);
            }
            const children = foldersByParentId.get(folder.id) || [];
             if (children.length > 0) {
                children.sort((a, b) => a.sortOrder - b.sortOrder);
                await renderFolderTree(children);
            }
        }
    };
    
    await renderFolderTree(rootFoldersToRender);

    return `
        <div style="font-family: 'Helvetica Neue', 'Arial', sans-serif; background-color: #FFFFFF; color: #000000; padding: 40px;">
            ${contentHtml}
        </div>
    `;
}

export const generatePdf = async (project: ProjectState, selectedFolderIds: string[]): Promise<void> => {
    const contentHtml = await buildHtmlForPdf(project, selectedFolderIds);

    const printElement = document.createElement('div');
    printElement.innerHTML = contentHtml;
    // Style for printing off-screen
    printElement.style.position = 'absolute';
    printElement.style.left = '-9999px';
    printElement.style.top = '0';
    printElement.style.width = '800px'; // A reasonable width for rendering
    document.body.appendChild(printElement);

    try {
        const canvas = await html2canvas(printElement, {
            scale: 2,
            backgroundColor: '#FFFFFF',
            useCORS: true,
            allowTaint: true,
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = jspdf;
        // A4 page is 210mm x 297mm. We'll use some margins.
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / pdfWidth;
        const canvasHeightInPdf = canvasHeight / ratio;

        let position = 0;
        let pageCount = 1;
        
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightInPdf);
        let heightLeft = canvasHeightInPdf - pdfHeight;
        
        while (heightLeft > 0) {
            position = -pdfHeight * pageCount;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightInPdf);
            heightLeft -= pdfHeight;
            pageCount++;
        }
        
        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const formattedDate = `${day}-${month}-${year}`;

        pdf.save(`EscritorDB-${formattedDate}.pdf`);
    } finally {
        // Clean up the temporary element
        document.body.removeChild(printElement);
    }
};