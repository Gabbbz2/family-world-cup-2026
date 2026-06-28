from knockout_bracket import OFFICIAL_R32_THIRD_PLACE_MAP, official_third_place_match_groups


def test_official_r32_mapping_has_all_495_combinations():
    assert len(OFFICIAL_R32_THIRD_PLACE_MAP) == 495


def test_official_r32_mapping_matches_fifa_live_example():
    assert official_third_place_match_groups(list("BDEFIJKL")) == {
        74: "D",
        77: "F",
        79: "E",
        80: "K",
        81: "B",
        82: "I",
        85: "J",
        87: "L",
    }


def test_official_r32_mapping_handles_first_table_row():
    assert official_third_place_match_groups(list("EFGHIJKL")) == {
        74: "F",
        77: "G",
        79: "E",
        80: "K",
        81: "I",
        82: "H",
        85: "J",
        87: "L",
    }