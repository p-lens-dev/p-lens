-- A formula may be signed with a handle.
--
-- The handle is its sender's thanks, not part of the formula: it is left out
-- of the content hash, so the same figures signed by two people are the same
-- formula, and out of the trigger that keeps formulas unchanged, so that an
-- administrator can clear a handle nobody should see without touching the
-- formula. It is shown only among its machine's contributors, never beside
-- the formula it came with. Every formula stored before is unsigned.

ALTER TABLE formulas ADD COLUMN contributor_name TEXT CHECK (contributor_name IS NULL OR length(contributor_name) BETWEEN 1 AND 12);
