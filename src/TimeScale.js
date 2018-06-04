import h from 'virtual-dom/h';
import Thunk from 'vdom-thunk';

import { secondsToPixels } from './utils/conversions';
import TimeScaleHook from './render/TimeScaleHook';

const TIME_INFO = {
  20000: {
    marker: 30000,
    bigStep: 10000,
    smallStep: 5000,
    secondStep: 5,
  },
  12000: {
    marker: 15000,
    bigStep: 5000,
    smallStep: 1000,
    secondStep: 1,
  },
  10000: {
    marker: 10000,
    bigStep: 5000,
    smallStep: 1000,
    secondStep: 1,
  },
  5000: {
    marker: 5000,
    bigStep: 1000,
    smallStep: 500,
    secondStep: 1 / 2,
  },
  2500: {
    marker: 2000,
    bigStep: 1000,
    smallStep: 500,
    secondStep: 1 / 2,
  },
  1500: {
    marker: 2000,
    bigStep: 1000,
    smallStep: 200,
    secondStep: 1 / 5,
  },
  700: {
    marker: 1000,
    bigStep: 500,
    smallStep: 100,
    secondStep: 1 / 10,
  },
};

let currentState = {};

function getScaleInfo(resolution) {
  let keys = Object.keys(TIME_INFO).map(item => parseInt(item, 10));

  // make sure keys are numerically sorted.
  keys = keys.sort((a, b) => a - b);

  for (let i = 0; i < keys.length; i += 1) {
    if (resolution <= keys[i]) {
      return TIME_INFO[keys[i]];
    }
  }

  return TIME_INFO[keys[0]];
}

function formatTime(milliseconds) {
  const seconds = milliseconds / 1000;
  let s = seconds % 60;
  const m = (seconds - s) / 60;

  if (s < 10) {
    s = `0${s}`;
  }

  return `${m}:${s}`;
}

function timescale(state) {
  const {duration, samplesPerPixel, sampleRate, controlWidth, color} = state;

  const widthX = secondsToPixels(duration, samplesPerPixel, sampleRate);
  const pixPerSec = sampleRate / samplesPerPixel;
  const scaleInfo = getScaleInfo(samplesPerPixel);
  const canvasInfo = {};
  const timeMarkers = [];
  let counter = 0;

  for (let i = 0; i < widthX; i += (pixPerSec * scaleInfo.secondStep)) {
    const pix = Math.floor(i);

    // put a timestamp every 30 seconds.
    if (scaleInfo.marker && (counter % scaleInfo.marker === 0)) {
      timeMarkers.push(h('div.time',
        {
          attributes: {
            style: `left: ${pix}px;`,
          },
        },
        [formatTime(counter)],
      ));

      canvasInfo[pix] = 10;
    } else if (scaleInfo.bigStep && (counter % scaleInfo.bigStep === 0)) {
      canvasInfo[pix] = 5;
    } else if (scaleInfo.smallStep && (counter % scaleInfo.smallStep === 0)) {
      canvasInfo[pix] = 2;
    }

    counter += (1000 * scaleInfo.secondStep);
  }

  return h('div.playlist-time-scale',
    {
      attributes: {
        style: `margin-left: ${controlWidth}px;`,
      },
    },
    h('div.playlist-time-scale-scroll',
      [
        timeMarkers,
        h('canvas',
          {
            attributes: {
              width: widthX,
              height: 10,
            },
            hook: new TimeScaleHook(canvasInfo, samplesPerPixel, duration, color),
          },
        ),
      ],
    ),
  );
}

function shouldUpdateState(state) {
  if (currentState.duration === state.duration &&
    currentState.samplesPerPixel === state.samplesPerPixel) {
    return false;
  }

  return true;
}

export default function renderTimeScale(state) {
  if (shouldUpdateState(state)) {
    currentState = state;
  }

  return Thunk(timescale, currentState);
}
