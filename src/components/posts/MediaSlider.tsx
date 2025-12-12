"use client";

import { Media } from "@prisma/client";
import Image from "next/image";
import { useState } from "react";

interface MediaSliderProps {
  attachments: Media[];
}

export default function MediaSlider({ attachments }: MediaSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!attachments.length) return null;

  const currentMedia = attachments[currentIndex];
  const hasMultiple = attachments.length > 1;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted/50">
      {/* Main Media Display */}
      <div className="relative flex aspect-video w-full items-center justify-center bg-black/5">
        {currentMedia.type === "IMAGE" ? (
          <Image
            src={currentMedia.url}
            alt={`Media ${currentIndex + 1}`}
            width={800}
            height={450}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : currentMedia.type === "VIDEO" ? (
          <video
            src={currentMedia.url}
            controls
            className="h-full w-full object-contain"
          />
        ) : null}
      </div>

      {/* Navigation Controls */}
      {hasMultiple && (
        <>
          {/* Left Arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-2xl font-bold text-white transition-colors hover:bg-black/70"
            aria-label="Previous media"
          >
            ←
          </button>

          {/* Right Arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-2xl font-bold text-white transition-colors hover:bg-black/70"
            aria-label="Next media"
          >
            →
          </button>

          {/* Counter */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white">
            {currentIndex + 1}/{attachments.length}
          </div>
        </>
      )}
    </div>
  );
}
