#![allow(clippy::expect_used)]

mod support;

use pachinko_domain::conditions::{CalculationConditions, RoundPayout, SupportDrift};
use pachinko_domain::quantity::{Balls, RoundCount, SpinCount};
use pachinko_domain::spec::{Allotment, Next, OtherRounds};
use pachinko_engine::analysis::{Analysis, analyze};
use pachinko_engine::normalize::normalize;
use proptest::prelude::*;
use support::*;

const FROM_SPEC: CalculationConditions = CalculationConditions {
    round_payout: RoundPayout::FromSpec,
    support_drift: SupportDrift::NONE,
};

fn solved(spec: &pachinko_domain::spec::Spec) -> Analysis {
    let normalized = normalize(spec).expect("the test spec normalises");
    analyze(&normalized, &FROM_SPEC).expect("a normalised spec solves")
}

#[test]
fn the_made_up_machine_comes_to_what_it_does_by_hand() {
    let analysis = solved(&made_up());
    assert!(
        close(analysis.average_rounds, 30.0),
        "rounds {}",
        analysis.average_rounds
    );
    assert!(
        close(analysis.average_combo, 3.0),
        "hits {}",
        analysis.average_combo
    );
    assert!(close(analysis.average_payout.value(), 4200.0));
    assert!(close(analysis.total_chance.value(), 100.0 / 3.0));
    assert!(close(analysis.round_chance.value(), 100.0 / 30.0));
    assert_eq!(analysis.mode_entry.len(), 1);
    assert!(
        analysis
            .mode_entry
            .iter()
            .all(|entry| entry.mode.as_str() == "RUSH" && close(entry.probability, 0.5))
    );
}

#[test]
fn a_measured_round_payout_replaces_the_sheet() {
    let conditions = CalculationConditions {
        round_payout: RoundPayout::Measured(Balls::new(130.0).expect("finite")),
        support_drift: SupportDrift::NONE,
    };
    let normalized = normalize(&made_up()).expect("normalises");
    let analysis = analyze(&normalized, &conditions).expect("solves");
    assert!(close(analysis.average_payout.value(), 30.0 * 130.0));
}

/// The made-up machine with its first jackpots through a ten-ball attacker:
/// 1/100, a first jackpot of 4R at 90 a round, half of them into a RUSH that
/// continues at 80% with 10R at 140 a round.
fn two_attackers() -> pachinko_domain::spec::Spec {
    machine(
        one_in(100),
        vec![
            share_paying(5000, 4, 10, to("RUSH")),
            share_paying(5000, 4, 10, Next::Regular),
        ],
        vec![mode(
            "RUSH",
            rushing(80),
            vec![share(10_000, 10, to("RUSH"))],
            Next::Regular,
        )],
    )
}

#[test]
fn a_share_with_a_prize_of_its_own_pays_its_rounds_by_it() {
    let analysis = solved(&two_attackers());
    let rounds = 4.0 + 0.5 * 40.0;
    let balls = 4.0 * 90.0 + 0.5 * 40.0 * 140.0;
    assert!(close(analysis.average_rounds, rounds));
    assert!(close(analysis.average_payout.value(), balls));
    assert!(close(analysis.round_chance.value(), 100.0 / rounds));
    assert!(close(analysis.balls_per_round.value(), balls / rounds));
    assert!(close(
        analysis.balls_per_round.value() / analysis.round_chance.value(),
        balls / 100.0
    ));
}

/// The made-up machine with a V round before every first jackpot's rounds:
/// 1/100, one round through a one-ball attacker of ten counts that gains
/// nothing, then 3R at 140 a round, half of them into a RUSH that continues
/// at 80% with a 10R whose last two rounds take five counts of twelve balls.
fn two_attackers_in_one_jackpot() -> pachinko_domain::spec::Spec {
    let first = |next| Allotment {
        prize_balls: Some(nonzero(1)),
        other_rounds: vec![OtherRounds {
            rounds: RoundCount::new(3),
            prize_balls: None,
            count: None,
        }],
        ..share(5000, 1, next)
    };
    machine(
        one_in(100),
        vec![first(to("RUSH")), first(Next::Regular)],
        vec![mode(
            "RUSH",
            rushing(80),
            vec![Allotment {
                other_rounds: vec![other_rounds(2, 12, 5)],
                ..share(10_000, 8, to("RUSH"))
            }],
            Next::Regular,
        )],
    )
}

#[test]
fn a_jackpot_through_two_attackers_counts_every_round_and_pays_each_by_its_own() {
    let analysis = solved(&two_attackers_in_one_jackpot());
    let rounds = 4.0 + 0.5 * 40.0;
    let rush = 8.0 * 140.0 + 2.0 * 55.0;
    let balls = 3.0 * 140.0 + 0.5 * 4.0 * rush;
    assert!(close(analysis.average_rounds, rounds));
    assert!(close(analysis.average_payout.value(), balls));
    assert!(close(analysis.balls_per_round.value(), balls / rounds));
}

/// The made-up machine whose RUSH gives its jackpots two at a time: 1/100, a
/// 10R first jackpot, half of them into a RUSH that continues at 80% with
/// 20R won over two jackpots of ten.
fn a_run_of_jackpots_as_one_win() -> pachinko_domain::spec::Spec {
    machine(
        one_in(100),
        vec![share(5000, 10, to("RUSH")), share(5000, 10, Next::Regular)],
        vec![mode(
            "RUSH",
            rushing(80),
            vec![Allotment {
                jackpots: nonzero(2),
                ..share(10_000, 20, to("RUSH"))
            }],
            Next::Regular,
        )],
    )
}

#[test]
fn a_share_won_over_several_jackpots_counts_each_and_pays_no_more_for_it() {
    let analysis = solved(&a_run_of_jackpots_as_one_win());
    let wins = 0.5 * 4.0;
    assert!(close(analysis.average_rounds, 10.0 + wins * 20.0));
    assert!(close(analysis.average_combo, 1.0 + wins * 2.0));
    assert!(close(analysis.average_payout.value(), 50.0 * 140.0));
    assert!(close(analysis.total_chance.value(), 100.0 / 5.0));
    assert!(close(analysis.round_chance.value(), 100.0 / 50.0));
}

#[test]
fn a_measured_round_scales_every_share_alike() {
    let conditions = CalculationConditions {
        round_payout: RoundPayout::Measured(Balls::new(126.0).expect("finite")),
        support_drift: SupportDrift::NONE,
    };
    let normalized = normalize(&two_attackers()).expect("normalises");
    let analysis = analyze(&normalized, &conditions).expect("solves");
    assert!(close(analysis.payout_scale, 0.9));
    assert!(close(
        analysis.average_payout.value(),
        0.9 * (4.0 * 90.0 + 0.5 * 40.0 * 140.0)
    ));
}

#[test]
fn an_st_continues_with_the_chance_of_a_hit_within_its_spins() {
    let spec = machine(
        one_in(100),
        vec![share(10_000, 10, to("ST"))],
        vec![mode(
            "ST",
            special_time(100, one_in(50)),
            vec![share(10_000, 10, to("ST"))],
            Next::Regular,
        )],
    );
    let q = 1.0 - (49.0_f64 / 50.0).powi(100);
    let analysis = solved(&spec);
    assert!(close(analysis.average_combo, 1.0 + q / (1.0 - q)));
}

#[test]
fn an_st_that_runs_into_a_rapid_mode_combos_through_both() {
    let spec = machine(
        one_in(100),
        vec![share(10_000, 10, to("ST"))],
        vec![
            mode(
                "ST",
                special_time(50, one_in(50)),
                vec![share(10_000, 10, to("ST"))],
                to("時短"),
            ),
            mode(
                "時短",
                rapid(50),
                vec![share(10_000, 10, to("ST"))],
                Next::Regular,
            ),
        ],
    );
    let st = 1.0 - (49.0_f64 / 50.0).powi(50);
    let rapid = 1.0 - (99.0_f64 / 100.0).powi(50);
    let again = st + (1.0 - st) * rapid;
    let analysis = solved(&spec);
    assert!(close(analysis.average_combo, 1.0 + again / (1.0 - again)));
    assert!(
        analysis
            .mode_entry
            .iter()
            .any(|entry| entry.mode.as_str() == "時短" && close(entry.probability, 1.0)),
        "every run of ST ends in a miss, and every miss goes into 時短"
    );
}

#[test]
fn a_lucky_trigger_counts_the_combo_within_the_mode() {
    let rush = triggering(
        mode(
            "RUSH",
            rushing(50),
            vec![share(10_000, 3, to("RUSH"))],
            Next::Regular,
        ),
        3,
        "LT",
    );
    let lt = mode(
        "LT",
        rushing(90),
        vec![share(10_000, 10, to("LT"))],
        Next::Regular,
    );
    let spec = machine(
        one_in(100),
        vec![share(10_000, 3, to("RUSH"))],
        vec![rush, lt],
    );
    let analysis = solved(&spec);
    let reach_lt = 0.5 * 0.5;
    let lt_hits = 0.9 / 0.1;
    assert!(
        analysis
            .mode_entry
            .iter()
            .any(|entry| entry.mode.as_str() == "LT" && close(entry.probability, reach_lt))
    );
    assert!(close(
        analysis.average_combo,
        1.0 + 0.5 + reach_lt + reach_lt * lt_hits
    ));
    assert!(close(
        analysis.average_rounds,
        3.0 + 0.5 * 3.0 + reach_lt * 3.0 + reach_lt * lt_hits * 10.0
    ));
}

#[test]
fn every_state_is_explained_by_where_it_came_from() {
    let analysis = solved(&made_up());
    let rush = analysis.derivation.first().expect("the RUSH state");
    assert_eq!(rush.origin.mode.as_str(), "RUSH");
    assert!(close(rush.average_rounds, 40.0));
    assert!(close(rush.average_combo, 4.0));
}

#[test]
fn the_same_spec_always_solves_the_same() {
    assert_eq!(solved(&made_up()), solved(&made_up()));
}

proptest! {
    #[test]
    fn a_continuation_rush_matches_its_closed_form(
        entry in 1u32..=10_000,
        rate in 1u32..=95,
        first_rounds in 1u32..=16,
        rush_rounds in 1u32..=16,
    ) {
        let allotment = if entry == 10_000 {
            vec![share(10_000, first_rounds, to("RUSH"))]
        } else {
            vec![share(10_000 - entry, first_rounds, Next::Regular), share(entry, first_rounds, to("RUSH"))]
        };
        let spec = machine(one_in(300), allotment, vec![mode("RUSH", rushing(rate), vec![share(10_000, rush_rounds, to("RUSH"))], Next::Regular)]);
        let e = f64::from(entry) / 10_000.0;
        let r = f64::from(rate) / 100.0;
        let analysis = solved(&spec);
        prop_assert!(close(analysis.average_combo, 1.0 + e * r / (1.0 - r)));
        prop_assert!(close(analysis.average_rounds, f64::from(first_rounds) + e * r * f64::from(rush_rounds) / (1.0 - r)));
        prop_assert!(close(analysis.total_chance.value(), 300.0 / analysis.average_combo));
    }
}

const LESS_A_THIRD: CalculationConditions = CalculationConditions {
    round_payout: RoundPayout::FromSpec,
    support_drift: match SupportDrift::new(-30) {
        Some(drift) => drift,
        None => SupportDrift::NONE,
    },
};

fn under(spec: &pachinko_domain::spec::Spec, conditions: &CalculationConditions) -> Analysis {
    let normalized = normalize(spec).expect("the test spec normalises");
    analyze(&normalized, conditions).expect("a normalised spec solves")
}

/// The made-up machine with its RUSH lasting a hundred spins: the 80% won
/// within them at one chance a spin, so many spins played there on average.
fn rush_of_a_hundred_spins() -> (pachinko_domain::spec::Spec, f64) {
    let mut spec = made_up();
    if let Some(rushing) = spec.components.rushing.get_mut(&id("RUSH")) {
        rushing.spins = Some(SpinCount::new(nonzero(100)));
    }
    let chance = 1.0 - 0.2_f64.powf(1.0 / 100.0);
    (spec, 0.8 / chance)
}

#[test]
fn a_support_drift_changes_the_balls_by_each_spin_on_the_support() {
    let (spec, per_visit) = rush_of_a_hundred_spins();
    let analysis = under(&spec, &LESS_A_THIRD);
    let spins = 0.5 / (1.0 - 0.8) * per_visit;
    assert!(close(analysis.average_payout.value(), 4200.0 - 0.3 * spins));
    assert!(close(analysis.average_rounds, 30.0));
    assert!(close(analysis.average_combo, 3.0));
    assert!(close(
        analysis.balls_per_round.value(),
        (4200.0 - 0.3 * spins) / 30.0
    ));
}

#[test]
fn an_st_plays_until_a_jackpot_or_its_last_spin() {
    let spec = machine(
        one_in(100),
        vec![share(10_000, 10, to("ST"))],
        vec![mode(
            "ST",
            special_time(100, one_in(50)),
            vec![share(10_000, 10, to("ST"))],
            Next::Regular,
        )],
    );
    let missed = 0.98_f64.powi(100);
    let visits = 1.0 / missed;
    let spins = visits * (1.0 - missed) * 50.0;
    assert!(close(
        under(&spec, &LESS_A_THIRD).average_payout.value(),
        1400.0 * visits - 0.3 * spins
    ));
}

#[test]
fn a_loop_plays_until_a_jackpot_at_the_chance_it_says() {
    let mut spec = machine(
        one_in(100),
        vec![share(10_000, 10, to("loop"))],
        vec![mode(
            "loop",
            Kind::UntilHit,
            vec![share(5000, 10, to("loop")), share(5000, 10, Next::Regular)],
            Next::Regular,
        )],
    );
    spec.components
        .until_hit_chance
        .insert(id("loop"), one_in(10));
    assert!(close(
        under(&spec, &LESS_A_THIRD).average_payout.value(),
        1400.0 * 3.0 - 0.3 * 20.0
    ));
}

#[test]
fn a_drift_is_refused_where_a_state_on_the_support_tells_no_spins() {
    let normalized = normalize(&made_up()).expect("normalises");
    assert_eq!(
        analyze(&normalized, &LESS_A_THIRD),
        Err(pachinko_engine::error::SolveError::UnknownSupportSpins)
    );
    assert!(analyze(&normalized, &FROM_SPEC).is_ok());
}

#[test]
fn a_measured_round_leaves_the_drift_as_it_was_said() {
    let (spec, per_visit) = rush_of_a_hundred_spins();
    let conditions = CalculationConditions {
        round_payout: RoundPayout::Measured(Balls::new(130.0).expect("finite")),
        ..LESS_A_THIRD
    };
    assert!(close(
        under(&spec, &conditions).average_payout.value(),
        30.0 * 130.0 - 0.3 * 2.5 * per_visit
    ));
}

#[test]
fn a_mode_played_without_the_support_is_not_changed_by_it() {
    let mut spec = made_up();
    spec.components.without_support.insert(id("RUSH"));
    assert!(close(
        under(&spec, &LESS_A_THIRD).average_payout.value(),
        4200.0
    ));
}

#[test]
fn a_leftover_queue_is_played_without_the_support() {
    let queued = machine(
        one_in(100),
        vec![share(10_000, 10, to("queue"))],
        vec![mode(
            "queue",
            leftover_queue(4),
            vec![share(10_000, 10, Next::Regular)],
            Next::Regular,
        )],
    );
    assert!(close(
        under(&queued, &LESS_A_THIRD).average_payout.value(),
        under(&queued, &FROM_SPEC).average_payout.value()
    ));
}

#[test]
fn the_regular_game_is_never_played_without_the_support() {
    let mut spec = made_up();
    spec.components.without_support.insert(id("regular"));
    assert_eq!(
        normalize(&spec),
        Err(pachinko_engine::error::SpecError::StrayComponent {
            entity: id("regular"),
            component: pachinko_domain::spec::Component::WithoutSupport,
        })
    );
}

#[test]
fn a_loop_chance_belongs_to_a_loop_alone() {
    let mut spec = made_up();
    spec.components
        .until_hit_chance
        .insert(id("RUSH"), one_in(10));
    assert_eq!(
        normalize(&spec),
        Err(pachinko_engine::error::SpecError::StrayComponent {
            entity: id("RUSH"),
            component: pachinko_domain::spec::Component::UntilHitChance,
        })
    );
}

#[test]
fn a_support_drift_is_at_most_ten_balls_a_spin_either_way() {
    assert_eq!(SupportDrift::new(-1001), None);
    assert_eq!(SupportDrift::new(1001), None);
    assert!(SupportDrift::new(1000).is_some());
    assert!(close(
        SupportDrift::new(-30).map_or(0.0, SupportDrift::balls_per_spin),
        -0.3
    ));
}

/// 1/100 to a 10R into a CZ of twenty spins at 1/50, a jackpot there 10R and
/// back to the regular game: the CZ shot at the heso, its spins paid for.
fn with_a_cz(at_heso: bool) -> pachinko_domain::spec::Spec {
    let mut spec = machine(
        one_in(100),
        vec![share(10_000, 10, to("CZ"))],
        vec![mode(
            "CZ",
            special_time(20, one_in(50)),
            vec![share(10_000, 10, Next::Regular)],
            Next::Regular,
        )],
    );
    if at_heso {
        spec.components.without_support.insert(id("CZ"));
    }
    spec
}

#[test]
fn a_mode_shot_at_the_heso_pays_for_its_spins_as_the_regular_game_does() {
    let won = 1.0 - (49.0_f64 / 50.0).powi(20);
    let played = won * 50.0;
    let rounds = 10.0 + 10.0 * won;
    let paid = solved(&with_a_cz(true));
    assert!(
        close(paid.average_paid_spins, played),
        "paid {}",
        paid.average_paid_spins
    );
    assert!(close(paid.round_chance.value(), (100.0 + played) / rounds));
    assert!(close(
        paid.total_chance.value(),
        (100.0 + played) / (1.0 + won)
    ));
    let free = solved(&with_a_cz(false));
    assert!(close(free.average_paid_spins, 0.0));
    assert!(close(free.round_chance.value(), 100.0 / rounds));
    assert!(close(
        paid.average_payout.value(),
        free.average_payout.value()
    ));
}

/// The made-up machine whose RUSH pays only half its jackpots: 1/100, a 10R
/// first jackpot, half of them into a RUSH that continues at 80%, its
/// jackpots half 10R and half a 0R that pays nothing and stays in the RUSH.
fn a_rush_with_jackpots_of_no_rounds() -> pachinko_domain::spec::Spec {
    machine(
        one_in(100),
        vec![share(5000, 10, to("RUSH")), share(5000, 10, Next::Regular)],
        vec![mode(
            "RUSH",
            rushing(80),
            vec![share(5000, 10, to("RUSH")), share(5000, 0, to("RUSH"))],
            Next::Regular,
        )],
    )
}

#[test]
fn a_jackpot_of_no_rounds_is_counted_and_pays_nothing() {
    let analysis = solved(&a_rush_with_jackpots_of_no_rounds());
    let rush_jackpots = 0.8 / 0.2;
    let rounds = 10.0 + 0.5 * rush_jackpots * 5.0;
    assert!(close(analysis.average_combo, 1.0 + 0.5 * rush_jackpots));
    assert!(close(analysis.average_rounds, rounds));
    assert!(close(analysis.average_payout.value(), rounds * 140.0));
    assert!(close(analysis.total_chance.value(), 100.0 / 3.0));
}

#[test]
fn a_jackpot_of_no_rounds_is_a_jackpot_in_the_combo() {
    let normalized =
        normalize(&a_rush_with_jackpots_of_no_rounds()).expect("the test spec normalises");
    let zero = normalized
        .states
        .iter()
        .flat_map(|state| &state.outcomes)
        .find(|outcome| outcome.reward.rounds == 0 && outcome.reward.hits > 0)
        .expect("the RUSH's 0R is an outcome");
    assert_eq!(zero.reward.balls, 0);
    assert_eq!(zero.reward.hits, 1);
}

/// A regular game at 1/100 whose jackpots are 10R and done, with a c時短 at
/// 1/50 on a spin that is no jackpot into a 時短 of 20 spins at 1/100.
fn with_a_regular_early_end() -> pachinko_domain::spec::Spec {
    let mut spec = machine(
        one_in(100),
        vec![share(10_000, 10, Next::Regular)],
        vec![mode(
            "時短",
            rapid(20),
            vec![share(10_000, 10, Next::Regular)],
            Next::Regular,
        )],
    );
    spec.components.early_end.insert(
        id("regular"),
        pachinko_domain::spec::EarlyEnd {
            chance: one_in(50),
            to: vec![pachinko_domain::spec::EarlyEndShare {
                share: pachinko_domain::probability::BasisPoints::new(10_000).expect("whole"),
                next: to("時短"),
            }],
        },
    );
    spec
}

#[test]
fn a_c_time_shortening_of_the_regular_game_adds_what_its_spins_win_by_hand() {
    let p = 0.01;
    let c = (1.0 - p) * 0.02;
    let won_in_it = 1.0 - 0.99_f64.powi(20);
    let rounds_per_cycle = (p * 10.0 + c * won_in_it * 10.0) / (p + c);
    let spins_per_cycle = 1.0 / (p + c);
    let solved = solved(&with_a_regular_early_end());
    assert!(
        close(
            solved.round_chance.value(),
            spins_per_cycle / rounds_per_cycle
        ),
        "{} against {}",
        solved.round_chance.value(),
        spins_per_cycle / rounds_per_cycle
    );
}
