# OopsForgot

A free app that helps people never miss an expiry, renewal or payment date, and see where their money goes. Each person uses it on their own: nothing is shared with others.

## Language

**Item**:
Something a person tracks because it expires, renews or must be paid: a passport, a card, a subscription, car insurance, a rent payment.
_Avoid_: Deadline, entry, record, thing

**Event date**:
The date an Item expires, renews or must be paid. Called "Due date" until November 2026: the code and the database still say so (`due_date`, `dueDate`, `currentDueDate`…), and code comments may too; only the words people see changed. Rows say "Today", "Tomorrow" or "In 5 days", not "Due …".
_Avoid_: Due date (in anything people see), deadline, expiry, end date

**Start time** and **Finish time**:
The time of day an Item begins on its Event date, and optionally when it ends (later the same day). An Item with no Start time is **All day**. Reminders count from the Start time, or from the start of the day for an All-day Item.
_Avoid_: Due time, end time, duration

**Category**:
One of a fixed set of kinds an Item belongs to (Documents, Cards, Subscriptions, Free trials, Vehicle, Home, Health, Purchases, Travel, Other).
_Avoid_: Type, tag, group

**Recurrence**:
How often a repeating Item comes round again: every N days, weeks, months or years. An Item without a Recurrence happens once.
_Avoid_: Frequency, interval, schedule

**Expired**:
The state of a one-time Item whose time is over: right after its Finish time, or (All day, or only a Start time) from 00:00 the next day, in the person's time zone. Repeating Items never expire; they move on to their next Event date. Expired Items wait in their own part of the list, above Today, until the person gives them a new Event date, deletes them, or the clean-up deletes them after the time the person chose (1 month unless they change it). "Keep in Expired" answers the "What now?" question and leaves the Item there.
_Avoid_: Overdue, late, past due, archived (there is no Archived state any more)

**Reminder**:
An alert sent to a person a set time before an Item's Event date. An Item can have several: 30 minutes, 1, 2 or 4 hours before (only for Items with a time), or 1 day, 2 days, 1 week, 2 weeks or 1 month before, sent at the Item's Start time that many days before, or, for an All-day Item, at the person's chosen time of day (12:00 unless they change it). A Reminder must fit inside the time the Item covers: shorter than one repeat for a repeating Item, still ahead of now for a one-time Item. A repeating Item's Reminders repeat every time it comes round.
_Avoid_: Notification, alarm, alert

**Handled**:
The state of an Item a person has already dealt with for its current Event date, such as a renewed passport or a cancelled trial. A Handled Item sends no more Reminders until its next Event date.
_Avoid_: Done, completed, resolved

**Calendar feed**:
A private, self-updating calendar link for one person that shows the Event dates of the Items they can see.
_Avoid_: Calendar export, sync, iCal

**Expense**:
An amount of money spent, either created automatically on the Event date of an Item that has a price, or entered by hand.
_Avoid_: Cost, payment, transaction, spending
