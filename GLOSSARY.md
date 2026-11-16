# OopsProof

A free app that helps people never miss an expiry, renewal or payment date, and see where their money goes. Each person uses it on their own: nothing is shared with others.

## Language

**Item**:
Something a person tracks because it expires, renews or must be paid: a passport, a card, a subscription, car insurance, a rent payment.
_Avoid_: Deadline, entry, record, thing

**Due date**:
The date an Item expires, renews or must be paid.
_Avoid_: Deadline, expiry, end date

**Category**:
One of a fixed set of kinds an Item belongs to (Documents, Cards, Subscriptions, Free trials, Vehicle, Home, Health, Purchases, Travel, Other).
_Avoid_: Type, tag, group

**Recurrence**:
How often a repeating Item comes due again: every N days, weeks, months or years. An Item without a Recurrence happens once.
_Avoid_: Frequency, interval, schedule

**Expired**:
The state of a one-time Item whose Due date has passed and that has not yet been given a new Due date or archived.
_Avoid_: Overdue, late, past due

**Archived**:
The state of an Item a person no longer tracks. It leaves the active list but keeps its history.
_Avoid_: Deleted, inactive, cancelled

**Reminder**:
An alert sent to a person a set time before an Item's Due date. An Item can have several: 30 minutes, 1, 2 or 4 hours before (only for Items with a time), or 1 day, 2 days, 1 week, 2 weeks or 1 month before, sent at the person's chosen time of day (12:00 unless they change it). A Reminder must fit inside the time the Item covers: shorter than one repeat for a repeating Item, still ahead of now for a one-time Item. A repeating Item's Reminders repeat every time it comes due.
_Avoid_: Notification, alarm, alert

**Handled**:
The state of an Item a person has already dealt with for its current Due date, such as a renewed passport or a cancelled trial. A Handled Item sends no more Reminders until its next Due date.
_Avoid_: Done, completed, resolved

**Calendar feed**:
A private, self-updating calendar link for one person that shows the Due dates of the Items they can see.
_Avoid_: Calendar export, sync, iCal

**Expense**:
An amount of money spent, either created automatically on the Due date of an Item that has a price, or entered by hand.
_Avoid_: Cost, payment, transaction, spending
