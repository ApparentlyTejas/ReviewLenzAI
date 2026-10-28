from app.models.finding import Finding, FindingCategory, FindingSeverity
from app.models.review import Review, ReviewStatus
from app.services.review_delta import compute_delta


def _review(db_session, project_id, pr_number, findings, status=ReviewStatus.completed):
    review = Review(
        project_id=project_id,
        pr_number=pr_number,
        pr_title="PR",
        pr_url="https://github.com/x/y/pull/1",
        diff_snapshot="diff",
        status=status,
        model_used="test-model",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)
    for f in findings:
        f.review_id = review.id
        db_session.add(f)
    db_session.commit()
    db_session.refresh(review)
    return review


def _finding(file_path="a.py", line_number=1, category=FindingCategory.bug, severity=FindingSeverity.high):
    return Finding(file_path=file_path, line_number=line_number, category=category, severity=severity, message="x")


def test_no_delta_when_no_previous_review(db_session):
    review = _review(db_session, project_id=1, pr_number=1, findings=[_finding()])
    assert compute_delta(db_session, review) is None


def test_no_delta_for_non_completed_review(db_session):
    _review(db_session, project_id=1, pr_number=2, findings=[_finding()])
    pending = _review(db_session, project_id=1, pr_number=2, findings=[], status=ReviewStatus.pending)
    assert compute_delta(db_session, pending) is None


def test_resolved_and_new_findings_detected(db_session):
    _review(db_session, project_id=1, pr_number=3, findings=[_finding(line_number=1), _finding(line_number=2)])
    current = _review(db_session, project_id=1, pr_number=3, findings=[_finding(line_number=1), _finding(line_number=3)])

    delta = compute_delta(db_session, current)

    assert delta is not None
    assert delta.resolved_count == 1  # line 2 is gone
    assert delta.unchanged_count == 1  # line 1 persists
    assert len(delta.new_finding_ids) == 1  # line 3 is new


def test_identical_findings_yield_zero_delta(db_session):
    _review(db_session, project_id=1, pr_number=4, findings=[_finding()])
    current = _review(db_session, project_id=1, pr_number=4, findings=[_finding()])

    delta = compute_delta(db_session, current)

    assert delta.resolved_count == 0
    assert delta.new_finding_ids == []
    assert delta.unchanged_count == 1


def test_uses_most_recent_prior_review_not_the_oldest(db_session):
    _review(db_session, project_id=1, pr_number=5, findings=[_finding(line_number=1)])
    _review(db_session, project_id=1, pr_number=5, findings=[_finding(line_number=2)])
    current = _review(db_session, project_id=1, pr_number=5, findings=[_finding(line_number=2)])

    delta = compute_delta(db_session, current)

    # Matches against the second review (line 2), not the first (line 1) —
    # otherwise this would show line 2 as "new" instead of unchanged.
    assert delta.resolved_count == 0
    assert delta.unchanged_count == 1
