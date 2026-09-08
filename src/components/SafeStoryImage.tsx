import React, { useState, useEffect } from "react";
import { StoryImagePlaceholder } from "./StoryImagePlaceholder";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

interface SafeStoryImageProps {
  src?: string | null;
  alt: string;
  title?: string;
  author?: string;
  category?: string;
  prompt?: string;
  className?: string;
  imageClassName?: string;
  size?: "sm" | "md" | "lg" | "cover";
  onPaintClick?: () => void;
  pageNumber?: number;
  overlayBadge?: React.ReactNode;
}

export const SafeStoryImage: React.FC<SafeStoryImageProps> = ({
  src,
  alt,
  title,
  author,
  category,
  prompt,
  className = "",
  imageClassName = "",
  size = "md",
  onPaintClick,
  pageNumber,
  overlayBadge,
}) => {
  const { isOnline } = useOnlineStatus();
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset error state if image source changes or when connection is restored
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src, isOnline]);

  const showPlaceholder = !src || hasError;

  if (showPlaceholder) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <StoryImagePlaceholder
          title={title || alt}
          author={author}
          category={category}
          prompt={prompt}
          size={size}
          isOffline={!isOnline}
          onPaintClick={onPaintClick}
          reason={!isOnline ? "offline" : !src ? "ungenerated" : "error"}
          pageNumber={pageNumber}
          className={imageClassName}
        />
        {overlayBadge && (
          <div className="absolute top-3 left-3 z-20">{overlayBadge}</div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Background placeholder while image is loading */}
      {isLoading && (
        <div className="absolute inset-0 bg-amber-50 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        </div>
      )}

      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        } ${imageClassName}`}
      />

      {overlayBadge && (
        <div className="absolute top-3 left-3 z-20">{overlayBadge}</div>
      )}
    </div>
  );
};
