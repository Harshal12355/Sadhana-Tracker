# Sadhana Valli — a sitting, a grove, and a vow that comes back

## Intent

Harshal wants to chant, and he forgets that he meant to. During a chant he also picks up the phone and scrolls. The app should hold the promise outside his head, make one sitting hard to abandon, and keep every sitting he finishes.

## Goals

- One loop. A reminder leads to a sitting. A sitting grows a sprout. Finished sittings stay in a grove.
- A sitting is about 20 minutes on the bead screen that already counts names.
- Leaving that page withers the sprout from this sitting only. The grove stays.
- A missed day is an empty spot. Nothing resets to zero.
- The reminder goes quiet once today's rounds meet the vow. Swiping it away does not count as chanting.
- In this pull request the reminder is the line on the daily page. A notification that fires at a clock time while the app is closed needs a server, and that server is a later project.
- Beads already counted stay counted, whether the sprout lives or dies.

## Non-goals

- A native app, a lock on Instagram, or a plant drawn on top of another app.
- A server that pushes a notification at a clock time. That is a later project.
- Punishing a missed day, a streak that snaps, or a pet that dies after weeks of care.
- Replacing `+1 Round`, `+4 Rounds`, or `16 Done`.
- Coins, a shop, or deleting a stump for a fee.

## Anti-goals

- A reminder that marks itself done because it was swiped.
- Losing today's rounds because a sprout withered.
- Three separate pings for chanting, reading, and hearing.
- Buzzing every few minutes.

## Approaches

1. **Chosen — the whole loop, sitting first.** The sitting and the grove work with no notification permission. The reminder is the line on the daily page when the vow is still open. A clock-time ping waits for a later server. Ship as its own pull request, based on the bead-counter branch, not added to the install pull request.
2. **Rejected — the sitting only.** Fixes scrolling during a chant. The forgotten promise at the end of the day is still forgotten.
3. **Rejected — the reminder only.** Fixes the forgotten promise. The phone can still win once chanting has started.
4. **Rejected — one pet that dies.** A single creature dying after one scroll is the version people delete. Forest keeps the woods and kills only the tree in progress.

## Constraints

- This is a website saved to the home screen. It can tell that its own page was hidden. It cannot see which other app opened, and it cannot draw over that app.
- A website cannot schedule "ping me at 5:00pm" and have the phone deliver it after the app is closed. Chrome tried that and did not ship it. A later project can add a server push. This pull request does not.
- The bead screen, `beadsInRound`, and today's `completedRounds` already exist. A sitting uses them. It does not invent a second counter.
- The vow is the day's existing target, usually 16 rounds.

## How it behaves

### The sitting

- From the bead screen, **Start a sitting** asks for a length: 10, 20, or 30 minutes. 20 is the one already selected.
- The sprout is a seed at the start and grows while the page is visible and the timer is running.
- The bead button keeps working. Names still land on today's log.
- The timer reaching its end while the page is visible plants the sprout. Chanting can continue after that. The plant does not require the person to stop.
- The sitting is saved as soon as it starts, with result `in-progress`. If the app is killed or reloaded before the timer is seen finishing on a visible page, the next open marks that sitting `withered`. A sitting only becomes `grown` when the timer is seen to finish on the visible page.
- Hiding the page for more than 5 seconds withers this sprout. A short hide, such as the notification shade, does not.
- Ending the sitting from inside the app before the timer ends withers this sprout. That includes the bead screen's **Done** while a sitting is still running.
- After the timer has planted the sprout, **Done** only closes the screen.
- A withered sprout does not remove rounds or beads already saved.

### The grove

- Each finished or withered sitting is stored on that day's log.
- The daily page shows this month's grove: a living plant for each sitting that finished, a stump for each one that withered.
- Beside it, the number is every living plant so far, across months. That number only goes up. There is no streak. On the 1st the month strip can be empty while the number stays.
- An empty day has no mark and does not change the number.

### The reminder

Builder call: the line sits at the top of the daily page. The rest of the day stays on the page under it. It is not a wall in front of the app.

- The line appears when the app is opened or brought back, and today's rounds are below the vow, and today was not skipped.
- It shows the rounds still left, and **Start a sitting**.
- The line is gone for the rest of that visit once a sitting has been started, or once the vow is met.
- **Skip today** hides it until tomorrow on this phone. Tomorrow brings it back if the new day is short. It does not change the vow and it does not move rounds to the next day.
- A clock-time notification is not part of this pull request.

## What is stored

On the day record, beside the fields that already exist:

- `sittings`: a list. Each item has `id`, `minutes` (10, 20, or 30), and `result` (`in-progress`, `grown`, or `withered`).
- A missing list means no sittings.

Sync unions sittings by `id`, the same way readings and lectures already union. If either side has `withered`, the result is `withered`. If either side has `grown` and neither has `withered`, the result is `grown`. Otherwise it stays `in-progress`.

Firestore rules must allow `sittings` or a signed-in save of a sitting will be rejected. Shipping the client without that rule change repeats the bead-field failure. Deploying the rules is a separate step this design does not perform.

## Build order

1. Sitting and grove, including the wither rule and the beads staying saved.
2. The line at the top of the daily page when the vow is short.

The pull request contains both. It is new, and it is based on the bead-counter branch. A server push that can reach a closed phone is a later project.

## Done when

1. Stay on a 10-minute sitting until the timer ends: a living plant is in the grove, and the rounds chanted during it are on today.
2. Hide the page for more than 5 seconds during a sitting: that sprout is a stump, and the beads tapped before leaving are still on today.
3. A finished plant from yesterday is still in the grove after today's sprout dies.
4. Open the app with 4 of 16 rounds: the first line says 12 rounds are left and offers **Start a sitting**. Open it again after 16 rounds: that line is absent.
5. Bring the app back with 4 of 16 rounds, without killing it first: the line is at the top of the daily page. After **Skip today**, bringing it back does not show the line. The next day, with the vow still short, the line is back.
