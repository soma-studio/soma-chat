# HANDOFF — Session H (April 11, 2026)

## Date: 2026-04-11

## Summary

No direct changes to soma-chat in Session H. Last changes were Session G (VoiceWidget + UI harmonization). Documenting current state for continuity.

## Current state

- VoiceWidget.tsx present in root layout (copied from somastudio-site, Session G)
- Heading color rule in globals.css
- h1 class: text-h1 font-semibold
- Greeting bubble: dark blue bg, white text
- CMS-driven content (ISR 1h from somastudio.xyz Payload API)

## What is next

- VoiceWidget may need updating if somastudio-site VoiceWidget changes propagate (scroll opacity, auto-connect logic are homepage-specific so may not apply here)
- Mobile responsive testing
