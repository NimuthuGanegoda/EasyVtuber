import { useEffect, useState } from 'react';

export interface Contributor {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  role?: string;
  emoji?: string;
}

/**
 * Real GitHub avatars (`github.com/<user>.png` → avatars.githubusercontent.com)
 * instead of generated DiceBear placeholders, so the fallback list looks like
 * the people and projects it names. Both hosts are allowed by the CSP in
 * index.html.
 */
function githubAvatar(profileUrl: string, size = 96): string {
  const match = /github\.com\/([^/?#]+)/.exec(profileUrl);
  return match ? `https://github.com/${match[1]}.png?size=${size}` : '';
}

const FALLBACK_CONTRIBUTORS: Contributor[] = (
  [
    {
      login: 'NimuthuGanegoda',
      name: 'Nimuthu',
      html_url: 'https://github.com/NimuthuGanegoda',
      contributions: 42,
      role: 'Re-Engineering & Enhancement',
      emoji: '⚡',
    },
    {
      login: 'pramook',
      name: 'Pramook Khungurn',
      html_url: 'https://github.com/pkhungurn',
      contributions: 1,
      role: 'Talking Head Anime 4 Engine',
      emoji: '🎭',
    },
    {
      login: 'gunwoohan',
      name: 'GunwooHan',
      html_url: 'https://github.com/GunwooHan',
      contributions: 1,
      role: 'Desktop Re-Engineering',
      emoji: '🖥️',
    },
    {
      login: 'mediapipe',
      name: 'MediaPipe',
      html_url: 'https://github.com/google-ai-edge/mediapipe',
      contributions: 0,
      role: 'Face Tracking (Google)',
      emoji: '👁️',
    },
    {
      login: 'pixiv',
      name: 'three-vrm',
      html_url: 'https://github.com/pixiv/three-vrm',
      contributions: 0,
      role: 'VRM Avatar Rendering',
      emoji: '🧍',
    },
    {
      login: 'zpeng11',
      name: 'zpeng11',
      html_url: 'https://github.com/zpeng11/ezvtuber-rt',
      contributions: 0,
      role: 'ezvtuber-rt Runtime',
      emoji: '📊',
    },
  ] satisfies Omit<Contributor, 'avatar_url'>[]
).map((c) => ({ ...c, avatar_url: githubAvatar(c.html_url) }));

export const FALLBACK_COUNT = FALLBACK_CONTRIBUTORS.length;

interface UseContributorsResult {
  contributors: Contributor[];
  loading: boolean;
  error: string | null;
  /** True when the list shown came from the local cache (or the built-in list). */
  fromCache: boolean;
}

const CACHE_KEY = 'easyvtuber.contributors.v1';
/** Unauthenticated api.github.com allows 60 requests/hour/IP — cache hard. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

interface CachePayload {
  savedAt: number;
  repo: string;
  contributors: Contributor[];
}

function readCache(repo: string): CachePayload | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload | null;
    if (!parsed || parsed.repo !== repo || !Array.isArray(parsed.contributors)) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(repo: string, contributors: Contributor[]): void {
  try {
    if (typeof window === 'undefined') return;
    const payload: CachePayload = { savedAt: Date.now(), repo, contributors };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full/disabled — caching is best-effort.
  }
}

export function useContributors(repo = 'NimuthuGanegoda/EasyVtuber'): UseContributorsResult {
  const [contributors, setContributors] = useState<Contributor[]>(FALLBACK_CONTRIBUTORS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const cached = readCache(repo);
    if (cached) {
      setContributors(cached.contributors);
      setFromCache(true);
      setLoading(false);
    }

    async function fetchContributors() {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repo}/contributors?per_page=20`,
          {
            headers: { Accept: 'application/vnd.github.v3+json' },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'GitHub API rate limit reached — showing cached contributors.'
              : `GitHub API returned ${response.status}`,
          );
        }

        const data: Array<{
          login: string;
          avatar_url: string;
          html_url: string;
          contributions: number;
        }> = await response.json();

        if (cancelled) return;

        if (!Array.isArray(data) || data.length === 0) {
          setLoading(false);
          return;
        }

        // Merge GitHub data with our known roles/emojis
        const updated = data.map((gh): Contributor => {
          const existing = FALLBACK_CONTRIBUTORS.find(
            (fb) => fb.login.toLowerCase() === gh.login.toLowerCase(),
          );
          return {
            login: gh.login,
            name: existing?.name || gh.login,
            avatar_url: gh.avatar_url,
            html_url: gh.html_url,
            contributions: gh.contributions,
            role: existing?.role || 'Contributor',
            emoji: existing?.emoji || '💜',
          };
        });

        setContributors(updated);
        setError(null);
        setFromCache(false);
        writeCache(repo, updated);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? `GitHub API timed out after ${FETCH_TIMEOUT_MS / 1000}s — showing cached contributors.`
            : err instanceof Error
              ? err.message
              : String(err);
        setError(message);
        if (!cached) {
          setContributors(FALLBACK_CONTRIBUTORS);
          setFromCache(true);
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    }

    void fetchContributors();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [repo]);

  return { contributors, loading, error, fromCache };
}
