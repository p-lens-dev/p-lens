//! The systems' view of a machine: queries over its components that assemble
//! the regular game and each mode, refusing an entity whose components do not
//! make one — a component missing, two that conflict, or one astray.

use std::collections::{BTreeMap, BTreeSet};

use pachinko_domain::probability::ProbabilitySource;
use pachinko_domain::spec::{Component, Mode, ModeId, ModeKind, RegularPlay, Spec};

use crate::error::SpecError;

/// Every entity a component table names, with the table's name.
fn keyed<V>(
    table: &BTreeMap<ModeId, V>,
    component: Component,
) -> impl Iterator<Item = (&ModeId, Component)> {
    table.keys().map(move |entity| (entity, component))
}

/// Each entity once, and every component on an entity the world has.
fn check_entities(spec: &Spec) -> Result<BTreeSet<&ModeId>, SpecError> {
    let known = spec
        .entities
        .iter()
        .try_fold(BTreeSet::new(), |mut seen, entity| {
            if seen.insert(entity) {
                Ok(seen)
            } else {
                Err(SpecError::DuplicateMode {
                    mode: entity.clone(),
                })
            }
        })?;
    let components = &spec.components;
    let named = keyed(&components.regular_game, Component::RegularGame)
        .chain(keyed(&components.label, Component::Label))
        .chain(keyed(&components.allotment, Component::Allotment))
        .chain(keyed(&components.special_time, Component::SpecialTime))
        .chain(keyed(&components.rapid, Component::Rapid))
        .chain(keyed(&components.leftover_queue, Component::LeftoverQueue))
        .chain(keyed(&components.rushing, Component::Rushing))
        .chain(
            components
                .until_hit
                .iter()
                .map(|entity| (entity, Component::UntilHit)),
        )
        .chain(keyed(
            &components.until_hit_chance,
            Component::UntilHitChance,
        ))
        .chain(keyed(&components.on_miss, Component::OnMiss))
        .chain(keyed(&components.lucky_trigger, Component::LuckyTrigger))
        .chain(keyed(&components.relief_drive, Component::ReliefDrive))
        .chain(
            components
                .without_support
                .iter()
                .map(|entity| (entity, Component::WithoutSupport)),
        )
        .chain(keyed(&components.early_end, Component::EarlyEnd))
        .chain(keyed(
            &components.assumed_setting_level,
            Component::AssumedSettingLevel,
        ))
        .chain(keyed(&components.relief_counted, Component::ReliefCounted))
        .chain(
            components
                .queued
                .iter()
                .map(|entity| (entity, Component::Queued)),
        )
        .chain(keyed(&components.combo_of, Component::ComboOf));
    named
        .into_iter()
        .find(|(entity, _)| !known.contains(entity))
        .map_or(Ok(known), |(entity, component)| {
            Err(SpecError::StrayComponent {
                entity: entity.clone(),
                component,
            })
        })
}

/// The entity that is the regular game: exactly one has it.
fn regular_entity(spec: &Spec) -> Result<&ModeId, SpecError> {
    let mut found = spec.components.regular_game.keys();
    match (found.next(), found.next()) {
        (Some(entity), None) => Ok(entity),
        (None, _) => Err(SpecError::NoRegularGame),
        (Some(_), Some(_)) => Err(SpecError::SeveralRegularGames),
    }
}

/// The kinds of mode an entity has, by name.
fn kinds_of(spec: &Spec, entity: &ModeId) -> Vec<Component> {
    let components = &spec.components;
    [
        components
            .special_time
            .contains_key(entity)
            .then_some(Component::SpecialTime),
        components
            .rapid
            .contains_key(entity)
            .then_some(Component::Rapid),
        components
            .leftover_queue
            .contains_key(entity)
            .then_some(Component::LeftoverQueue),
        components
            .rushing
            .contains_key(entity)
            .then_some(Component::Rushing),
        components
            .until_hit
            .contains(entity)
            .then_some(Component::UntilHit),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn stray(entity: &ModeId, component: Component) -> SpecError {
    SpecError::StrayComponent {
        entity: entity.clone(),
        component,
    }
}

/// The regular game, assembled from its entity: its chance, its
/// allotment and its 遊タイム. A mode's components on it are astray.
///
/// # Errors
/// When no entity, or more than one, is the regular game, when it lacks its
/// allotment, or carries a component only a mode has.
pub fn regular_play(spec: &Spec) -> Result<RegularPlay, SpecError> {
    check_entities(spec)?;
    let entity = regular_entity(spec)?;
    let components = &spec.components;
    if let Some(&kind) = kinds_of(spec, entity).first() {
        return Err(stray(entity, kind));
    }
    if components.on_miss.contains_key(entity) {
        return Err(stray(entity, Component::OnMiss));
    }
    if components.lucky_trigger.contains_key(entity) {
        return Err(stray(entity, Component::LuckyTrigger));
    }
    if components.without_support.contains(entity) {
        return Err(stray(entity, Component::WithoutSupport));
    }
    if components.until_hit_chance.contains_key(entity) {
        return Err(stray(entity, Component::UntilHitChance));
    }
    if components.relief_counted.contains_key(entity) {
        return Err(stray(entity, Component::ReliefCounted));
    }
    if components.queued.contains(entity) {
        return Err(stray(entity, Component::Queued));
    }
    if components.combo_of.contains_key(entity) {
        return Err(stray(entity, Component::ComboOf));
    }
    let game = components
        .regular_game
        .get(entity)
        .ok_or(SpecError::NoRegularGame)?;
    Ok(RegularPlay {
        chance: game.chance,
        allotment: components.allotment.get(entity).cloned().ok_or_else(|| {
            SpecError::MissingComponent {
                entity: entity.clone(),
                component: Component::Allotment,
            }
        })?,
        relief_drive: components.relief_drive.get(entity).cloned(),
        early_end: components.early_end.get(entity).cloned(),
    })
}

/// How the mode on `entity` ends, from its one kind component. A 時短 plays
/// at `regular`, the regular game's chance, or its own where it says one, and
/// a leftover queue at `regular`; both fill the relief gauge. An ST plays at
/// its own and does not — unless the mode says otherwise by `relief_counted`.
fn kind_of(
    spec: &Spec,
    entity: &ModeId,
    regular: ProbabilitySource,
) -> Result<ModeKind, SpecError> {
    let counted = spec.components.relief_counted.get(entity).copied();
    let components = &spec.components;
    let missing = || SpecError::MissingKind {
        entity: entity.clone(),
    };
    match kinds_of(spec, entity).as_slice() {
        [] => Err(missing()),
        [first, second, ..] => Err(SpecError::ConflictingComponents {
            entity: entity.clone(),
            first: *first,
            second: *second,
        }),
        [Component::SpecialTime] => components
            .special_time
            .get(entity)
            .map(|special| ModeKind::Runout {
                spins: special.spins,
                chance: special.chance,
                fills_gauge: counted.unwrap_or(false),
            })
            .ok_or_else(missing),
        [Component::Rapid] => components
            .rapid
            .get(entity)
            .map(|rapid| ModeKind::Runout {
                spins: rapid.spins,
                chance: rapid.chance.unwrap_or(regular),
                fills_gauge: counted.unwrap_or(true),
            })
            .ok_or_else(missing),
        [Component::LeftoverQueue] => components
            .leftover_queue
            .get(entity)
            .map(|queue| ModeKind::Runout {
                spins: queue.draws,
                chance: regular,
                fills_gauge: counted.unwrap_or(true),
            })
            .ok_or_else(missing),
        [Component::Rushing] => components
            .rushing
            .get(entity)
            .map(|rushing| ModeKind::Continuation {
                rate: rushing.continuation_rate,
                spins: rushing.spins,
            })
            .ok_or_else(missing),
        [_] => Ok(ModeKind::UntilHit {
            chance: components.until_hit_chance.get(entity).copied(),
        }),
    }
}

/// Whether a mode's spins are queued already, costing nothing off the 電サポ:
/// a leftover queue's, or a mode's said to be.
fn queued(spec: &Spec, entity: &ModeId) -> bool {
    spec.components.leftover_queue.contains_key(entity) || spec.components.queued.contains(entity)
}

fn mode_of(spec: &Spec, entity: &ModeId, regular: ProbabilitySource) -> Result<Mode, SpecError> {
    let components = &spec.components;
    let missing = |component: Component| SpecError::MissingComponent {
        entity: entity.clone(),
        component,
    };
    if components.relief_drive.contains_key(entity) {
        return Err(stray(entity, Component::ReliefDrive));
    }
    let runs_out = components.special_time.contains_key(entity)
        || components.rapid.contains_key(entity)
        || components.leftover_queue.contains_key(entity);
    if components.early_end.contains_key(entity) && !runs_out {
        return Err(stray(entity, Component::EarlyEnd));
    }
    if components.queued.contains(entity) && !runs_out {
        return Err(stray(entity, Component::Queued));
    }
    if components.queued.contains(entity) && components.without_support.contains(entity) {
        return Err(SpecError::ConflictingComponents {
            entity: entity.clone(),
            first: Component::WithoutSupport,
            second: Component::Queued,
        });
    }
    if components.assumed_setting_level.contains_key(entity) {
        return Err(stray(entity, Component::AssumedSettingLevel));
    }
    if components.relief_counted.contains_key(entity) && !runs_out {
        return Err(stray(entity, Component::ReliefCounted));
    }
    if components.combo_of.contains_key(entity) && components.lucky_trigger.contains_key(entity) {
        return Err(SpecError::ConflictingComponents {
            entity: entity.clone(),
            first: Component::LuckyTrigger,
            second: Component::ComboOf,
        });
    }
    if components.until_hit_chance.contains_key(entity) && !components.until_hit.contains(entity) {
        return Err(stray(entity, Component::UntilHitChance));
    }
    Ok(Mode {
        id: entity.clone(),
        label: components
            .label
            .get(entity)
            .cloned()
            .unwrap_or_else(|| entity.as_str().to_owned()),
        kind: kind_of(spec, entity, regular)?,
        allotment: components
            .allotment
            .get(entity)
            .cloned()
            .ok_or_else(|| missing(Component::Allotment))?,
        on_miss: components
            .on_miss
            .get(entity)
            .cloned()
            .ok_or_else(|| missing(Component::OnMiss))?,
        lucky_trigger: components.lucky_trigger.get(entity).cloned(),
        supported: !components.without_support.contains(entity) && !queued(spec, entity),
        at_heso: components.without_support.contains(entity) && !queued(spec, entity),
        early_end: components.early_end.get(entity).cloned(),
        combo_of: components.combo_of.get(entity).cloned(),
    })
}

/// Every mode, in the order its entity was made, assembled from its
/// components: how it ends, its allotment, where a miss goes, its lucky trigger.
///
/// # Errors
/// When an entity lacks a kind, has two, or lacks its allotment or where a
/// miss goes, or carries the regular game's 遊タイム.
pub fn modes(spec: &Spec) -> Result<Vec<Mode>, SpecError> {
    check_entities(spec)?;
    let regular = regular_entity(spec)?;
    let chance = spec
        .components
        .regular_game
        .get(regular)
        .ok_or(SpecError::NoRegularGame)?
        .chance;
    spec.entities
        .iter()
        .filter(|entity| *entity != regular)
        .map(|entity| mode_of(spec, entity, chance))
        .collect()
}
