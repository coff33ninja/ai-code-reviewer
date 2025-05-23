import { Base64 } from 'js-base64';
import { GithubRepoFile } from '../types'; 
import { 
    MAX_FILES_FOR_SEQUENTIAL_SCAN, 
    REPO_ANALYSIS_MAX_DEPTH,
    FILE_EXTENSION_TO_LANGUAGE, 
    MAX_INDIVIDUAL_FILE_SIZE_FOR_REPO_ANALYSIS
} from '../constants';

const GITHUB_API_BASE_URL = 'https://api.github.com';

interface RepoContentsParams {
  owner: string;
  repo: string;
  path?: string;
}

const fetchContents = async ({ owner, repo, path = '' }: RepoContentsParams): Promise<GithubRepoFile[]> => {
  const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error(`Path '${path || 'root'}' not found in ${owner}/${repo} or repository is private.`);
    if (response.status === 403) throw new Error(`GitHub API rate limit exceeded or access forbidden for ${owner}/${repo}/${path}. Consider waiting or using a token if developing locally.`);
    throw new Error(`Failed to fetch contents for ${owner}/${repo}/${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

export const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'github.com') return null;
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length >= 2) return { owner: pathParts[0], repo: pathParts[1].replace(/\.git$/, '') };
    return null;
  } catch (error) {
    return null;
  }
};

// Renamed from fetchRepoRootFiles, now fetches all items (files and dirs) at a given path
export const fetchGitHubPathContents = async (owner: string, repo: string, path: string = ''): Promise<GithubRepoFile[]> => {
  const items = await fetchContents({ owner, repo, path });
  // Sort by type (directories first) then by name
  return items.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });
};


export const fetchFileContent = async (file: GithubRepoFile): Promise<string> => {
  if (!file.url) throw new Error('File API URL is missing.');
  // Use a slightly larger limit here than in fetchAllFilesRecursive because we are explicitly selecting this file.
  const MAX_SIZE_FOR_SELECTED_FILE = MAX_INDIVIDUAL_FILE_SIZE_FOR_REPO_ANALYSIS * 2; // e.g., 100KB
  if (file.size && file.size > MAX_SIZE_FOR_SELECTED_FILE) {
    throw new Error(`File "${file.name}" is too large (${(file.size / 1024).toFixed(1)}KB) to fetch content. Limit for selected file is ${(MAX_SIZE_FOR_SELECTED_FILE / 1024).toFixed(1)}KB.`);
  }
  try {
    const response = await fetch(file.url, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
    if (!response.ok) throw new Error(`Failed to fetch file metadata from ${file.url}: ${response.status} ${response.statusText}`);
    
    const data: GithubRepoFile = await response.json();

    if (data.type !== 'file') throw new Error(`Expected a file but got type '${data.type}' for ${file.name}`);
    if (data.size && data.size > MAX_SIZE_FOR_SELECTED_FILE) {
        return `// File content for "${file.name}" (${(data.size / 1024).toFixed(1)}KB) not fetched as it exceeds the ${MAX_SIZE_FOR_SELECTED_FILE / 1024}KB limit.`;
    }

    if (data.content && data.encoding === 'base64') return Base64.decode(data.content);
    
    if (data.download_url) {
      const rawResponse = await fetch(data.download_url);
      if (!rawResponse.ok) throw new Error(`Failed to download raw file content from ${data.download_url}: ${rawResponse.status}`);
      const textContent = await rawResponse.text();
      // Check decoded size as well, approx. 1.5 times for safety with multibyte chars, or directly check length
      if (textContent.length > MAX_SIZE_FOR_SELECTED_FILE * 1.5) { 
          return `// File content for "${file.name}" was too large after fetching via download_url. Limit: ${MAX_SIZE_FOR_SELECTED_FILE / 1024}KB.`;
      }
      return textContent;
    }
    
    return `// No content found for ${file.name}. It might be an empty file or an issue with fetching.`;

  } catch (error) {
    console.error(`Error fetching file content for ${file.name}:`, error);
    if (error instanceof Error && error.message.includes("too large")) throw error; 
    throw new Error(`Could not retrieve content for ${file.name}.`);
  }
};


export const fetchAllFilesRecursive = async (
    owner: string, 
    repo: string
): Promise<GithubRepoFile[]> => {
  const allFiles: GithubRepoFile[] = [];
  let filesScannedCount = 0;

  const fetchPath = async (currentPath: string, depth: number) => {
    if (depth > REPO_ANALYSIS_MAX_DEPTH || filesScannedCount >= MAX_FILES_FOR_SEQUENTIAL_SCAN) {
      return;
    }

    let itemsAtPath: GithubRepoFile[];
    try {
      itemsAtPath = await fetchContents({ owner, repo, path: currentPath });
    } catch (error) {
      console.warn(`Could not fetch contents for path: ${currentPath}. ${error instanceof Error ? error.message : error}`);
      return;
    }
    
    for (const item of itemsAtPath) {
      if (filesScannedCount >= MAX_FILES_FOR_SEQUENTIAL_SCAN) break;
      
      filesScannedCount++; 
      
      if (item.type === 'file') {
        const extension = item.name.split('.').pop()?.toLowerCase();
        const isPotentiallyReviewable = (extension && FILE_EXTENSION_TO_LANGUAGE[extension]) || 
                                       item.name.toLowerCase().includes('readme') || 
                                       item.name.toLowerCase().includes('dockerfile') ||
                                       item.name.toLowerCase().includes('license') ||
                                       !item.name.includes('.'); 
        
        if (isPotentiallyReviewable) {
            // MAX_INDIVIDUAL_FILE_SIZE_FOR_REPO_ANALYSIS is used to skip adding very large files to the scan list
            if (!item.size || item.size <= MAX_INDIVIDUAL_FILE_SIZE_FOR_REPO_ANALYSIS) { 
                 allFiles.push(item);
            } else {
                console.log(`Skipping ${item.path} from sequential scan list as it's too large: ${item.size} bytes (Limit: ${MAX_INDIVIDUAL_FILE_SIZE_FOR_REPO_ANALYSIS})`);
            }
        }
      } else if (item.type === 'dir') {
        await fetchPath(item.path, depth + 1);
      }
    }
  };

  await fetchPath('', 0);
  
  if (filesScannedCount >= MAX_FILES_FOR_SEQUENTIAL_SCAN && allFiles.length < filesScannedCount) {
    console.warn(`Reached scan limit of ${MAX_FILES_FOR_SEQUENTIAL_SCAN} items, but collected ${allFiles.length} files for analysis. Some directories might not have been fully explored.`);
  }
  return allFiles.sort((a,b) => a.path.localeCompare(b.path)); // Sort the flat list for sequential analysis
};
