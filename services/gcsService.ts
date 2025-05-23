import { FILE_EXTENSION_TO_LANGUAGE, DEFAULT_LANGUAGE } from '../constants';

export const parseGCSUrl = (url: string): { bucket: string; objectName: string } | null => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'storage.googleapis.com') {
      if (parsedUrl.hostname === 'console.cloud.google.com' && parsedUrl.pathname.startsWith('/storage/browser/')) {
        const parts = parsedUrl.pathname.substring('/storage/browser/'.length).split('/');
        if (parts.length >= 2) {
          const bucket = parts[0];
          const objectName = parts.slice(1).join('/');
          return { bucket, objectName };
        }
      }
      return null;
    }
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length >= 2) {
      return { bucket: pathParts[0], objectName: pathParts.slice(1).join('/') };
    }
    return null;
  } catch (error) {
    console.error("Error parsing GCS URL:", error);
    return null;
  }
};

export const getGCSObjectUrl = (bucket: string, objectName: string): string => {
  return `https://storage.googleapis.com/${bucket}/${objectName}`;
};

export const fetchGCSObjectContent = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(`Access denied for GCS object: ${url}. Ensure the object is publicly readable or CORS is configured for the bucket.`);
      }
      if (response.status === 404) {
        throw new Error(`GCS object not found: ${url}. Please check the URL.`);
      }
      throw new Error(`Failed to fetch GCS object: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error fetching GCS object content:", error);
    if (error instanceof Error) throw error;
    throw new Error("An unknown error occurred while fetching the GCS object.");
  }
};

export const inferLanguageFromGCSObjectName = (objectName: string): string => {
  const nameParts = objectName.split('/');
  const fileName = nameParts[nameParts.length - 1];
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension && FILE_EXTENSION_TO_LANGUAGE[extension]) {
    return FILE_EXTENSION_TO_LANGUAGE[extension];
  }
  return DEFAULT_LANGUAGE;
};
