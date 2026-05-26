---
layout: default
title: Privacy Policy
permalink: /privacy/
---

# Privacy Policy

**Effective date:** 2026-05-26
**App:** Sayverse
**Developer:** Andrii Ozadovskyi (sole operator)
**Contact:** andrew.ozadovskyi@gmail.com

## At a glance

- **No data collection.** Sayverse has no backend, no analytics, no telemetry, no advertising, no cookies, and no tracking technologies of any kind.
- **Bring your own key.** You provide your own OpenAI API key. It is stored only on your device.
- **Direct device-to-OpenAI calls.** Your audio and text go straight from your device to OpenAI's API. They never pass through any server controlled by us.
- **You can decline consent and stop using the app at any time.** Uninstalling Sayverse removes every byte of data we ever stored about you, because there is none stored anywhere else.

## 1. Data we collect about you

**We collect nothing.** Sayverse has no servers, no analytics SDKs, no crash reporters, no third-party tracking, and no accounts.

We do **not sell or share** personal information.
We do **not use cookies or tracking technologies**.
We do **not build profiles** about you or anyone using the app.

## 2. Data stored on your device only

The following stays on your device. None of it is uploaded anywhere by Sayverse:

- **Your OpenAI API key** — stored in the iOS Secure Enclave via `expo-secure-store` (or the equivalent Android-encrypted storage). Used only to authenticate your direct calls to OpenAI.
- **Your translation and conversation history** — stored locally via `AsyncStorage`. Cleared when you delete a session or uninstall the app.
- **Your app settings** — language preferences, mode, consent flag.

You can clear all of this at any time from Settings, or by uninstalling Sayverse.

## 3. Third-party processing — OpenAI

When you record voice or translate text, your device makes a direct HTTPS request to OpenAI's API using your API key:

- **Whisper API** transcribes your voice recording into text.
- **GPT-4o-mini** translates text between your selected languages.

This data is processed by OpenAI under your own OpenAI account and your own contractual relationship with OpenAI. We are not an intermediary.

Per OpenAI's API Data Usage Policy, API data is:

- **Retained for up to 30 days** for abuse and misuse monitoring, then deleted.
- **Not used to train OpenAI models** unless you have explicitly opted in inside your own OpenAI account.

You should review:

- OpenAI Privacy Policy: [https://openai.com/policies/privacy-policy](https://openai.com/policies/privacy-policy)
- OpenAI API Data Usage Policy: [https://openai.com/policies/api-data-usage-policies](https://openai.com/policies/api-data-usage-policies)
- OpenAI Data Processing Addendum: [https://openai.com/policies/data-processing-addendum](https://openai.com/policies/data-processing-addendum)

## 4. International data transfers

OpenAI's services are operated by OpenAI, L.L.C. (United States) and, for users in the European Economic Area, the UK and Switzerland, by OpenAI Ireland Limited. Where data is transferred from the EEA, UK or Switzerland to the United States, OpenAI relies on the **Standard Contractual Clauses (EU 2021/914)**, supplemented by the **UK International Data Transfer Addendum** where the UK is involved, and is certified under the **EU-US Data Privacy Framework**, the **UK Extension to the EU-US DPF**, and the **Swiss-US DPF**.

Because Sayverse itself transfers nothing (the call is from your device to OpenAI), these safeguards govern OpenAI's processing of your data once it reaches them.

## 5. Lawful basis for processing (GDPR)

Sayverse does not process personal data on any infrastructure that we control, so we are not a controller of any processing carried out on our servers — there are no such servers.

For the device-to-OpenAI processing that Sayverse enables on your behalf, our lawful basis under Article 6(1)(a) GDPR is your **explicit consent**, which you give the first time you open the app after entering your API key. You can withdraw that consent at any time via **Settings → Reset consent**, with effect for the future.

## 6. Your rights

### If you are in the European Economic Area, United Kingdom or Switzerland (GDPR / UK GDPR)

You have the right to:

- **Access** any personal data we hold about you (Article 15) — we hold none.
- **Rectification** of inaccurate personal data (Article 16).
- **Erasure** ("right to be forgotten") (Article 17) — already automatic via uninstall.
- **Restriction** of processing (Article 18).
- **Data portability** (Article 20).
- **Object** to processing (Article 21).
- **Withdraw consent** at any time (Article 7(3)) — see Settings → Reset consent.
- **Lodge a complaint with a supervisory authority** (Article 77). In Spain, this is the Agencia Española de Protección de Datos ([https://www.aepd.es](https://www.aepd.es)). For other EEA countries, the relevant authority is listed at [https://edpb.europa.eu/about-edpb/about-edpb/members_en](https://edpb.europa.eu/about-edpb/about-edpb/members_en).

To exercise any of these rights against OpenAI's processing, contact OpenAI through their Privacy Policy linked above.

### If you are in California (CCPA / CPRA, as amended effective 1 January 2026)

You have the right to:

- **Know** what personal information has been collected — none.
- **Delete** personal information we hold — already none.
- **Correct** inaccurate personal information.
- **Opt out of sale or sharing** of personal information — **we do not sell or share** personal information, and we never have.
- **Limit use** of sensitive personal information.
- **Non-discrimination** for exercising these rights.

**Automated decision-making technology (ADMT) under California's 2026 regulations:** Sayverse uses AI for translation only. We do not make significant decisions about you, do not profile you, do not use AI for any decision affecting your access to housing, employment, financial services, healthcare, education, criminal justice or other significant matters. The ADMT regulations therefore do not apply to Sayverse.

## 7. Children

Sayverse is not directed at children. We collect no personal information from anyone, including children. Per GDPR Article 8, the minimum age of digital consent varies between 13 and 16 across EU member states. If you are under that age in your country, please do not use the app without the consent of a parent or guardian.

## 8. Accessing this policy

This policy is published at **[https://sayverse.app/privacy/](https://sayverse.app/privacy/)** and is also accessible from within the app via **Settings → Privacy Policy**.

The version published on this page is the canonical version.

## 9. Changes to this policy

If we make material changes to this policy, the change will be announced in the release notes for that app version, and the effective date at the top of this page will be updated. This policy is reviewed at least every 12 months.

## 10. Contact

- **Developer:** Andrii Ozadovskyi
- **Email:** [andrew.ozadovskyi@gmail.com](mailto:andrew.ozadovskyi@gmail.com)
- **Repository:** [https://github.com/ozadovskyi/Sayverse](https://github.com/ozadovskyi/Sayverse)
