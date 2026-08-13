/**
 * A marker string embedded in the pre-existing annotation that
 * generate.ts writes into pre-annotated.pdf. The e2e spec searches for the
 * same string after a round trip to prove that annotation was not dropped.
 * Shared here so the generator and the assertion can never drift apart.
 */
export const PRE_ANNOTATED_MARKER = 'totopdf-fixture-preexisting-annotation';
