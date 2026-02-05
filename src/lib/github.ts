export interface GitHubUser {
    login: string;
    avatar_url: string;
    html_url: string;
}

export interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    description: string;
    owner: GitHubUser;
    html_url: string;
    latest_release_tag?: string;
    stargazers_count: number;
}

export interface GitHubAsset {
    id: number;
    name: string;
    size: number;
    browser_download_url: string;
}

export interface GitHubRelease {
    id: number;
    tag_name: string;
    name: string;
    body: string;
    prerelease: boolean;
    assets: GitHubAsset[];
    published_at: string;
}

export class GitHubService {
    private token?: string;
    private cache: Map<string, any> = new Map();

    constructor(token?: string) {
        this.token = token;
    }

    private async fetch(url: string) {
        if (this.cache.has(url)) return this.cache.get(url);

        const headers: HeadersInit = {
            'Accept': 'application/vnd.github.v3+json'
        };
        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);

        const data = await res.json();
        this.cache.set(url, data);
        return data;
    }

    async getRepo(fullName: string): Promise<GitHubRepo> {
        return this.fetch(`https://api.github.com/repos/${fullName}`);
    }

    async getReleases(fullName: string): Promise<GitHubRelease[]> {
        return this.fetch(`https://api.github.com/repos/${fullName}/releases`);
    }

    async getLatestRelease(fullName: string): Promise<GitHubRelease> {
        return this.fetch(`https://api.github.com/repos/${fullName}/releases/latest`);
    }
}
