# Adding an aircraft to cockpit sync

Every aircraft keeps its cockpit differently, so each gets a profile in code under `desktop/connector/aircraft/<id>/`.
Profiles share the helpers in `profile.ts`; beyond that they do whatever their aircraft needs (`custom()` writes are
the escape hatch). The FlyByWire A32NX in `aircraft/a32nx/` is the worked example.

1. **Find how the cockpit works.** The aircraft package's model behaviours (`ModelBehaviorDefs/**`, often an expanded
   `generated/` copy) show what each switch reads for its position and what a click does: write an L:var, fire a
   K/custom event, set a `B:` input event, or fire an H:event. Developer docs list the variables and events; the
   behaviour files win when they disagree.
2. **Write the profile.** `index.ts` exports an `AircraftProfile`: an `id`, a `version`, a display `name`, the
   `identity` datums and `matches()` (prefer the ATC model and the aircraft's own variables: liveries change the
   title and SimObjects folder), `areas` of controls in power-up order, `aux` values used by custom writes, `actions`
   for presses with no lasting state, `flightControls` for what only the pilot flying sets, an optional `fms`, and
   `flightPlanAccount` when the aircraft downloads flight plans with an account kept in the sim's stored data.
3. **Map each control** with a stable `key` (`<panel>.<thing>`), a `read` datum, and a `write`:
   - the click writes an L:var → `toDatum()`;
   - it fires a K or custom event → `event()` (with scaling) or `toggle()`
     (fires only when the control isn't already there);
   - a momentary pushbutton that flips state → `pulse(<pressed var>)`, or `kind: "momentary"` to replay presses;
   - a `B:` input event → `inputEvent()` with a fallback;
   - only an H:event → `hEvent()` (needs the in-sim module);
   - anything else → `custom()`.
     Knobs get a `tolerance` and `rateHz`; switches the aircraft resets itself get `risingOnly`; values that only mean
     something in a mode get `only`; settings the host's aircraft should decide (an EFB's realism options, when they're readable as variables) get `fromHost`. Sync only what the pilot touches, never computed effects.
4. **Register it** in `profiles.ts`, before the generic profile catches it.
5. **Bump `version`** whenever keys or meanings change: cockpits only sync between equal versions.
6. **Test it in co-op**: two pilots, the same aircraft, each panel switched from one seat and checked on the other.
