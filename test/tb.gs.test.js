var test = require('tap').test
  , $ = require('interlude')
  , GroupStage = require('../')
  , TieBreaker = require('../tiebreak_groups');

test("gs 9 3 all equal scores - proceed 3", function (t) {
  var gs = new GroupStage(9, 3);
  var ms = gs.matches;

  // score so that everyone got exactly one win
  // easy to do by symmetry in this case, reverse score middle match in group
  ms.forEach(function (m){
    gs.score(m.id, (m.id.r === 2) ? [0, 1] : [1, 0]);
  });

  var res = gs.results();
  t.deepEqual($.nub($.pluck('wins', res)), [1], "all players won 1 match");

  var tb = new TieBreaker(res, 3);
  var tms = tb.matches;

  t.equal(tms.length, 3, "should only need within TBs");

  var getPsInGroup = function (gNum) {
    var grp = ms.filter(function (m) {
      return m.id.s === gNum;
    });
    return $.nub($.flatten($.pluck('p', grp))).sort($.compare());
  };
  t.deepEqual(tms[0].p, getPsInGroup(1), "r1 tiebreaker contains group 1 players");
  t.deepEqual(tms[1].p, getPsInGroup(2), "r1 tiebreaker contains group 2 players");
  t.deepEqual(tms[2].p, getPsInGroup(3), "r1 tiebreaker contains group 3 players");

  var isAllR1 = tms.map($.get('id', 'r')).every($.eq(1));
  t.ok(isAllR1, "should only have R1 tiebreakers (within groups)");

  tms.forEach(function (m, i) {
    t.ok(!tb.score(m.id, [2,2,2]), "cant tie-score tb " + i);
    t.ok(!tb.score(m.id, [1,2,2]), "cant tie-score tb " + i);
    t.ok(!tb.score(m.id, [1,2,1]), "cant tie-score tb " + i);
    t.ok(!tb.score(m.id, [2,1,2]), "cant tie-score tb " + i);
    t.equal(m.p.length, 3, "3 players in tb " + i);
    t.equal(tb.unscorable(m.id, [3,2,1]), null, "but this should work");
    t.ok(tb.score(m.id, [3,2,1]), "and it does");
  });

  t.end();
});

test("gs 9 3 tied only between - proceed any", function (t) {
  var gs = new GroupStage(9, 3);
  var ms = gs.matches;

  // score so that everyone according to seed - ensures no ties within groups
  // but because all groups are identical, we cant pick from one group over another
  ms.forEach(function (m){
    gs.score(m.id, (m.p[0] < m.p[1]) ? [1, 0] : [0, 1]);
  });

  var res = gs.results();
  var wins = $.nub($.pluck('wins', res)).sort($.compare(+1));
  t.deepEqual(wins, [0, 1, 2], "full spectrum of wins");

  $.range(8).forEach(function (n) {
    t.equal(TieBreaker.invalid(res, n), null, "configuration valid");
    var tb = new TieBreaker(res, n);
    var tms = tb.matches;
    tms.forEach(function (m) {
      t.equal(m.id.s, 0, "all tb matches occur in s=0");
    });

    if ([3, 6].indexOf(n) >= 0) {
      t.equal(tms.length, 0, "no TBs when picking equally from each group");
    }
    else {
      t.equal(tms.length, 1, "need between TB R2 when picking non-multiples");
      t.equal(tms[0].id.r, 2, "and it should be in R2");
      t.equal(tms[0].p.length, 3, "and we need to tiebreak 3 players");
      t.ok(tms[0].p.every(Number.isFinite), "every player is a finite number");
      t.ok(tb.score(tms[0].id, [3,2,1]), "can score the r2 match");

      // now sketch out all the different possibilities:
      var verifyFinal = function (tb) {
        var tms = tb.matches;
        if (n === 1 || n === 2) {
          t.deepEqual(tms[0].p, [1,2,3], "the 3 needs to be the group winners");
        }
        else if (n === 4 || n === 5) {
          t.deepEqual(tms[0].p, [4,5,6], "the 3 needs to be the 2nd placers");
        }
        else if (n === 7 || n === 8) {
          t.deepEqual(tms[0].p, [7,8,9], "the 3 needs to be the group losers");
        }
        else {
          t.ok(false, "should not be in this case");
        }
        t.ok(tb.isDone(), "tb done now");
      };
      verifyFinal(tb);
      // verify serialization works as well
      var tb2 = TieBreaker.parse(tb + '');
      t.ok(tb2, "tb2 exists");
      verifyFinal(tb2);
    }
  });
  t.end();
});

test("gs 6 3 unique groups !mapsBreak", function (t) {
  var gs = new GroupStage(6, 3);
  var ms = gs.matches;

  // want to score s.t. both groups have clear 1st, 2nd and 3rd (with mapsBreak)
  // but need breaking between

  // score according to seeds - with magnitude according to group number
  // this ensure no ties within the groups and no ties between groups
  // by reversing only one of the matches this is assured (and weighting by round)
  // weight map scores by groups as well
  ms.forEach(function (m){
    var a = m.id.r + m.id.s;
    gs.score(m.id, (m.id.r === m.id.s) ? [0, a] : [a, 0]);
  });

  // just to verify the grand scheme:
  // grp1 should have pts 6 3 0 mapsFor 7 2 0 mapsAgainst 0 3 6
  // grp2 should have pts 3 3 3 mapsFor 5 4 3 mapsAgainst 4 5 3
  var makeStr = function(r) {
    var str = "P" + r.seed + " WDL=" + r.wins + ',' + r.draws + ',' + r.losses;
    str += " F=" + r.for + " A=" + r.against;
    str += " => GPOS=" + r.gpos + " in grp " + r.grp;
    return str;
  };
  t.deepEqual(gs.results({mapsBreak: false}).map(makeStr), [
    'P1 WDL=2,0,0 F=7 A=0 => GPOS=1 in grp 1',
    'P2 WDL=1,0,1 F=5 A=4 => GPOS=1 in grp 2',
    'P4 WDL=1,0,1 F=3 A=5 => GPOS=1 in grp 2',
    'P5 WDL=1,0,1 F=4 A=3 => GPOS=1 in grp 2',
    'P6 WDL=1,0,1 F=2 A=3 => GPOS=2 in grp 1',
    'P3 WDL=0,0,2 F=0 A=6 => GPOS=3 in grp 1'
  ],
    "no break results"
  );

  t.deepEqual(gs.results({mapsBreak: true}).map(makeStr), [
    'P1 WDL=2,0,0 F=7 A=0 => GPOS=1 in grp 1',
    'P2 WDL=1,0,1 F=5 A=4 => GPOS=1 in grp 2',
    'P4 WDL=1,0,1 F=3 A=5 => GPOS=2 in grp 2',
    'P6 WDL=1,0,1 F=2 A=3 => GPOS=2 in grp 1',
    'P5 WDL=1,0,1 F=4 A=3 => GPOS=3 in grp 2',
    'P3 WDL=0,0,2 F=0 A=6 => GPOS=3 in grp 1'
  ],
    "map break results"
  );

  [false, true].forEach(function (mapsBreak) {
    // given two different GROUPSTAGE results, create a tiebreaker from it
    var res = gs.results({mapsBreak: mapsBreak});

    t.ok(!TieBreaker.isNecessary(res, 6), "tiebreaker necessary for " + 6);
    [2, 4].forEach(function (n) {
      if (!mapsBreak) {
        t.ok(TieBreaker.isNecessary(res, n), "tiebreaker necessary for " + n);
        var tb = new TieBreaker(res, n);
        var tms = tb.matches;
        t.equal(tms.length, 1, "should be one within tiebreaker for " + n);
        t.equal(tms[0].id.r, 1, "it should be a round 1 match then");
        t.deepEqual(tms[0].p, [2, 4, 5], "entire group 2 must be broken");
      }
    });

    // will always be TieBreakers when n is not a multiple of 3
    // as mapsBreak is only applied on the within group level
    [1,3].forEach(function (n) {
      t.ok(TieBreaker.isNecessary(res, n), "tiebreaker necessary for " + n);
      var tb = new TieBreaker(res, n);
      var tms = tb.matches;

      var verifyR2 = function (m, r1m) { // m is always the round 2 match
        t.equal(m.id.r, 2, "between match should be in R2");
        t.equal(m.p.length, 2, "and we then will need to tiebreak 2 players");
        //t.ok(!tb.isDone(), "not done yet 1");

        if (r1m) {
          t.deepEqual(m.p, [0, 0], "one player known, but not advanced till end");
          t.ok(tb.unscorable(m.id, [2,1]), "can't score r2 yet");
          // scoring in this match so that results for grp one is as follows:
          // 1st: 2, 2nd: 5, 3rd: 4 (this matches how it is if mapsBreak)
          t.ok(tb.score(r1m.id, [3,1,2]), "can score R1 match");
          t.ok(!tb.isDone(), "not done yet 2");
        }

        if (n === 1) {
          t.deepEqual(m.p, [1, 2], "winners proceeded to R2 now");
        }
        if (n === 3) {
          if (!mapsBreak) {
            // because scored r1 [3,1,2] p2 wins g2, p5 gets second, p4 gets third
            t.deepEqual(m.p, [5, 6], "2nd placers proceeded to R2 now");
          }
          if (mapsBreak) {
            // because no r1, and mapsBroke, the clear 2nd placers are in between
            t.deepEqual(m.p, [4, 6], "2nd placers proceeded to R2 now");
          }
        }
        t.equal(tb.unscorable(m.id, [2,1]), null, "can score r2 now");
        t.ok(tb.score(m.id, [2,1]), "could score r2");
        t.ok(tb.isDone(), "should all be done now");
      };

      if (!mapsBreak) {
        t.equal(tms.length, 2, "two tiebreakers for " + n);
        t.equal(tms[0].id.r, 1, "first should be a round 1 match");
        t.deepEqual(tms[0].p, [2, 4, 5], "and entire group 2 must be broken");
        verifyR2(tms[1], tms[0]);
      }
      else {
        t.equal(tms.length, 1, "one tiebreakers for " + n);
        verifyR2(tms[0]);
      }
    });
  });
  t.end();
});
