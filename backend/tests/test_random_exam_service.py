import pytest
import random
from app.services.random_exam_service import (
    calculate_overlap,
    check_candidate_overlap,
    MAX_GENERATION_ATTEMPTS,
)


def test_calculate_overlap():
    # Disjoint sets
    set_a = {f"q_{i}" for i in range(30)}
    set_b = {f"q_{i}" for i in range(30, 60)}
    assert calculate_overlap(set_a, set_b) == 0.0

    # Identical sets
    assert calculate_overlap(set_a, set_a) == 1.0

    # 15 overlap out of 30 (50%)
    set_c = {f"q_{i}" for i in range(15, 45)}
    overlap = calculate_overlap(set_a, set_c)
    assert pytest.approx(overlap, 0.001) == 0.5

    # 10 overlap out of 30 (33.33%)
    set_d = {f"q_{i}" for i in range(20, 50)}
    assert pytest.approx(calculate_overlap(set_a, set_d), 0.001) == 10 / 30


def test_check_candidate_overlap():
    base_set = {f"q_{i}" for i in range(30)}
    existing_sets = [base_set]

    # Candidate with 15 overlaps (50%) -> should pass when max_overlap=0.5
    cand_50 = {f"q_{i}" for i in range(15, 45)}
    is_valid, max_found = check_candidate_overlap(cand_50, existing_sets, 0.5)
    assert is_valid is True
    assert pytest.approx(max_found, 0.001) == 0.5

    # Candidate with 16 overlaps (53.3%) -> should fail when max_overlap=0.5
    cand_53 = {f"q_{i}" for i in range(14, 44)}
    is_valid, max_found = check_candidate_overlap(cand_53, existing_sets, 0.5)
    assert is_valid is False
    assert max_found > 0.5


def test_anti_collision_simulation():
    """
    Test simulation: from a pool of 60 questions, generate 5 student instances of 30 questions each,
    ensuring each student instance has <= 50% overlap with all previously generated instances.
    """
    pool = [f"q_{i:02d}" for i in range(60)]
    target_count = 30
    max_overlap = 0.50

    generated_instances = []
    existing_sets = []

    rng = random.Random(12345)

    for student_idx in range(5):
        accepted = None
        for attempt in range(MAX_GENERATION_ATTEMPTS):
            cand = set(rng.sample(pool, target_count))
            is_valid, max_found = check_candidate_overlap(cand, existing_sets, max_overlap)
            if is_valid or not existing_sets:
                accepted = cand
                existing_sets.append(cand)
                break

        assert accepted is not None, f"Student {student_idx} failed to generate within attempt limit"
        generated_instances.append(accepted)

    # Verify all pairs have overlap <= 50%
    for i in range(len(generated_instances)):
        for j in range(i + 1, len(generated_instances)):
            ratio = calculate_overlap(generated_instances[i], generated_instances[j])
            assert ratio <= max_overlap + 1e-6, f"Pair ({i}, {j}) has overlap {ratio} > {max_overlap}"


def test_seed_reproducibility():
    """Verify that a given seed reproduces identical sampled questions and shuffle order."""
    pool = [f"q_{i:02d}" for i in range(60)]
    seed = "exam-uuid_student-uuid_1_seed123"

    rng1 = random.Random(seed)
    sample1 = rng1.sample(pool, 30)
    rng1.shuffle(sample1)

    rng2 = random.Random(seed)
    sample2 = rng2.sample(pool, 30)
    rng2.shuffle(sample2)

    assert sample1 == sample2


def test_option_uuid_integrity_under_shuffle():
    """Verify that options shuffling retains the exact option UUIDs and answer integrity."""
    raw_options = [
        {"id": "opt-1", "label": "A", "text": "Paris", "is_correct": True},
        {"id": "opt-2", "label": "B", "text": "London", "is_correct": False},
        {"id": "opt-3", "label": "C", "text": "Rome", "is_correct": False},
        {"id": "opt-4", "label": "D", "text": "Berlin", "is_correct": False},
    ]

    shuffled = list(raw_options)
    random.Random(999).shuffle(shuffled)

    # All 4 options are present
    assert len(shuffled) == 4
    shuffled_ids = {o["id"] for o in shuffled}
    assert shuffled_ids == {"opt-1", "opt-2", "opt-3", "opt-4"}

    # The correct option still has id "opt-1"
    correct = next(o for o in shuffled if o["is_correct"])
    assert correct["id"] == "opt-1"
