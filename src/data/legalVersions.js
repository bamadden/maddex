// Versions of the legal documents a user accepts. Kept apart from the
// documents' text (data/legalDocs) so the sign-up form and the gates can read
// them without pulling the text into the first-paint bundle.
//
// Bump a version when its document changes in substance: every account is
// then asked to accept the new one, and the acceptance is stored with the
// version and time (services/legalConsent).

export const TERMS_VERSION = 'terms-draft-2026-11-01'
export const PRIVACY_VERSION = 'privacy-draft-2026-11-01'
export const LEGAL_STATUS = 'DRAFT, pending legal review'
