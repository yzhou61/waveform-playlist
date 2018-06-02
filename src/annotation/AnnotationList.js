import h from 'virtual-dom/h';
import Thunk from 'vdom-thunk';

import inputAeneas from './input/aeneas';
import outputAeneas from './output/aeneas';
import { secondsToPixels, pixelsToSeconds } from '../utils/conversions';
import ScrollTopHook from './render/ScrollTopHook';
import ContentEditableHook from './render/ContentEditableHook';
import timeformat from '../utils/timeformat';

class AnnotationList {
  constructor(playlist, annotations, controls = [], editable = false,
    linkEndpoints = false, isContinuousPlay = false) {
    this.playlist = playlist;
    this.editable = editable;
    this.timeFormatter = timeformat(this.playlist.durationFormat);
    this.playlist.annotations = annotations.map((a) => {
      // TODO support different formats later on.
      const note = inputAeneas(a);
      return this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
    });
    this.controls = controls;
    this.setupEE(playlist.ee);

    // TODO actually make a real plugin system that's not terrible.
    this.playlist.isContinuousPlay = isContinuousPlay;
    this.playlist.linkEndpoints = linkEndpoints;
    this.playlist.updateAnnotation = this.updateAnnotation.bind(this);

    this.prevX = 0;
    this.dragging = false;

    this.onAnnotationBoxClick = this.onAnnotationBoxClick.bind(this);
    this.onAnnotationBoxDragStart = this.onAnnotationBoxDragStart.bind(this);
    this.onAnnotationBoxDragEnd = this.onAnnotationBoxDragEnd.bind(this);
    this.onAnnotationTextClick = this.onAnnotationTextClick.bind(this);
    this.onAnnotationTextInput = this.onAnnotationTextInput.bind(this);
    this.ondragover = this.ondragover.bind(this);
    this.renderBoxes = this.renderBoxes.bind(this);
    this.renderList = this.renderList.bind(this);

    this.listState = {
      annotations: this.playlist.annotations,
      current: undefined,
    };

    // TODO remove this event.
    document.addEventListener('dragover', this.ondragover);
  }

  updateAnnotation(id, start, end, lines, lang) {
    const samplesPerPixel = this.playlist.samplesPerPixel;
    const sampleRate = this.playlist.sampleRate;
    const pixPerSec = sampleRate / samplesPerPixel;
    const left = Math.floor(start * pixPerSec);
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

  emitAnnotationChange(note, index) {
    this.playlist.ee.emit('annotationchange', note, index, this.playlist.annotations, {
      linkEndpoints: this.playlist.linkEndpoints,
    });
  }

  setupEE(ee) {
    ee.on('dragged', (deltaTime, annotationIndex, direction) => {
      const annotations = this.playlist.annotations;
      let note = annotations[annotationIndex];

      // resizing to the left
      if (direction === 'left') {
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

      this.touchAnnotations();
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

    ee.on('durationformat', (format) => {
      this.timeFormatter = timeformat(format);
      this.playlist.annotations = this.playlist.annotations.map((note) => {
        return this.updateAnnotation(note.id, note.start, note.end, note.lines, note.lang);
      });
      this.playlist.drawRequest();
    });

    return ee;
  }

  touchAnnotations(annotations) {
    if (annotations) {
      this.playlist.annotations = annotations;
    } else {
      this.playlist.annotations = this.playlist.annotations.slice();
    }

    this.listState = {
      annotations: this.playlist.annotations,
      current: this.listState.current,
    };
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

  ondragover(e) {
    if (this.dragging) {
      const x = e.clientX;
      const deltaX = x - this.prevX;

      // emit shift event if not 0
      if (deltaX) {
        const deltaTime = pixelsToSeconds(
          deltaX,
          this.playlist.samplesPerPixel,
          this.playlist.sampleRate,
        );
        this.prevX = x;
        this.playlist.ee.emit('dragged', deltaTime, this.draggingIndex, this.draggingDirection);
      }
    }
  }

  onAnnotationBoxClick(e) {
    const el = e.target;
    if (el.classList.contains('id')) {
      const i = parseInt(el.parentNode.dataset.index, 10);
      if (this.playlist.isContinuousPlay) {
        this.playlist.ee.emit('play', this.playlist.annotations[i].start);
      } else {
        this.playlist.ee.emit('play', this.playlist.annotations[i].start, this.playlist.annotations[i].end);
      }
    }
  }

  onAnnotationBoxDragStart(e) {
    const el = e.target;
    const index = parseInt(e.target.parentNode.dataset.index, 10);
    const direction = e.target.dataset.direction;
    if (el.classList.contains('resize-handle')) {
      this.prevX = e.clientX;

      e.dataTransfer.dropEffect = 'move';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      this.dragging = true;
      this.draggingIndex = index;
      this.draggingDirection = direction;
    }
  }

  onAnnotationBoxDragEnd(e) {
    const el = e.target;
    if (el.classList.contains('resize-handle')) {
      e.preventDefault();
      this.dragging = false;
    }
  }

  onAnnotationTextClick(e) {
    const el = e.target;
    if (el.classList.contains('anno-ctrl')) {
      const annotationIndex = parseInt(el.parentNode.parentNode.dataset.index, 10);
      const ctrl = parseInt(el.dataset.ctrl, 10);
      const annotations = this.playlist.annotations;
      const newAnnotations = this.controls[ctrl].action.call(this.playlist, annotations[annotationIndex], annotationIndex, annotations, {
        linkEndpoints: this.playlist.linkEndpoints,
      });

      if (annotations !== newAnnotations) {
        this.touchAnnotations(newAnnotations);
      }
      this.playlist.drawRequest();
    }
  }

  onAnnotationTextInput(e) {
    const el = e.target;
    const annotationIndex = parseInt(el.parentNode.dataset.index, 10);
    const annotations = this.playlist.annotations;
    const note = annotations[annotationIndex];
    const lines = e.target.innerText.trim().split('\n');

    annotations[annotationIndex] = this.updateAnnotation(note.id, note.start, note.end, lines, note.lang);
    this.playlist.ee.emit('annotationchange', annotations[annotationIndex], annotationIndex, annotations, {
      linkEndpoints: this.playlist.linkEndpoints,
    });
  }

  renderBoxes() {
    return h('div.annotations-boxes',
      {
        attributes: {
          style: 'height: 30px; position: relative;',
        },
        onclick: this.onAnnotationBoxClick,
        ondragstart: this.onAnnotationBoxDragStart,
        ondragend: this.onAnnotationBoxDragEnd,
      },
      h('div.annotations-boxes-container',
        {
          attributes: {
            style: 'position: absolute; width: 100%; height: 100%;',
          },
        },
        this.playlist.annotations.map((note, i) => {
          return h('div.annotation-box',
            {
              attributes: {
                style: `position: absolute; height: 30px; width: ${note.width}px; left: ${note.left}px`,
                'data-index': i,
              },
            },
            [
              h('div.resize-handle.resize-w',
                {
                  attributes: {
                    style: 'position: absolute; height: 30px; width: 10px; top: 0; left: -2px',
                    draggable: true,
                    'data-direction': 'left',
                  }
                }
              ),
              h('span.id',
                [
                  note.id,
                ],
              ),
              h('div.resize-handle.resize-e',
                {
                  attributes: {
                    style: 'position: absolute; height: 30px; width: 10px; top: 0; right: -2px',
                    draggable: true,
                    'data-direction': 'right',
                  }
                }
              ),
            ],
          );
        }),
      ),
    );
  }

  renderList() {
    // TODO fix function reference.
    return h('div.annotations-text',
      {
        hook: new ScrollTopHook(),
        onclick: this.onAnnotationTextClick,
        oninput: this.onAnnotationTextInput,
      },
      this.playlist.annotations.map((note, i, annotations) => {
        let segmentClass = '';
        if (this.playlist.isPlaying() &&
          (this.playlist.playbackSeconds >= note.start) &&
          (this.playlist.playbackSeconds <= note.end)) {
          segmentClass = '.current';
        }

        return h(`div.annotation${segmentClass}`,
          {
            attributes: {
              'data-index': i,
            },
          },
          [
            h('span.annotation-id', [
              note.id,
            ]),
            h('span.annotation-times', [
              h('span.annotation-start', [
                note.displayStart,
              ]),
              h('span.annotation-end', [
                note.displayEnd,
              ]),
            ]),
            h('span.annotation-lines',
              {
                attributes: {
                  contenteditable: this.editable ? true : false,
                },
                hook: new ContentEditableHook(note.lines.join('\n')),
              },
            ),
            h('span.annotation-actions',
              this.controls.map((ctrl, ctrlIndex) =>
                h(`i.${ctrl.class}.anno-ctrl`, {
                  attributes: {
                    title: ctrl.title,
                    'data-ctrl': ctrlIndex,
                  },
                }),
              ),
            ),
          ],
        );
      }),
    );
  }

  render() {
    const samplesPerPixel = this.playlist.samplesPerPixel;
    const sampleRate = this.playlist.sampleRate;

    let current;
    // find current annotation
    if (this.playlist.isPlaying()) {
      current = this.playlist.annotations.filter((note) => {
        return (this.playlist.playbackSeconds >= note.start) &&
                (this.playlist.playbackSeconds <= note.end);
      });
      current = current[0];
    }

    // only need to update if annotations or current annotation has changed.
    if (this.listState.current !== current) {
      this.listState = {
        annotations: this.playlist.annotations,
        current,
      }
    }

    const boxes = Thunk(this.renderBoxes, this.playlist.annotations);
    const text = Thunk(this.renderList, this.listState);

    return [
      boxes,
      text,
    ];
  }
}

export default AnnotationList;
