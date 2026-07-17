import { useState, useEffect } from 'react';

export interface Contributor {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  role?: string;
  emoji?: string;
}

const FALLBACK_CONTRIBUTORS: Contributor[] = [
  {
    login: 'NimuthuGanegoda',
    name: 'Nimuthu',
    avatar_url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Nimuthu&backgroundColor=ffb7c5',
    html_url: 'https://github.com/NimuthuGanegoda',
    contributions: 42,
    role: 'Re-Engineering & Enhancement',
    emoji: '⚡',
  },
  {
    login: 'pramook',
    name: 'Pramook Khungurn',
    avatar_url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Pramook&backgroundColor=e0c3fc',
    html_url: 'https://github.com/pkhungurn',
    contributions: 1,
    role: 'Talking Head Anime 4 Engine',
    emoji: '🎭',
  },
  {
    login: 'gunwoohan',
    name: 'GunwooHan',
    avatar_url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=GunwooHan&backgroundColor=c9a9e8',
    html_url: 'https://github.com/GunwooHan',
    contributions: 1,
    role: 'Desktop Re-Engineering',
    emoji: '🖥️',
  },
  {
    login: 'mediapipe',
    name: 'MediaPipe',
    avatar_url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=MediaPipe&backgroundColor=a8d8ea',
    html_url: 'https://github.com/google/mediapipe',
    contributions: 0,
    role: 'Face Tracking (Google)',
    emoji: '👁️',
  },
  {
    login: 'tensorflow',
    name: 'TensorFlow.js',
    avatar_url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=TensorFlow&backgroundColor=ffd3b6',
    html_url: 'https://github.com/tensorflow/tfjs',
    contributions: 0,
    role: 'Inference Engine',
    emoji: '🧠',
  },
  {
    login: 'graphify',
    name: 'Graphify Labs',
    avatar_url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Graphify&backgroundColor=d4a5a5',
    html_url: 'https://github.com/Graphify-Labs',
    contributions: 0,
    role: 'Code Graph Analysis',
    emoji: '📊',
  },
];

export const FALLBACK_COUNT = FALLBACK_CONTRIBUTORS.length;

interface UseContributorsResult {
  contributors: Contributor[];
  loading: boolean;
  error: string | null;
}

export function useContributors(repo = 'NimuthuGanegoda/EasyVtuber'): UseContributorsResult {
  const [contributors, setContributors] = useState<Contributor[]>(FALLBACK_CONTRIBUTORS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchContributors() {
      try {
        setLoading(true);

        const response = await fetch(
          `https://api.github.com/repos/${repo}/contributors?per_page=20`,
          {
            headers: {
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`GitHub API returned ${response.status}`);
        }

        const data: Array<{
          login: string;
          avatar_url: string;
          html_url: string;
          contributions: number;
        }> = await response.json();

        if (cancelled) return;

        if (data.length === 0) {
          setContributors(FALLBACK_CONTRIBUTORS);
          setLoading(false);
          return;
        }

        // Merge GitHub data with our fallback roles/emojis
        const updated = data.map((gh) => {
          const existing = FALLBACK_CONTRIBUTORS.find(
            (fb) => fb.login.toLowerCase() === gh.login.toLowerCase()
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
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // Rate-limited or network issue — use fallback
        setError(message);
        setContributors(FALLBACK_CONTRIBUTORS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContributors();

    return () => {
      cancelled = true;
    };
  }, [repo]);

  return { contributors, loading, error };
}
