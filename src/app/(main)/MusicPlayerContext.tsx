"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface MusicRecommendation {
  songTitle: string;
  artist: string;
  url: string;
  reason: string;
  albumArt?: string;
}

interface MusicPlayerContextType {
  currentMusic: MusicRecommendation | null;
  musicQueue: MusicRecommendation[];
  isPlaying: boolean;
  setCurrentMusic: (music: MusicRecommendation | null) => void;
  setIsPlaying: (playing: boolean) => void;
  stopMusic: () => void;
  addToQueue: (music: MusicRecommendation) => void;
  playNext: () => void;
  requestNextSong: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(
  undefined
);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [currentMusic, setCurrentMusic] = useState<MusicRecommendation | null>(
    null
  );
  const [musicQueue, setMusicQueue] = useState<MusicRecommendation[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopMusic = () => {
    setCurrentMusic(null);
    setIsPlaying(false);
    setMusicQueue([]);
  };

  const addToQueue = (music: MusicRecommendation) => {
    setMusicQueue((prev) => [...prev, music]);
  };

  const playNext = () => {
    if (musicQueue.length > 0) {
      const [nextSong, ...rest] = musicQueue;
      setCurrentMusic(nextSong);
      setMusicQueue(rest);
      setIsPlaying(true);
    }
  };

  const requestNextSong = () => {};

  return (
    <MusicPlayerContext.Provider
      value={{
        currentMusic,
        musicQueue,
        isPlaying,
        setCurrentMusic,
        setIsPlaying,
        stopMusic,
        addToQueue,
        playNext,
        requestNextSong,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (context === undefined) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return context;
}
