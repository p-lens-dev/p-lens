#![allow(clippy::expect_used)]

//! A mode's properties combine apart from its kind: whether its spins count
//! toward the 遊タイム, whether they are queued already, a c時短 on any mode
//! whose spins run out, and the mode its combo is counted as part of. Each
//! combination is checked against what already meant it, which the engine
//! solved before.

mod support;

use pachinko_domain::conditions::{CalculationConditions, RoundPayout, SupportDrift};
use pachinko_domain::probability::BasisPoints;
use pachinko_domain::quantity::SpinCount;
use pachinko_domain::spec::{
    Component, EarlyEnd, EarlyEndShare, Next, Rapid, RegularPlay, ReliefDrive, Spec,
};
use pachinko_engine::analysis::analyze;
use pachinko_engine::error::{SpecError, Unsupported};
use pachinko_engine::normalize::normalize;
use support::*;

/// 1/300, every first jackpot 10R into mode `M`, which goes back to the
/// regular game, and a 遊タイム of 500 spins into a 時短 of 1,000.
fn with(kind: Kind) -> Spec {
    let regular = RegularPlay {
        chance: one_in(300),
        allotment: vec![share(10_000, 10, to("M"))],
        relief_drive: Some(ReliefDrive {
            gauge: SpinCount::new(nonzero(500)),
            to: id("遊タイム"),
        }),
        early_end: None,
    };
    assemble(
        &regular,
        vec![
            mode("M", kind, vec![share(10_000, 10, to("M"))], Next::Regular),
            mode(
                "遊タイム",
                rapid(1000),
                vec![share(10_000, 10, to("M"))],
                Next::Regular,
            ),
        ],
    )
}

fn rapid_at(count: u32, chance: u32) -> Kind {
    Kind::Rapid(Rapid {
        spins: SpinCount::new(nonzero(count)),
        chance: Some(one_in(chance)),
    })
}

fn counted(mut spec: Spec, counts: bool) -> Spec {
    spec.components.relief_counted.insert(id("M"), counts);
    spec
}

fn queued(mut spec: Spec) -> Spec {
    spec.components.queued.insert(id("M"));
    spec
}

fn ending_early(mut spec: Spec) -> Spec {
    spec.components.early_end.insert(
        id("M"),
        EarlyEnd {
            chance: one_in(100),
            to: vec![EarlyEndShare {
                share: BasisPoints::new(10_000).expect("whole"),
                next: Next::Regular,
            }],
        },
    );
    spec
}

#[test]
fn an_st_counted_fills_the_gauge_as_a_rapid_mode_at_its_chance() {
    let st = normalize(&counted(with(special_time(100, one_in(50))), true));
    assert_eq!(st, normalize(&with(rapid_at(100, 50))));
    assert_ne!(st, normalize(&with(special_time(100, one_in(50)))));
}

#[test]
fn a_rapid_mode_not_counted_fills_none_as_an_st_at_the_regular_chance() {
    assert_eq!(
        normalize(&counted(with(rapid(100)), false)),
        normalize(&with(special_time(100, one_in(300))))
    );
}

#[test]
fn a_kind_said_to_count_as_it_does_already_is_the_kind() {
    assert_eq!(
        normalize(&counted(with(rapid(100)), true)),
        normalize(&with(rapid(100)))
    );
    assert_eq!(
        normalize(&counted(with(special_time(100, one_in(50))), false)),
        normalize(&with(special_time(100, one_in(50))))
    );
}

#[test]
fn a_rapid_mode_queued_at_the_regular_chance_is_a_leftover_queue() {
    assert_eq!(
        normalize(&queued(with(rapid(4)))),
        normalize(&with(leftover_queue(4)))
    );
}

#[test]
fn a_rapid_mode_queued_at_a_chance_of_its_own_is_drawn_at_it_off_the_support() {
    let normalized = normalize(&queued(with(rapid_at(4, 7)))).expect("normalises");
    let state = normalized
        .origins
        .iter()
        .position(|origin| origin.mode == id("M"))
        .and_then(|index| normalized.states.get(index))
        .expect("the mode's state");
    assert!(!state.supported);
    assert!(state.paid.is_none());
    let missed: f64 = 1.0 - 1.0 / 7.0;
    let won: f64 = state
        .outcomes
        .iter()
        .filter(|outcome| outcome.reward.hits > 0)
        .map(|outcome| outcome.probability.value())
        .sum();
    assert!(close(won, 1.0 - missed.powi(4)));
}

#[test]
fn an_early_end_on_an_st_is_one_on_a_rapid_mode_at_its_chance_not_counted() {
    let st = normalize(&ending_early(with(special_time(100, one_in(50))))).expect("normalises");
    let rapid_mode = normalize(&counted(ending_early(with(rapid_at(100, 50))), false));
    assert_eq!(Ok(st.clone()), rapid_mode);
    let state = st
        .origins
        .iter()
        .position(|origin| origin.mode == id("M"))
        .and_then(|index| st.states.get(index))
        .expect("the mode's state");
    assert!(
        state
            .outcomes
            .iter()
            .filter(|outcome| outcome.fills.is_some())
            .all(|outcome| outcome.fills == Some(0))
    );
}

#[test]
fn an_early_end_on_a_leftover_queue_is_read() {
    assert!(normalize(&ending_early(with(leftover_queue(4)))).is_ok());
}

#[test]
fn the_properties_belong_to_modes_whose_spins_run_out() {
    let mut on_regular = with(rapid(100));
    on_regular
        .components
        .relief_counted
        .insert(id("regular"), true);
    assert_eq!(
        normalize(&on_regular),
        Err(SpecError::StrayComponent {
            entity: id("regular"),
            component: Component::ReliefCounted,
        })
    );
    let mut queued_regular = with(rapid(100));
    queued_regular.components.queued.insert(id("regular"));
    assert_eq!(
        normalize(&queued_regular),
        Err(SpecError::StrayComponent {
            entity: id("regular"),
            component: Component::Queued,
        })
    );
    assert_eq!(
        normalize(&queued(with(rushing(80)))),
        Err(SpecError::StrayComponent {
            entity: id("M"),
            component: Component::Queued,
        })
    );
    assert_eq!(
        normalize(&counted(with(Kind::UntilHit), true)),
        Err(SpecError::StrayComponent {
            entity: id("M"),
            component: Component::ReliefCounted,
        })
    );
    assert_eq!(
        normalize(&ending_early(with(rushing(80)))),
        Err(SpecError::StrayComponent {
            entity: id("M"),
            component: Component::EarlyEnd,
        })
    );
}

#[test]
fn queued_spins_are_never_shot_and_paid_for_too() {
    let mut both = queued(with(rapid(4)));
    both.components.without_support.insert(id("M"));
    assert_eq!(
        normalize(&both),
        Err(SpecError::ConflictingComponents {
            entity: id("M"),
            first: Component::WithoutSupport,
            second: Component::Queued,
        })
    );
}

/// 1/300, every first jackpot 10R into an ST of 100 at 1/50, every jackpot
/// there 10R back into it, the third of a combo into an LT continuing 90%.
fn whole_rush() -> Spec {
    machine(
        one_in(300),
        vec![share(10_000, 10, to("RUSH"))],
        vec![
            triggering(
                mode(
                    "RUSH",
                    special_time(100, one_in(50)),
                    vec![share(10_000, 10, to("RUSH"))],
                    Next::Regular,
                ),
                3,
                "LT",
            ),
            mode(
                "LT",
                rushing(90),
                vec![share(10_000, 10, to("LT"))],
                Next::Regular,
            ),
        ],
    )
}

/// The same RUSH split into its first spin and the 99 after it, the first
/// counted as part of the rest, which has the lucky trigger: every jackpot
/// enters the first spin again, and its miss goes on to the rest.
fn split_rush() -> Spec {
    let mut spec = machine(
        one_in(300),
        vec![share(10_000, 10, to("RUSH1"))],
        vec![
            mode(
                "RUSH1",
                special_time(1, one_in(50)),
                vec![share(10_000, 10, to("RUSH1"))],
                to("RUSH"),
            ),
            triggering(
                mode(
                    "RUSH",
                    special_time(99, one_in(50)),
                    vec![share(10_000, 10, to("RUSH1"))],
                    Next::Regular,
                ),
                3,
                "LT",
            ),
            mode(
                "LT",
                rushing(90),
                vec![share(10_000, 10, to("LT"))],
                Next::Regular,
            ),
        ],
    );
    spec.components.combo_of.insert(id("RUSH1"), id("RUSH"));
    spec
}

const FROM_SPEC: CalculationConditions = CalculationConditions {
    round_payout: RoundPayout::FromSpec,
    support_drift: SupportDrift::NONE,
};

fn round_chance(spec: &Spec) -> f64 {
    let normalized = normalize(spec).expect("normalises");
    analyze(&normalized, &FROM_SPEC)
        .expect("solves")
        .round_chance
        .value()
}

#[test]
fn a_mode_split_with_its_combo_counted_as_one_comes_to_the_whole() {
    assert!(close(
        round_chance(&split_rush()),
        round_chance(&whole_rush())
    ));
}

#[test]
fn a_split_mode_counting_its_combo_apart_never_reaches_its_lucky_trigger() {
    let mut apart = split_rush();
    apart.components.combo_of.clear();
    assert!(matches!(
        normalize(&apart),
        Err(SpecError::UnreachableState { .. })
    ));
}

#[test]
fn a_combo_is_counted_as_part_of_one_mode_that_is_part_of_none() {
    let mut chained = split_rush();
    chained.components.combo_of.insert(id("LT"), id("RUSH1"));
    assert_eq!(
        normalize(&chained),
        Err(SpecError::UnsupportedSpec {
            reason: Unsupported::ComboOfPart
        })
    );
    let mut itself = split_rush();
    itself.components.combo_of.insert(id("RUSH1"), id("RUSH1"));
    assert_eq!(
        normalize(&itself),
        Err(SpecError::UnsupportedSpec {
            reason: Unsupported::ComboOfPart
        })
    );
    let mut nowhere = split_rush();
    nowhere.components.combo_of.insert(id("RUSH1"), id("CZ"));
    assert!(matches!(
        normalize(&nowhere),
        Err(SpecError::UnknownMode { .. })
    ));
}

#[test]
fn a_part_of_a_count_has_no_lucky_trigger_of_its_own() {
    let mut both = split_rush();
    both.components.lucky_trigger.insert(
        id("RUSH1"),
        pachinko_domain::spec::LuckyTrigger {
            at_combo: nonzero(3),
            to: id("LT"),
        },
    );
    assert_eq!(
        normalize(&both),
        Err(SpecError::ConflictingComponents {
            entity: id("RUSH1"),
            first: Component::LuckyTrigger,
            second: Component::ComboOf,
        })
    );
    let mut on_regular = split_rush();
    on_regular
        .components
        .combo_of
        .insert(id("regular"), id("RUSH"));
    assert_eq!(
        normalize(&on_regular),
        Err(SpecError::StrayComponent {
            entity: id("regular"),
            component: Component::ComboOf,
        })
    );
}
