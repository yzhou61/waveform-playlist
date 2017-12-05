import h from 'virtual-dom/h';

import inputAeneas from './input/aeneas';
import outputAeneas from './output/aeneas';
import { secondsToPixels } from '../utils/conversions';
import DragInteraction from '../interaction/DragInteraction';
import ScrollTopHook from './render/ScrollTopHook';
import timeformat from '../utils/timeformat';

class AnnotationList {
  constructor(playlist, annotations, controls = [], editable = false,
    linkEndpoints = false, isContinuousPlay = false) {
    this.playlist = playlist;
    this.resizeHandlers = [];
    this.editable = editable;
    this.timeFormatter = timeformat(this.playlist.durationFormat);
    this.playlist.annotations = annotations.map((a) => {
      // TODO support different formats later on.
      const note = inputAeneas(a);
      return this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
    });
    this.setupInteractions();

    this.controls = controls;
    this.setupEE(playlist.ee);

    // TODO actually make a real plugin system that's not terrible.
    this.playlist.isContinuousPlay = isContinuousPlay;
    this.playlist.linkEndpoints = linkEndpoints;
    this.playlist.updateAnnotation = this.updateAnnotation.bind(this);
  }

  updateAnnotation(id, start, end, lines, lang) {
    const samplesPerPixel = this.playlist.samplesPerPixel;
    const sampleRate = this.playlist.sampleRate;
    const pixPerSec = sampleRate / samplesPerPixel;
    const pixOffset = secondsToPixels(this.playlist.scrollLeft, samplesPerPixel, sampleRate);
    const left = Math.floor((start * pixPerSec) - pixOffset);
    const width = Math.ceil((end * pixPerSec) - (start * pixPerSec));

    return {
      id,
      start,
      end,
      lines,
      lang,
      left,
      width,
      displayStart: this.timeFormatter(start),
      displayEnd: this.timeFormatter(end)
    }
  }

  setupInteractions() {
    this.playlist.annotations.forEach((a, i) => {
      const leftShift = new DragInteraction(this.playlist, {
        direction: 'left',
        index: i,
      });
      const rightShift = new DragInteraction(this.playlist, {
        direction: 'right',
        index: i,
      });

      this.resizeHandlers.push(leftShift);
      this.resizeHandlers.push(rightShift);
    });
  }

  emitAnnotationChange(note, index) {
    this.playlist.ee.emit('annotationchange', note, index, this.playlist.annotations, {
      linkEndpoints: this.playlist.linkEndpoints,
    });
  }

  setupEE(ee) {
    ee.on('dragged', (deltaTime, data) => {
      const annotationIndex = data.index;
      const annotations = this.playlist.annotations;
      let note = annotations[annotationIndex];

      // resizing to the left
      if (data.direction === 'left') {
        const originalVal = note.start;
        note.start += deltaTime;

        if (note.start < 0) {
          note.start = 0;
        }

        annotations[annotationIndex] = this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
        this.emitAnnotationChange(annotations[annotationIndex], annotationIndex);

        if (annotationIndex &&
          (annotations[annotationIndex - 1].end > annotations[annotationIndex].start)) {
          annotations[annotationIndex - 1].end = annotations[annotationIndex].start;

          let note = annotations[annotationIndex - 1];
          annotations[annotationIndex - 1] = this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
          this.emitAnnotationChange(annotations[annotationIndex - 1], annotationIndex - 1);
        }

        if (this.playlist.linkEndpoints &&
          annotationIndex &&
          (annotations[annotationIndex - 1].end === originalVal)) {
          annotations[annotationIndex - 1].end = annotations[annotationIndex].start;

          let note = annotations[annotationIndex - 1];
          annotations[annotationIndex - 1] = this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
          this.emitAnnotationChange(annotations[annotationIndex - 1], annotationIndex - 1);
        }
      } else {
        // resizing to the right
        const originalVal = note.end;
        note.end += deltaTime;

        if (note.end > this.playlist.duration) {
          note.end = this.playlist.duration;
        }

        annotations[annotationIndex] = this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
        this.emitAnnotationChange(annotations[annotationIndex], annotationIndex);

        if (annotationIndex < (annotations.length - 1) &&
          (annotations[annotationIndex + 1].start < annotations[annotationIndex].end)) {
          annotations[annotationIndex + 1].start = annotations[annotationIndex].end;

          let note = annotations[annotationIndex + 1];
          annotations[annotationIndex + 1] = this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
          this.emitAnnotationChange(annotations[annotationIndex + 1], annotationIndex + 1);
        }

        if (this.playlist.linkEndpoints &&
          (annotationIndex < (annotations.length - 1)) &&
          (annotations[annotationIndex + 1].start === originalVal)) {
          annotations[annotationIndex + 1].start = annotations[annotationIndex].end;

          let note = annotations[annotationIndex + 1];
          annotations[annotationIndex + 1] = this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
          this.emitAnnotationChange(annotations[annotationIndex + 1], annotationIndex + 1);
        }
      }

      this.playlist.drawRequest();
    });

    ee.on('continuousplay', (val) => {
      this.playlist.isContinuousPlay = val;
    });

    ee.on('linkendpoints', (val) => {
      this.playlist.linkEndpoints = val;
    });

    ee.on('annotationsrequest', () => {
      this.export();
    });

    ee.on('scroll', () => {
      this.playlist.annotations = this.playlist.annotations.map((note) => {
        return this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
      });
      this.playlist.drawRequest();
    });

    return ee;
  }

  export() {
    const output = this.playlist.annotations.map(a => outputAeneas(a));
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(output))}`;
    const a = document.createElement('a');

    document.body.appendChild(a);
    a.href = dataStr;
    a.download = 'annotations.json';
    a.click();
    document.body.removeChild(a);
  }

  renderResizeLeft(i) {
    const events = DragInteraction.getEvents();
    const config = { attributes: {
      style: 'position: absolute; height: 30px; width: 10px; top: 0; left: -2px',
      draggable: true,
    } };
    const handler = this.resizeHandlers[i * 2];

    // events.forEach((event) => {
    //   config[`on${event}`] = handler[event].bind(handler);
    // });

    return h('div.resize-handle.resize-w', config);
  }

  renderResizeRight(i) {
    const events = DragInteraction.getEvents();
    const config = { attributes: {
      style: 'position: absolute; height: 30px; width: 10px; top: 0; right: -2px',
      draggable: true,
    } };
    const handler = this.resizeHandlers[(i * 2) + 1];

    // events.forEach((event) => {
    //   config[`on${event}`] = handler[event].bind(handler);
    // });

    return h('div.resize-handle.resize-e', config);
  }

  render() {
    const boxes = h('div.annotations-boxes',
      {
        attributes: {
          style: 'height: 30px; overflow: hidden; position: relative;',
        },
      },
      this.playlist.annotations.map((note, i) => {
        return h('div.annotation-box',
          {
            attributes: {
              style: `position: absolute; height: 30px; width: ${note.width}px; left: ${note.left}px`,
              'data-id': note.id,
            },
          },
          [
            h('div.resize-handle.resize-w',
              {
                attributes: {
                  style: 'position: absolute; height: 30px; width: 10px; top: 0; left: -2px',
                  draggable: true,
                }
              }
            ),
            h('span.id',
              {
                onclick: () => {
                  if (this.playlist.isContinuousPlay) {
                    this.playlist.ee.emit('play', this.playlist.annotations[i].start);
                  } else {
                    this.playlist.ee.emit('play', this.playlist.annotations[i].start, this.playlist.annotations[i].end);
                  }
                },
              },
              [
                note.id,
              ],
            ),
            h('div.resize-handle.resize-e',
              {
                attributes: {
                  style: 'position: absolute; height: 30px; width: 10px; top: 0; right: -2px',
                  draggable: true,
                }
              }
            ),
          ],
        );
      }),
    );

    const text = h('div.annotations-text',
      {
        hook: new ScrollTopHook(),
        onclick: (e) => {
          const el = e.target;
          if (el.classList.contains('anno-ctrl')) {
            const annotationIndex = parseInt(el.dataset.annotation, 10);
            const ctrl = parseInt(el.dataset.ctrl, 10);
            const annotations = this.playlist.annotations;
            this.controls[ctrl].action.call(this.playlist, annotations[annotationIndex], annotationIndex, annotations, {
              linkEndpoints: this.playlist.linkEndpoints,
            });
            // TODO don't totally redo these.
            this.setupInteractions();
            this.playlist.drawRequest();
          }
        },
      },
      this.playlist.annotations.map((note, i, annotations) => {
        let segmentClass = '';
        if (this.playlist.isPlaying() &&
          (this.playlist.playbackSeconds >= note.start) &&
          (this.playlist.playbackSeconds <= note.end)) {
          segmentClass = '.current';
        }

        const editableConfig = {
          attributes: {
            contenteditable: true,
          },
          oninput: (e) => {
            // needed currently for references
            // eslint-disable-next-line no-param-reassign
            note.lines = e.target.innerText.split('\n');
            this.playlist.ee.emit('annotationchange', note, i, annotations, {
              linkEndpoints: this.playlist.linkEndpoints,
            });
          },
          onkeypress: (e) => {
            if (e.which === 13 || e.keyCode === 13) {
              e.target.blur();
              e.preventDefault();
            }
          },
        };

        const linesConfig = this.editable ? editableConfig : {};

        return h(`div.annotation${segmentClass}`,
          [
            h('span.annotation-id', [
              note.id,
            ]),
            h('span.annotation-start', [
              note.displayStart,
            ]),
            h('span.annotation-end', [
              note.displayEnd,
            ]),
            h('span.annotation-lines',
              linesConfig,
              [
                note.lines.join('\n'),
              ],
            ),
            h('span.annotation-actions',
              this.controls.map((ctrl, ctrlIndex) =>
                h(`i.${ctrl.class}.anno-ctrl`, {
                  attributes: {
                    title: ctrl.title,
                    'data-ctrl': ctrlIndex,
                    'data-annotation': i,
                  },
                  // onclick: () => {
                  //   ctrl.action(note, i, annotations, {
                  //     linkEndpoints: this.playlist.linkEndpoints,
                  //   });
                  //   // TODO don't totally redo these.
                  //   this.setupInteractions();
                  //   this.playlist.drawRequest();
                  // },
                }),
              ),
            ),
          ],
        );
      }),
    );

    return [
      boxes,
      text,
    ];
  }
}

export default AnnotationList;
