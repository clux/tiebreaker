var $ = require('interlude')
  , FFA = require('ffa')
  , TieBreaker = require('..')
  , test = require('bandage');

var makeStr = function(r) {
  var str = r.pos + " P" + r.seed + " W=" + r.wins;
  str += " F=" + r.for + " A=" + r.against;
  if (r.gpos) {
    str += " GPOS=" + r.gpos;
  }
  return str;
};


test('eightFourLimited', function *(t) {
  var ffa = new FFA(8, { sizes: [4] });
  var fm = ffa.matches;
  t.eq(fm.length, 2, "two matches in ffa");
  t.eq(fm[0].p, [1,3,6,8], 'players in match 1');
  t.eq(ffa.score(fm[0].id, [4,4,2,1]), true, "score match 1");
  t.eq(fm[1].p, [2,4,5,7], 'players in match 2');
  t.eq(ffa.score(fm[1].id, [3,2,2,1]), true, "score match 2");
  t.ok(ffa.isDone(), 'ffa done now');

  t.eq(ffa.rawPositions(ffa.results()), [
      [[1,3],[],[6],[8]],
      [[2],[4,5],[],[7]]
    ], 'ffa posAry before tiebreaking'
  );

  var tb = TieBreaker.from(ffa, 2, { strict: true });
  var tbms = tb.matches;
  t.eq(tbms.length, 1, "matches in tb");
  t.eq(tbms[0].id.s, 1, "first is s1 ffa match");
  t.eq(tbms[0].p, [1, 3], "containing tied in match 1");
  tb.score(tbms[0].id, [2,1]);
  t.ok(tb.isDone(), 'tb done');

  var tbRes = tb.results();

  t.eq(tbRes.map(makeStr), [
      // the between fighters
      "1 P1 W=1 F=4 A=0 GPOS=1",
      "1 P2 W=1 F=3 A=0 GPOS=1",
      // the new 2nd placers
      "3 P3 W=1 F=4 A=0 GPOS=2",
      "3 P4 W=0 F=2 A=1 GPOS=2",
      "3 P5 W=0 F=2 A=1 GPOS=2",
      // original 3rd placer
      "6 P6 W=0 F=2 A=2 GPOS=3",
      // original 4th placers
      "7 P7 W=0 F=1 A=2 GPOS=4",
      "7 P8 W=0 F=1 A=3 GPOS=4",
    ], 'tb res'
  );

  t.eq(ffa.rawPositions(tbRes), [
      [[1],[3],[6],[8]],
      [[2],[4,5],[],[7]]
    ], 'ffa posAry after tiebreaking'
  );
});

test('unbalancedFifteen', function *(t) {
  var ffa = new FFA(15, { sizes: [4, 4], advancers: [2] });
  var fm = ffa.matches;
  t.eq(fm[0].p, [1, 5, 12], 'R1M1.p');
  // can tie outside adv
  ffa.score(fm[0].id, [4,4,2]);
  ffa.score(fm[1].id, [3,3,2,2]);
  ffa.score(fm[2].id, [3,3,2,2]);
  ffa.score(fm[3].id, [3,3,2,1]);
  ffa.score(fm[4].id, [4,4,4,1]); // final 1
  ffa.score(fm[5].id, [4,3,3,3]); // final 2

  t.eq(ffa.rawPositions(ffa.results()), [
      [ [1, 2, 6], [], [], [8] ],
      [ [5], [3, 4, 7], [], [] ]
    ], 'posAry for ffa - 2x three way tie in final'
  );

  // verify basic tiebreakability while we are at it
  // dont really know top 4 from these results
  // HOWEVER - if we did .from(ffa, 4) on other tournament
  // we would unfortunately just pick [1,5,2,6] (WHICH IS UNFAIR)
  var tb = TieBreaker.from(ffa, 4, { strict: true });
  var tbm = tb.matches;
  t.eq(tbm[0].p, [1,2,6], 'r1 tiebreaker 1');
  t.eq(tbm[1].p, [3,4,7], 'r1 tiebreaker 2');

  // get some coverage of upcoming while we are at it
  t.eq(tb.upcoming(1), [tbm[0]], "upcoming for tbp1");
  t.eq(tb.upcoming(3), [tbm[1]], "upcoming for tbp3");
  t.eq(tb.upcoming(8), [], "p8 not part of tiebreaker");

  tb.score(tbm[0].id, [3,2,1]);
  tb.score(tbm[1].id, [3,2,1]);
  t.ok(tb.isDone(), 'tb done now');
  t.eq(tb.upcoming(1).length, 0, "so no more upcoming for p1");

  var tbRes = tb.results();
  t.eq(ffa.rawPositions(tbRes), [
      [[1],[2],[6],[8]],
      [[5],[3],[4],[7]]
    ], 'posAry after tb - all broken'
  );

  var top4 = $.pluck('seed', tbRes.slice(0, 4));
  var top4pos = $.pluck('pos', tbRes);
  t.eq(top4, [1, 5, 2, 3], 'broken top 4 picks 2 from each m');
});
