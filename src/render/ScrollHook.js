import { secondsToPixels, pixelsToSeconds } from '../utils/conversions';

/*
* virtual-dom hook for scrolling the track container.
*/
export default class {
  constructor(playlist) {
    this.playlist = playlist;
  }

  hook(node) {
    const playlist = this.playlist;
    if (!playlist.isScrolling) {
      const el = node;

      if (playlist.isAutomaticScroll && playlist.isPlaying()) {
        const rect = node.getBoundingClientRect();
        const windowTime = pixelsToSeconds(
          rect.width,
          playlist.samplesPerPixel,
          playlist.sampleRate,
        );

        const MAX_SCROLL_LEFT = playlist.duration - windowTime;

        const cursorNode = node.querySelector('.cursor');
        if (cursorNode) {
          const cursorRect = cursorNode.getBoundingClientRect();

          if (cursorRect.right > rect.right || cursorRect.right < 0) {
            playlist.scrollLeft = Math.min(playlist.playbackSeconds, MAX_SCROLL_LEFT);
          }
        }
      }

      const left = secondsToPixels(
        playlist.scrollLeft,
        playlist.samplesPerPixel,
        playlist.sampleRate,
      );

      el.scrollLeft = left;
    }
  }
}
