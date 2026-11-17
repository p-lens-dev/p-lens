#![allow(clippy::expect_used, clippy::float_cmp)]

mod support;

use pachislot_domain::normalized::{AtTable, NormalizedSpec};
use pachislot_domain::setting_level::PerSettingLevel;
use pachislot_domain::spec::{Base, Spec};
use pachislot_engine::error::SpecError;
use pachislot_engine::hunt::hunt;
use pachislot_engine::normalize::normalize;
use support::{at_spec, close, id, made_up_spec, setting_level, start};

fn base(games: f64) -> Base {
    Base::new(games).expect("a base")
}

fn bases(low: f64, high: f64) -> PerSettingLevel<Base> {
    PerSettingLevel(vec![
        (setting_level(1), base(low)),
        (setting_level(6), base(high)),
    ])
}

fn with_machine_base(games: Option<f64>) -> Spec {
    let mut spec = at_spec();
    spec.resources.base = games.map(base);
    spec
}

fn with_bases(machine: Option<f64>, low: f64, high: f64) -> Spec {
    let mut spec = with_machine_base(machine);
    spec.components.base.insert(id("at"), bases(low, high));
    spec
}

fn at_table(spec: &NormalizedSpec, setting: u8) -> &AtTable {
    spec.table(setting_level(setting))
        .and_then(|table| table.at.as_ref())
        .expect("an AT machine's table")
}

/// What a seat at the start of play comes to under a setting, in medals.
fn hunted(spec: &Spec, setting: u8) -> f64 {
    let normalized = normalize(spec).expect("normalises");
    let rules = normalized.at_rules.as_ref().expect("an AT machine");
    hunt(start(0, 0, 0), rules, at_table(&normalized, setting))
        .expect("the AT comes")
        .medals
}

#[test]
fn each_setting_is_played_at_its_own_base() {
    let own = with_bases(None, 36.0, 44.0);
    assert!(close(hunted(&own, 1), hunted(&with_machine_base(Some(36.0)), 1)));
    assert!(close(hunted(&own, 6), hunted(&with_machine_base(Some(44.0)), 6)));
    assert!(hunted(&own, 6) > hunted(&with_machine_base(Some(36.0)), 6));
}

#[test]
fn a_setting_given_its_own_base_takes_it_over_the_machines() {
    let both = with_bases(Some(40.0), 36.0, 44.0);
    assert!(close(hunted(&both, 6), hunted(&with_machine_base(Some(44.0)), 6)));
}

#[test]
fn the_same_base_everywhere_comes_to_what_one_base_does() {
    let alike = with_bases(None, 40.0, 40.0);
    let one = with_machine_base(Some(40.0));
    assert_eq!(hunted(&alike, 1), hunted(&one, 1));
    assert_eq!(hunted(&alike, 6), hunted(&one, 6));
    let normalized = normalize(&one).expect("normalises");
    assert_eq!(at_table(&normalized, 6).base, None);
}

#[test]
fn bases_by_setting_cover_every_setting_and_belong_to_the_at() {
    let mut partial = with_machine_base(Some(40.0));
    partial.components.base.insert(
        id("at"),
        PerSettingLevel(vec![(setting_level(1), base(36.0))]),
    );
    assert_eq!(
        normalize(&partial),
        Err(SpecError::MissingSettingLevel {
            at: id("at"),
            setting_level: setting_level(6),
        })
    );

    let mut bonus_machine = made_up_spec();
    bonus_machine
        .components
        .base
        .insert(id("big"), bases(36.0, 44.0));
    assert!(normalize(&bonus_machine).is_err());

    assert_eq!(
        normalize(&with_machine_base(None)),
        Err(SpecError::MissingBase)
    );
}
