# Local `block` 0.1.6 patch

This is the MIT-licensed `block` 0.1.6 crate from crates.io, originally locked
with checksum `0d8c1fef690941d3e7788d328517591fecc684c084084702d6ff1641e993699a`.
It is pulled in by `souvlaki` on macOS.

The local changes in `src/lib.rs` are limited to:

- Representing the external Objective-C class symbol with an inhabited,
  one-byte opaque C struct instead of an uninhabited enum. The old enum
  triggers Rust's future-incompatibility warning for an external static.
- Spelling the existing default C ABI explicitly on foreign declarations and
  function pointers, preventing `missing_abi` warnings on current Rust.

No public API or runtime behavior is intentionally changed. Replace this patch
when `souvlaki` no longer requires this crate or upstream incorporates the fix.
