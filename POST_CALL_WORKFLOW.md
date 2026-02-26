# Clerk Chat — Post-Call Workflow Configuration
# Configure this in the Clerk Chat Workflows / Automations UI.
# This is NOT a deployable file — it is a step-by-step setup guide.

---

## Workflow Name
`Moving Quote Post-Call Follow-Up`

## Trigger Conditions
- Event: **Call ended**
- Condition: Contact property `quote_total` **is set** (non-empty)

This ensures the workflow only fires for calls where a quote was successfully generated.
Calls that ended without a quote (special items branch, API failure) will be skipped.

---

## Step 1 — Wait / Delay

**Type:** Wait / Delay
**Duration:** 5 seconds

This allows the voice agent enough time to finish writing all contact properties
before the workflow reads them.

---

## Step 2 — Send SMS

**Type:** Send SMS
**To:** `{{customer_phone}}` (contact's phone number)
**From:** Your Clerk Chat SMS number
**Message body:**

```
{{quote_sms_body}}
```

This uses the exact `quote_sms_body` written by the voice agent after the API call.
The smsBody already includes the customer's name, origin/destination ZIPs, full
cost breakdown, and a call-to-action.

---

## Step 3 — Send Email (Gmail Integration)

**Type:** Send Email (via Gmail integration)
**To:** `{{customer_email}}`
**From:** Your connected Gmail account
**Subject:** `Your Clerk Moving Assistant Quote — {{customer_name}}`

**Body (HTML or plain text):**

```
Hi {{customer_name}},

Thank you for calling Clerk Moving Assistant! As promised, here is the full
summary of your moving estimate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOVING QUOTE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Origin ZIP:        {{origin_zip}}
Destination ZIP:   {{destination_zip}}
Bedrooms:          {{num_rooms}}
Packing Service:   {{packing_needed}}
Disposal Service:  {{disposal_needed}}

{{quote_sms_body}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This estimate is valid for 30 days. To book your move or schedule a free
on-site assessment, call us at (415) 423-7212 or simply reply to this email.

We look forward to making your move a great experience!

Warm regards,
The Clerk Moving Assistant Team
(415) 423-7212
```

**Note:** If your Clerk Chat Gmail integration supports HTML, you can format the
breakdown table. If plain text only, the smsBody line items are already
cleanly formatted with ASCII alignment.

---

## Step 4 — Update Contact Properties

**Type:** Update Contact
**Properties to set:**

| Property           | Value                        |
|--------------------|------------------------------|
| `last_channel`     | `post_call_sms`              |
| `quote_delivered_at` | Current timestamp (now)   |

---

## Workflow Settings

| Setting              | Value            |
|----------------------|------------------|
| Run once per contact | No (allow re-run if customer calls again) |
| Error handling       | Continue on step failure |
| Notifications        | Notify owner if SMS or email step fails   |

---

## Contact Properties Reference

These properties are written by the voice agent and read by this workflow:

| Property            | Type    | Set By          | Used By            |
|---------------------|---------|-----------------|---------------------|
| customer_name       | Text    | Voice agent     | Email subject/body  |
| customer_email      | Email   | Voice agent     | Email To field      |
| customer_phone      | Phone   | Voice agent     | SMS To field        |
| origin_zip          | Text    | Voice agent     | Email body          |
| destination_zip     | Text    | Voice agent     | Email body          |
| num_rooms           | Number  | Voice agent     | Email body          |
| packing_needed      | Boolean | Voice agent     | Email body          |
| disposal_needed     | Boolean | Voice agent     | Email body          |
| referral_source     | Text    | Voice agent     | (analytics only)    |
| quote_total         | Number  | Voice agent     | Workflow trigger    |
| quote_sms_body      | Text    | Voice agent     | SMS body, email     |
| quote_verbal_script | Text    | Voice agent     | (audit log)         |
| last_channel        | Text    | This workflow   | CRM tracking        |
| quote_delivered_at  | Date    | This workflow   | CRM tracking        |
