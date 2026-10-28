import { useEffect, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import type { NewsCategory } from '../config/newsCategories.ts';

const fallbackImageByCategory: Record<NewsCategory, string> = {
  Politics: '/potics.webp',
  Sports: '/sports.jpeg',
  Entertainment: '/entertainment.avif',
  Technology: '/tech.webp',
};

type NewsImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string;
  category: NewsCategory;
  onFallbackApplied?: () => void;
  onImageError?: (image: HTMLImageElement) => void;
};

function NewsImage({
  src,
  category,
  onFallbackApplied,
  onImageError,
  ...imageProps
}: NewsImageProps) {
  const fallbackImage = fallbackImageByCategory[category];
  const [imageSource, setImageSource] = useState(src || fallbackImage);
  const [showingFallback, setShowingFallback] = useState(!src);

  useEffect(() => {
    setImageSource(src || fallbackImage);
    setShowingFallback(!src);
  }, [src, fallbackImage]);

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    if (!showingFallback) {
      setImageSource(fallbackImage);
      setShowingFallback(true);
      onFallbackApplied?.();
      return;
    }

    event.currentTarget.hidden = true;
    onImageError?.(event.currentTarget);
  }

  return <img {...imageProps} src={imageSource} onError={handleImageError} />;
}

export default NewsImage;
