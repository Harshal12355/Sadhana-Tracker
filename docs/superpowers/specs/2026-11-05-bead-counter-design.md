# Sadhana Valli — bead counter when the bag is at home

## Intent

Harshal wants to chant when the japa bag is not with him. One tap is one name. 108 names become one round on today's log. He also wants a switch to the phone's volume button where the phone allows it.

## Goals

- A page-sized button. Each tap adds one bead.
- The screen shows the bead count out of 108, and today's rounds.
- Bead 108 adds 1 to today's rounds and the bead count returns to 0.
- Bead 40 is still there after the page is closed and opened again.
- The count is stored on that day's log, the same log that already syncs.
- A volume switch. Volume up counts one bead on a phone that hands the key to the page. On an iPhone the switch stays off and one line says the phone will not allow it.

## Non-goals

- Replacing `+1 Round`, `+4`, or `16 Done`.
- Hearing the iPhone volume buttons. A website cannot.
- A native app.

## Anti-goals

- A tap that adds a whole round.
- Losing a half-finished round when the screen sleeps or the tab closes.

## Approaches

1. **Chosen — chant screen on today's log.** The bead count is a field on the day record. The big button writes that field. 108 bumps the rounds the app already saves.
2. **Rejected — a counter that forgets the beads until 108.** Bead 40 dies when the tab closes.
3. **Rejected — a native app so iPhone volume buttons work.** Already set aside. A website cannot hear those buttons.

## How it behaves

These are builder calls. Correct them if they are wrong.

- New field on the day record: `beadsInRound`, a number from 0 to 107. Old logs with no field count as 0.
- The mantra total shown next to the rounds includes this partial round: `completedRounds * 108 + beadsInRound`.
- One bead forward: if `beadsInRound` is 107, the next bead sets it to 0 and adds 1 round, capped at 64, which is the cap the round buttons already use.
- One bead back: if the count is 0 and there is at least one round, rounds drop by 1 and the beads become 107. Otherwise the bead count drops by 1 and stops at 0.
- The existing `-1` round button does not change `beadsInRound`.
- While the chant screen is open, Space is one bead, not one round.
- The chant screen asks the phone to stay awake. If the phone refuses, the button still works.
- Volume up counts one bead only when the switch is on. Volume down does not count. If the browser never sends the key, the switch turns off and the line says this phone did not hand over the volume buttons.
- When two devices disagree, the newer record's `beadsInRound` wins. Rounds still keep the higher number, which is the rule they already use.

## Done when

1. Tap the big button 108 times on a fresh day: rounds are 1 and the bead count is 0.
2. Reload at bead 40: the count is still 40.
3. One bead back from 0, with 1 round already saved, returns to 107 beads and 0 rounds.
4. On a browser that does not emit the volume key, the switch cannot turn on, and the big button still counts.
