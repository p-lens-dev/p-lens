//! Moments counted by hand and the watches over them, and signs that rule
//! settings out: on a made-up AT machine, which has no bonus to watch over.

#![allow(clippy::expect_used, clippy::indexing_slicing)]

mod support;

use std::collections::BTreeSet;
use std::num::NonZeroU32;

use pachislot_domain::normalized::NormalizedSpec;
use pachislot_domain::observation::Segment;
use pachislot_domain::spec::{Component, Mirror, Over, Spec};
use pachislot_engine::error::{InferenceError, SpecError};
use pachislot_engine::normalize::normalize;
use pachislot_engine::posterior::posterior;
use support::{at_spec, close, id, per, percent, setting_level};

/// The made-up AT machine with, beside it: a CZ inside the AT counted by
/// hand, won 50% of the time under setting 1 and 60% under 6; the screen
/// at each AT's end, which shows one of two certainly; and a sign seen
/// under setting 6 alone.
fn counted_spec() -> Spec {
    let mut spec = at_spec();
    spec.entities.extend(
        [
            "cz-in-at",
            "cz-in-at-outcome",
            "cz-in-at-won",
            "at-ended",
            "at-end-screen",
            "screen-plain",
            "screen-rare",
            "six-sign",
        ]
        .into_iter()
        .map(id),
    );
    let components = &mut spec.components;
    components.moment.insert(id("cz-in-at"));
    components.moment.insert(id("at-ended"));
    components
        .watch
        .insert(id("cz-in-at-outcome"), id("cz-in-at"));
    components.watch.insert(id("at-end-screen"), id("at-ended"));
    components
        .cue
        .insert(id("cz-in-at-won"), id("cz-in-at-outcome"));
    components
        .cue
        .insert(id("screen-plain"), id("at-end-screen"));
    components
        .cue
        .insert(id("screen-rare"), id("at-end-screen"));
    components
        .chance
        .insert(id("cz-in-at-won"), per(percent(5_000), percent(6_000)));
    components
        .chance
        .insert(id("screen-plain"), per(percent(9_000), percent(8_000)));
    components
        .chance
        .insert(id("screen-rare"), per(percent(1_000), percent(2_000)));
    components
        .sign
        .insert(id("six-sign"), BTreeSet::from([setting_level(6)]));
    spec
}

fn counted() -> NormalizedSpec {
    normalize(&counted_spec()).expect("normalises")
}

fn stretch(games: u32, counts: &[(&str, u32)]) -> Segment {
    Segment {
        games,
        counts: counts
            .iter()
            .map(|(name, count)| (id(name), *count))
            .collect(),
    }
}

#[test]
fn an_at_machine_normalises_its_moments_watches_over_them_and_signs() {
    let normalized = counted();
    assert_eq!(normalized.moments, vec![id("cz-in-at"), id("at-ended")]);
    assert_eq!(normalized.signs, vec![id("six-sign")]);
    let over = normalized
        .watches
        .iter()
        .map(|watch| (watch.id.as_str(), watch.over.clone(), watch.whole))
        .collect::<Vec<_>>();
    assert_eq!(
        over,
        vec![
            ("cz-in-at-outcome", Over::Moment(id("cz-in-at")), false),
            ("at-end-screen", Over::Moment(id("at-ended")), true)
        ]
    );
    assert_eq!(normalized.tables[0].signs, Vec::new());
    assert_eq!(normalized.tables[1].signs, vec![id("six-sign")]);
}

#[test]
fn a_moment_watched_weighs_every_trial_of_it_by_hand() {
    let found = posterior(
        &counted(),
        None,
        &[stretch(500, &[("cz-in-at", 10), ("cz-in-at-won", 7)])],
        None,
    )
    .expect("infers");
    let low = 0.5_f64.powi(7) * 0.5_f64.powi(3);
    let high = 0.6_f64.powi(7) * 0.4_f64.powi(3);
    assert!(close(found.setting_levels[0].1, low / (low + high)));
}

#[test]
fn a_moment_by_itself_says_nothing_and_is_no_regular_game() {
    let found =
        posterior(&counted(), None, &[stretch(5, &[("cz-in-at", 40)])], None).expect("infers");
    assert!(close(found.setting_levels[0].1, 0.5));
}

#[test]
fn a_certain_watch_over_a_moment_weighs_the_trials_whose_cue_was_counted() {
    let found = posterior(
        &counted(),
        None,
        &[stretch(100, &[("screen-plain", 3), ("screen-rare", 1)])],
        None,
    )
    .expect("infers");
    let low = 0.9_f64.powi(3) * 0.1;
    let high = 0.8_f64.powi(3) * 0.2;
    assert!(close(found.setting_levels[0].1, low / (low + high)));
}

#[test]
fn cues_never_outnumber_the_moments_they_are_watched_over() {
    assert_eq!(
        posterior(
            &counted(),
            None,
            &[stretch(100, &[("cz-in-at", 2), ("cz-in-at-won", 3)])],
            None,
        ),
        Err(InferenceError::CuesExceedTrials {
            segment: 0,
            id: id("cz-in-at-outcome")
        })
    );
}

#[test]
fn a_sign_seen_rules_out_the_settings_it_is_never_seen_under() {
    let found =
        posterior(&counted(), None, &[stretch(100, &[("six-sign", 1)])], None).expect("infers");
    assert!(close(found.setting_levels[0].1, 0.0));
    assert!(close(found.setting_levels[1].1, 1.0));
    let unseen =
        posterior(&counted(), None, &[stretch(100, &[("six-sign", 0)])], None).expect("infers");
    assert!(close(unseen.setting_levels[0].1, 0.5));
}

#[test]
fn a_sign_names_a_setting_the_machine_has_and_nothing_a_game_pays() {
    let mut beyond = counted_spec();
    beyond
        .components
        .sign
        .insert(id("six-sign"), BTreeSet::from([setting_level(4)]));
    assert_eq!(
        normalize(&beyond),
        Err(SpecError::UnknownSettingLevel {
            at: id("six-sign"),
            setting_level: setting_level(4)
        })
    );
    let mut empty = counted_spec();
    empty
        .components
        .sign
        .insert(id("six-sign"), BTreeSet::new());
    assert_eq!(
        normalize(&empty),
        Err(SpecError::MissingComponent {
            entity: id("six-sign"),
            component: Component::Sign
        })
    );
    let mut chanced = counted_spec();
    chanced
        .components
        .chance
        .insert(id("six-sign"), per(percent(100), percent(200)));
    assert_eq!(
        normalize(&chanced),
        Err(SpecError::ConflictingComponents {
            entity: id("six-sign"),
            first: Component::Sign,
            second: Component::Chance
        })
    );
}

#[test]
fn a_moment_has_no_chance_of_its_own() {
    let mut chanced = counted_spec();
    chanced
        .components
        .chance
        .insert(id("cz-in-at"), per(percent(100), percent(200)));
    assert_eq!(
        normalize(&chanced),
        Err(SpecError::ConflictingComponents {
            entity: id("cz-in-at"),
            first: Component::Moment,
            second: Component::Chance
        })
    );
    let trials = NonZeroU32::new(2).expect("trials");
    let mut watched_twice = counted_spec();
    watched_twice
        .components
        .trials
        .insert(id("cz-in-at-outcome"), trials);
    let normalized = normalize(&watched_twice).expect("normalises");
    assert_eq!(normalized.watches[0].trials, trials);
}

#[test]
fn a_moment_of_an_at_machine_may_mirror_an_event_of_the_play_record() {
    let mut mirrored = counted_spec();
    mirrored
        .components
        .mirror
        .insert(id("cz-in-at"), Mirror::Trigger);
    let normalized = normalize(&mirrored).expect("normalises");
    assert_eq!(normalized.mirrors, vec![(id("cz-in-at"), Mirror::Trigger)]);
    let mut astray = counted_spec();
    astray
        .components
        .mirror
        .insert(id("cz-in-at-won"), Mirror::AtWon);
    assert_eq!(
        normalize(&astray),
        Err(SpecError::MissingComponent {
            entity: id("cz-in-at-won"),
            component: Component::Moment
        })
    );
}

#[test]
fn a_moment_of_a_machine_of_bonuses_mirrors_nothing() {
    let mut bonuses = support::watched_spec();
    bonuses.entities.push(id("big-ended"));
    bonuses.components.moment.insert(id("big-ended"));
    bonuses
        .components
        .mirror
        .insert(id("big-ended"), Mirror::AtWon);
    assert_eq!(
        normalize(&bonuses),
        Err(SpecError::MirrorWithoutAt {
            entity: id("big-ended")
        })
    );
}
