# OopsProof

A free app that helps people never miss an expiry, renewal or payment date, see where their money goes, and share household bills with family.

## Language

**Item**:
Something a person tracks because it expires, renews or must be paid: a passport, a card, a subscription, car insurance, a rent payment.
_Avoid_: Deadline, entry, record, thing

**Due date**:
The date an Item expires, renews or must be paid.
_Avoid_: Deadline, expiry, end date

**Act-by date**:
The last day a person can still act on an Item in time, such as cancelling before renewal or starting a passport renewal. It falls on or before the Due date.
_Avoid_: Deadline, notice date

**Lead time**:
How long before the Due date a person must act on an Item, such as a notice period or a processing time. The Act-by date is the Due date minus the Lead time.
_Avoid_: Notice period, buffer, advance

**Category**:
One of a fixed set of kinds an Item belongs to (Documents, Cards, Subscriptions, Free trials, Vehicle, Home, Health, Purchases, Travel, Other). Each Category has default settings, such as a default Lead time.
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
An alert sent to a person a set time before, or on, an Item's Due date or Act-by date. A repeating Item's Reminders repeat every time it comes due.
_Avoid_: Notification, alarm, alert

**Handled**:
The state of an Item a person has already dealt with for its current Due date, such as a renewed passport or a cancelled trial. A Handled Item sends no more Reminders until its next Due date.
_Avoid_: Done, completed, resolved

**Expense**:
An amount of money spent, either created automatically on the Due date of an Item that has a price, or entered by hand.
_Avoid_: Cost, payment, transaction, spending

**Family**:
A group of people who share Items and bills. A person belongs to at most one Family, or to none.
_Avoid_: Group, household, team

**Member**:
A person with an account who belongs to a Family.
_Avoid_: User, participant

**Admin**:
A Member who can manage the Family: remove Members, rename or delete it, and make other Members Admins. A Family has one or more Admins.
_Avoid_: Owner, moderator, head

**Personal Item**:
An Item only the person who added it can see.
_Avoid_: Private Item

**Shared Item**:
An Item every Member of a Family can see.
_Avoid_: Family Item, group Item

**Owner**:
A Member responsible for dealing with a Shared Item. A Shared Item has one or more Owners; a Personal Item's only Owner is the person who added it.
_Avoid_: Assignee, creator, responsible

**Dependent**:
Someone in a Family without an account, such as a child, a pet or an elderly parent, whom Items can be for. A Dependent never owns Items or gets Reminders.
_Avoid_: Child, profile, sub-account
