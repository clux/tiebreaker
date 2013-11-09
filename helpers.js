// helper that takes a result array slice that contains .pts, .for, and .against
// and calls back with the new position relative to startPos and ary slice
// that it would have gotten from this computation
var tieCompute = function (ary, startPos, scoreBreak, cb) {
  var pos = startPos
    , ties = 0
    , pts = -Infinity
    , scoreDiff = -Infinity
    , tbScore = -Infinity;
  for (var i = 0; i < ary.length; i += 1) {
    var r = ary[i]
      , samePts = (r.pts === pts)
      , sameDiff = (scoreDiff === (r.for - r.against))
      , sameTbScore = (r.tb == null || tbScore === r.tb);

    if (samePts && (!scoreBreak || sameDiff) && sameTbScore) {
      ties += 1;
    }
    else {
      pos += 1 + ties;
      ties = 0;
    }
    pts = r.pts;
    scoreDiff = r.for - r.against;
    tbScore = r.tb;
    cb(r, pos, i); // so we can do something with pos on r
  }
};

exports.positionFromXarys = function (xarys, scoresBreak) {
  // tieCompute across groups via xplacers to get the `pos` attribute
  var sorter = exports.compareResults(scoresBreak);
  xarys.reduce(function (currPos, xplacers) {
    xplacers.sort(sorter);
    tieCompute(xplacers, currPos, scoresBreak, function (r, pos) {
      r.pos = pos;
    });
    return currPos + xplacers.length; // always break up xplacers and (x+1)placers
  }, 0);
};

// priority: 1. points, 2. breakingDiff, 3. tbR2Points, 4. visualDiff, 5. seed
// first 3 will end up breaking up `pos` attributes
exports.compareResults = function (scoresBreak) {
  return function (x, y) {
    if (x.pts !== y.pts) {
      return y.pts - x.pts;
    }
    var xScore = x.for - (x.against || 0);
    var yScore = y.for - (y.against || 0);
    var scoreDiff = yScore - xScore;
    if (scoresBreak && scoreDiff) {
      return scoreDiff;
    }
    if (x.tb != null && y.tb != null) {
      return y.tb - x.tb;
    }
    return scoreDiff || (x.seed - y.seed);
  };
};

var visualScorer = exports.compareResults(true);
exports.finalCompare = function (x, y) {
  if (x.pos !== y.pos) {
    return x.pos - y.pos;
  }
  return visualScorer(x, y);
};
