"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMusicPlayer } from "./MusicPlayerContext";
import { Pause, Play, Volume2, X } from "lucide-react";
import Image from "next/image";
import kyInstance from "@/lib/ky";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function GlobalMusicPlayer() {
  const { currentMusic, isPlaying, setIsPlaying, stopMusic, setCurrentMusic } =
    useMusicPlayer();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const requestNewSong = useCallback(async () => {
    try {
      const res = await kyInstance
        .post("/api/recommend-music", {
          json: { emotion: null, emotionScore: null },
        })
        .json<any>();

      setCurrentMusic(res);
      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to load next song");
    }
  }, [setCurrentMusic, setIsPlaying]);

  const handleEnded = () => {
    requestNewSong();
  };

  const handlePlayPause = () => {
    if (
      playerRef.current &&
      typeof playerRef.current.playVideo === "function"
    ) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleClose = () => {
    if (
      playerRef.current &&
      typeof playerRef.current.stopVideo === "function"
    ) {
      playerRef.current.stopVideo();
    }
    stopMusic();
  };

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize player when video changes
  useEffect(() => {
    if (!currentMusic) return;

    const videoId =
      currentMusic.url.split("v=")[1]?.split("&")[0] ||
      currentMusic.url.split("/").pop();
    if (!videoId) return;

    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        // Destroy existing player
        if (playerRef.current) {
          playerRef.current.destroy();
        }

        // Create new player
        playerRef.current = new window.YT.Player("youtube-player", {
          height: "1",
          width: "1",
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            fs: 0,
            iv_load_policy: 3,
            loop: 1,
            playlist: videoId,
          },
          events: {
            onReady: (event: any) => {
              playerRef.current = event.target;
              if (isPlaying) {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              // Auto-play next song when current ends
              if (event.data === window.YT.PlayerState.ENDED) {
                handleEnded();
              }
            },
          },
        });
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMusic?.url]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.playVideo !== "function")
      return;

    if (isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  if (!currentMusic) return null;

  const videoId =
    currentMusic.url.split("v=")[1]?.split("&")[0] ||
    currentMusic.url.split("/").pop();

  return (
    <>
      {/* Hidden YouTube player container */}
      {videoId && (
        <div
          ref={containerRef}
          className="pointer-events-none fixed left-0 top-0 -z-50 h-[1px] w-[1px] overflow-hidden opacity-0"
        >
          <div id="youtube-player"></div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-gradient-to-r from-zinc-900 to-zinc-800 shadow-2xl">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {currentMusic.albumArt ? (
                <Image
                  src={currentMusic.albumArt}
                  alt={currentMusic.songTitle}
                  width={56}
                  height={56}
                  className="h-14 w-14 flex-shrink-0 rounded object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget
                      .nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-zinc-700"
                style={{ display: currentMusic.albumArt ? "none" : "flex" }}
              >
                <Volume2 className="h-6 w-6 text-zinc-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold text-white">
                  {currentMusic.songTitle}
                </h4>
                <p className="truncate text-xs text-zinc-400">
                  {currentMusic.artist}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500 opacity-90">
                  {currentMusic.reason}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayPause}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="ml-1 h-6 w-6" />
                )}
              </button>

              <button
                onClick={handleClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
