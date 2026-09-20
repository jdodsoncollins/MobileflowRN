# Design constraints

Method: [designing-with-ai](https://github.com/jdodsoncollins/designing-with-ai). Named products, not adjectives.

## Job

Phone-native Webflow **control plane**: plan, confirm, execute against the live Data API. Review content, health, comments, and traffic. It is not the Designer canvas.

## Named references

- **Flows of** Mail (inboxes for forms and comments) and App Store Connect (publish, health, site scope).
- **Look of** iOS Settings grouped lists plus an editorial magazine desk: warm paper, ink, one accent.
- Not Webflow Designer chrome. Do not copy Webflow blue `#146EF5`, the W mark, or Designer toolbar glyphs.

## Must

- Live Data API only. No demo sites.
- ConfirmationPolicy on writes. Hard confirm for publish.
- Liquid Glass on navigation chrome only. Content is opaque.
- Heuristic Command always available. Hide on-device LLM chrome when the OS model is missing.
- Site scope is the selected site. Do not N+1 CMS, comments, or Analyze from the site picker.
- 8pt grid, 48pt minimum targets, continuous corners on cards.
- Light appearance until a complete dark palette exists.
- One accent. One grey family (warm paper + cool ink).

## Must not

- Purple/indigo AI-default CTAs.
- Glass on list rows or forms.
- Emoji as chrome.
- Extra labels that repeat the control.

## Accent

Teal-slate `#1A5355` on warm paper `#F3F0EB` / `#FFFCF8`. Derived for this product; not a Webflow token.
