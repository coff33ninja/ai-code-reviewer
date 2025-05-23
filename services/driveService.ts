import { FILE_EXTENSION_TO_LANGUAGE, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../constants';

// Tries to extract File ID from various Google Drive link formats
export const parseGoogleDriveLink = (url: string): { fileId: string, originalFileName?: string } | null => {
  try {
    const parsedUrl = new URL(url);
    let fileId: string | null = null;
    let originalFileName: string | undefined;

    if (parsedUrl.hostname === 'drive.google.com') {
      if (parsedUrl.pathname.startsWith('/file/d/')) {
        // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
        // Format: https://drive.google.com/file/d/FILE_ID/edit
        // Format: https://drive.google.com/file/d/FILE_ID (less common)
        fileId = parsedUrl.pathname.split('/')[3];
      } else if (parsedUrl.searchParams.get('id')) {
        // Format: https://drive.google.com/open?id=FILE_ID
        // Format: https://drive.google.com/uc?id=FILE_ID&export=download (less common direct link)
        fileId = parsedUrl.searchParams.get('id');
      }
    } else if (parsedUrl.hostname.endsWith('.google.com') && parsedUrl.pathname.includes('/d/')) {
      // Format: https://docs.google.com/document/d/FILE_ID/edit
      // Format: https://docs.google.com/spreadsheets/d/FILE_ID/edit
      // Format: https://docs.google.com/presentation/d/FILE_ID/edit
      const pathParts = parsedUrl.pathname.split('/');
      const dIndex = pathParts.indexOf('d');
      if (dIndex !== -1 && dIndex + 1 < pathParts.length) {
        fileId = pathParts[dIndex + 1];
      }
    }
    
    // Attempt to get filename from title parameter if it's a direct download link sometimes provided by Drive UI
    // e.g. from "Get link" -> "Copy link" on certain file types then modifying it.
    // Or from export URLs that include it. This is less reliable.
    if (parsedUrl.searchParams.get('title')) {
        originalFileName = parsedUrl.searchParams.get('title')!;
    } else if (fileId && parsedUrl.pathname.includes(fileId) && parsedUrl.pathname.split(fileId)[1]) {
        // Extremely rough guess if the URL path after file ID contains something looking like a filename
        let potentialName = parsedUrl.pathname.split(fileId)[1].split('?')[0].replace(/^\//, '');
        if (potentialName.includes('.')) {
            originalFileName = decodeURIComponent(potentialName);
        }
    }


    return fileId ? { fileId, originalFileName } : null;
  } catch (error) {
    console.error('Error parsing Google Drive link:', error);
    return null;
  }
};

// Constructs a direct download URL. For Google native files (Docs, Sheets), this attempts plain text export.
export const getGoogleDriveFileDownloadUrl = (fileId: string): string => {
  // For non-native files, uc?export=download is usually enough.
  // For Google Docs, we request plain text export.
  // For Sheets, typically CSV. For Slides, typically PDF.
  // Let's standardize on trying to get text if possible.
  // The `uc?export=download` is generally robust for many file types and will try to convert GDocs to .txt
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

export const fetchDriveFileContent = async (downloadUrl: string): Promise<string> => {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      // Google Drive often returns 200 OK with an HTML error page if the file is not public or link is wrong.
      // Check content type to be more robust.
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html') && response.status === 200) {
         // Try to read the body to see if it's a known error page
         const text = await response.text();
         if (text.includes('File not found') || text.includes('you need permission') || text.includes('Access denied')) {
            throw new Error(`Access denied or file not found for Google Drive link. Ensure the file is publicly accessible ("Anyone with the link can view").`);
         }
         // If it's HTML but not a known error, it might be an unexpected format.
         // For this app, we primarily expect text-based code files.
         throw new Error(`Failed to fetch Google Drive file: Received HTML content instead of expected file content. Status: ${response.status}. URL: ${downloadUrl}`);
      }

      if (response.status === 403) {
        throw new Error(`Access denied for Google Drive file (403). Ensure the file is publicly accessible ("Anyone with the link can view"). URL: ${downloadUrl}`);
      }
      if (response.status === 404) {
        throw new Error(`Google Drive file not found (404). Please check the URL: ${downloadUrl}`);
      }
      throw new Error(`Failed to fetch Google Drive file: ${response.status} ${response.statusText}. URL: ${downloadUrl}`);
    }
    const fileContent = await response.text();
    // Basic check for very large files if Drive doesn't send Content-Length properly
    if (fileContent.length > 10 * 1024 * 1024) { // 10MB limit for sanity
        throw new Error("File is too large (over 10MB). Please select a smaller file.");
    }
    return fileContent;
  } catch (error) {
    console.error('Error fetching Google Drive file content:', error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching the Google Drive file.');
  }
};

// Infers language based on filename (if available)
export const inferLanguageFromDriveFileName = (fileName?: string): string => {
  if (!fileName) return DEFAULT_LANGUAGE;
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension && FILE_EXTENSION_TO_LANGUAGE[extension]) {
    const langValue = FILE_EXTENSION_TO_LANGUAGE[extension];
    if (SUPPORTED_LANGUAGES.some(l => l.value === langValue)) {
        return langValue;
    }
  }
  return DEFAULT_LANGUAGE;
};
