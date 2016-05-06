var playlist = WaveformPlaylist.init({
  container: document.getElementById("playlist")
});

playlist.load([
  {
    "src": "media/audio/BassDrums30.mp3"
  }
]).then(function() {
  //can do stuff with the playlist.
});

playlist.setAnnotations([
  {
   "begin": "0.000",
   "end": "2.680",
   "id": "f000001",
   "language": "en",
   "lines": [
    "1"
   ]
  },
  {
   "begin": "2.680",
   "end": "5.880",
   "id": "f000002",
   "language": "en",
   "lines": [
    "From fairest creatures we desire increase,"
   ]
  },
  {
   "begin": "5.880",
   "end": "9.240",
   "id": "f000003",
   "language": "en",
   "lines": [
    "That thereby beauty's rose might never die,"
   ]
  },
  {
   "begin": "9.240",
   "end": "11.760",
   "id": "f000004",
   "language": "en",
   "lines": [
    "But as the riper should by time decease,"
   ]
  },
  {
   "begin": "11.760",
   "end": "14.440",
   "id": "f000005",
   "language": "en",
   "lines": [
    "His tender heir might bear his memory:"
   ]
  }
]);
