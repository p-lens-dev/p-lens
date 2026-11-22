use crate::quantity::Balls;

/// The conditions a formula adopts on top of a spec: what a round really
/// yields, and what the spins played on the 電サポ gain or lose besides. Two
/// formulas of the same machine can differ here as well as in the spec they
/// were built from.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CalculationConditions {
    pub round_payout: RoundPayout,
    pub support_drift: SupportDrift,
}

/// 電サポ中の増減: what each spin played on the 電サポ gains or loses, shot
/// to the right between jackpots — balls running past the 電チュー, or
/// caught besides — in hundredths of a ball: `-30` is 0.3 of a ball lost a
/// spin. The rounds of a jackpot are never touched, nor a spin of a mode
/// played without the 電サポ. A spec sheet's figures are the machine's
/// alone; this is the play's, as a parlor's cabinet gives it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SupportDrift(i32);

impl SupportDrift {
    pub const NONE: Self = Self(0);

    /// A drift of at most ten balls a spin either way.
    pub const fn new(hundredths: i32) -> Option<Self> {
        if -1_000 <= hundredths && hundredths <= 1_000 {
            Some(Self(hundredths))
        } else {
            None
        }
    }

    pub fn hundredths(self) -> i32 {
        self.0
    }

    /// Balls a spin on the 電サポ gains: `-0.3` at `-30`.
    pub fn balls_per_spin(self) -> f64 {
        f64::from(self.0) / 100.0
    }
}

/// What one round yields.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum RoundPayout {
    /// The spec's payout rule: paid out, less what went in.
    FromSpec,
    /// A measured figure, for a cabinet that pays less than its sheet says.
    Measured(Balls),
}

/// The conditions of one person's play: how many spins ¥1,000 buys at this
/// cabinet, and what a ball exchanges for.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PlayConditions {
    pub spin_performance: SpinPerformance,
    pub ball_value: BallValue,
}

/// Spins per ¥1,000. Positive and finite.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SpinPerformance(f64);

impl SpinPerformance {
    pub fn new(value: f64) -> Option<Self> {
        (value.is_finite() && value > 0.0).then_some(Self(value))
    }

    pub fn value(self) -> f64 {
        self.0
    }
}

/// Yen a ball exchanges for: `4.0` at an equal rate, `3.57` at 28 balls.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BallValue(f64);

impl BallValue {
    pub fn new(value: f64) -> Option<Self> {
        (value.is_finite() && value > 0.0).then_some(Self(value))
    }

    pub fn value(self) -> f64 {
        self.0
    }
}
