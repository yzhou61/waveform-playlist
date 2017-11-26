/*
{
  "begin": "5.759",
  "end": "9.155",
  "id": "002",
  "language": "en",
  "lines": [
    "I just wanted to hold"
  ]
},
 */

import uuid from 'uuid';

export default function (aeneas, options={}) {
  const timeFormatter = options.timeFormatter;
  const annotation = {
    id: aeneas.id || uuid.v4(),
    start: Number(aeneas.begin) || 0,
    end: Number(aeneas.end) || 0,
    lines: aeneas.lines || [''],
    lang: aeneas.language || 'en',
    displayStart: timeFormatter(Number(aeneas.begin)),
    displayEnd: timeFormatter(Number(aeneas.end)),
  };

  return annotation;
}
