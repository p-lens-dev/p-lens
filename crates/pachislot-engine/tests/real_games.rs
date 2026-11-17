#![allow(clippy::expect_used)]

mod support;

use std::num::NonZeroU32;

use pachislot_domain::spec::LcdRate;
use pachislot_engine::normalize::normalize;
use support::{ceiled, cz_spec, id};

fn games(count: u32) -> NonZeroU32 {
    NonZeroU32::new(count).expect("games")
}

/// The CZ machine with an AT間天井 of 1000 games beside the CZ's 600.
fn with_at_ceiling() -> pachislot_domain::spec::Spec {
    let mut spec = cz_spec();
    spec.components.ceiling.insert(id("at"), games(1_000));
    spec
}

#[test]
fn ceilings_counting_every_game_come_sooner_by_the_cz_s_games() {
    let mut spec = with_at_ceiling();
    spec.components.games.insert(id("cz"), games(30));
    let rules = normalize(&spec)
        .expect("normalises")
        .at_rules
        .expect("an AT machine");
    assert_eq!(
        rules.modes,
        vec![ceiled("cz", 500, 834), ceiled("cz:reset", 250, 834)]
    );
}

#[test]
fn ceilings_counting_regular_games_are_as_they_say() {
    let rules = normalize(&with_at_ceiling())
        .expect("normalises")
        .at_rules
        .expect("an AT machine");
    assert_eq!(
        rules.modes,
        vec![ceiled("cz", 600, 1_000), ceiled("cz:reset", 300, 1_000)]
    );
}

#[test]
fn a_screen_s_own_games_and_the_cz_s_add_up() {
    let mut spec = with_at_ceiling();
    spec.components.games.insert(id("cz"), games(30));
    spec.resources.lcd_rate = LcdRate::new(1.25);
    let rules = normalize(&spec)
        .expect("normalises")
        .at_rules
        .expect("an AT machine");
    assert_eq!(
        rules.modes,
        vec![ceiled("cz", 414, 834), ceiled("cz:reset", 207, 834)]
    );
}

#[test]
fn games_belong_to_a_cz_or_a_side_bonus() {
    let mut spec = with_at_ceiling();
    spec.components.games.insert(id("at"), games(30));
    assert!(normalize(&spec).is_err());
}
