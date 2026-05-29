// Jest stub for isomorphic-dompurify — bypasses the jsdom + ESM dep tree.
// Unit tests don't exercise the sanitizer; in tests that DO assert sanitization
// behavior, the SanitizeHtmlPipe should be mocked at the spec level.
const sanitize = (input: any): any => input;

export default { sanitize };
export { sanitize };
