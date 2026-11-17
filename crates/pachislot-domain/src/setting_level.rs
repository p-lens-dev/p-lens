/// One of the settings a parlor chooses for a cabinet, `1` to `6` — or one
/// a machine names otherwise beside them, ordered where it stands: 設定L
/// (`-1`) and 設定0 (`0`) below the first, 設定H (`7`) and 設定V (`8`) above
/// the sixth. A machine may offer only some of them — `1, 2, 4, 5, 6` is
/// common, `1, 2, 5, 6, H` rare — so a spec lists the ones it has rather
/// than assuming all six.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SettingLevel(i8);

impl SettingLevel {
    /// 設定L, below every numbered setting.
    pub const L: i8 = -1;
    /// 設定H, above every numbered setting.
    pub const H: i8 = 7;
    /// 設定V, above every numbered setting and 設定H.
    pub const V: i8 = 8;
    pub const LOWEST: i8 = Self::L;
    pub const HIGHEST: i8 = Self::V;

    pub fn new(value: i8) -> Option<Self> {
        (Self::LOWEST..=Self::HIGHEST)
            .contains(&value)
            .then_some(Self(value))
    }

    pub fn get(self) -> i8 {
        self.0
    }
}

/// A value for each of a machine's settings, in the order written.
#[derive(Clone, Debug, PartialEq)]
pub struct PerSettingLevel<T>(pub Vec<(SettingLevel, T)>);

impl<T> PerSettingLevel<T> {
    pub fn get(&self, setting_level: SettingLevel) -> Option<&T> {
        self.0
            .iter()
            .find(|(each, _)| *each == setting_level)
            .map(|(_, value)| value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_setting_is_one_to_six_or_one_named_beside_them() {
        assert_eq!(SettingLevel::new(-2), None);
        assert_eq!(SettingLevel::new(9), None);
        assert_eq!(SettingLevel::new(6).map(SettingLevel::get), Some(6));
        assert_eq!(
            SettingLevel::new(SettingLevel::H).map(SettingLevel::get),
            Some(7)
        );
        assert!(SettingLevel::new(SettingLevel::L) < SettingLevel::new(0));
        assert!(SettingLevel::new(6) < SettingLevel::new(SettingLevel::H));
    }

    #[test]
    fn a_value_is_found_by_its_setting() {
        let values = PerSettingLevel(
            [1, 6]
                .into_iter()
                .filter_map(SettingLevel::new)
                .zip(["low", "high"])
                .collect(),
        );
        assert_eq!(
            SettingLevel::new(6).and_then(|six| values.get(six)),
            Some(&"high")
        );
        assert_eq!(
            SettingLevel::new(3).and_then(|three| values.get(three)),
            None
        );
    }
}
