/**
 * Prefixed, portable text ids.
 *
 * Deliberately NOT database-local integer surrogates: an id must survive an
 * export, a machine move and a support paste. appIQ's numeric surrogates are
 * database-local by design (DEV 42 is not PROD 42) and that property is a
 * liability for a desktop app whose database travels with the user.
 */
export const ID_PREFIXES = {
  source: "src",
  run: "run",
  attempt: "att",
  artifact: "art",
  schema: "sch",
  revision: "rev",
  value: "val",
  evidence: "evd",
  review: "rvw",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;
export type Id<K extends IdKind = IdKind> = `${(typeof ID_PREFIXES)[K]}_${string}`;

/** Lowercase base32 (Crockford, no padding) of the given bytes. */
const BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";

export const encodeBase32 = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
};

/**
 * Build an id from caller-supplied randomness. Randomness is injected rather
 * than taken from a global so the whole contracts layer stays free of platform
 * APIs and every id is reproducible in a test.
 */
export const makeId = <K extends IdKind>(kind: K, random: Uint8Array): Id<K> =>
  `${ID_PREFIXES[kind]}_${encodeBase32(random)}` as Id<K>;

export const isId = <K extends IdKind>(kind: K, candidate: string): candidate is Id<K> =>
  candidate.startsWith(`${ID_PREFIXES[kind]}_`) && candidate.length > ID_PREFIXES[kind].length + 1;
