import { useEffect, useRef, useState } from 'react';

const videoType = (src) => (src.endsWith('.webm') ? 'video/webm' : 'video/mp4');

/**
 * Muted preview video that downloads nothing but its WebP `poster` up front
 * (or, without a poster, just its metadata).
 * Plays while hovered on mouse devices (or its `hoverTarget` ancestor is),
 * and while on screen on touch devices; pauses otherwise.
 */
function LazyVideo({ src, poster, className, label, hoverTarget, frameAt = 1.5 }) {
  const ref = useRef(null);
  const [portrait, setPortrait] = useState(false);

  // With preload="none" metadata never arrives until playback, so read the orientation from the poster
  useEffect(() => {
    if (!poster) return;
    const img = new Image();
    img.onload = () => setPortrait(img.naturalHeight > img.naturalWidth);
    img.src = poster;
    return () => { img.onload = null; };
  }, [poster]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const play = () => video.play().catch(() => {});
    const pause = () => video.pause();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (finePointer) {
      const host = (hoverTarget && video.closest(hoverTarget)) || video;
      host.addEventListener('mouseenter', play);
      host.addEventListener('mouseleave', pause);
      return () => {
        host.removeEventListener('mouseenter', play);
        host.removeEventListener('mouseleave', pause);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? play() : pause()),
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [hoverTarget]);

  return (
    <video
      ref={ref}
      className={`${className ?? ''} ${portrait ? 'is-portrait' : ''}`}
      onLoadedMetadata={e => setPortrait(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
      muted
      loop
      playsInline
      preload={poster ? 'none' : 'metadata'}
      poster={poster}
      aria-label={label}
    >
      {/* #t= makes browsers paint a real frame (past any fade-in) instead of a black box */}
      <source src={`${src}#t=${frameAt}`} type={videoType(src)} />
    </video>
  );
}

export default LazyVideo;
