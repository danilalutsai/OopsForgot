# OopsProof

A free app that helps people never miss an expiry, renewal or payment date, see where their money goes, and share household bills with family.

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
An alert sent to a person a set time before an Item's Due date. An Item can have several: 30 minutes, 1, 2 or 4 hours before (only for Items with a time), or 1 day, 2 days, 1 week, 2 weeks or 1 month before, sent at 12:00. A Reminder must fit inside the time the Item covers: shorter than one repeat for a repeating Item, still ahead of now for a one-time Item. A repeating Item's Reminders repeat every time it comes due.
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

**Family**:
A group of people who share Items and bills. A person belongs to at most one Family, or to none.
_Avoid_: Group, household, team

**Member**:
A person with an account who belongs to a Family.
_Avoid_: User, participant

**Former member**:
How a person whose account was deleted appears in a Family's Split Expenses and Balances. Their amounts stay, their name does not.
_Avoid_: Deleted user, ex-member, unknown

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

**Split Expense**:
An Expense whose cost is divided equally between chosen Members of a Family. It is Unpaid until someone records who paid it.
_Avoid_: Shared bill, group expense

**Share**:
One person's equal part of a Split Expense. It is what counts in that person's monthly total.
_Avoid_: Portion, cut

**Payer**:
The one Member who paid the full amount of a Split Expense.
_Avoid_: Buyer, owner

**Payback**:
Money one Member gives another to lower what they owe, recorded by hand.
_Avoid_: Settlement, transfer, refund

**Balance**:
How much one Member owes another, worked out from Split Expenses and Paybacks between those two people.
_Avoid_: Debt, total
