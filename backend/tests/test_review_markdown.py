from app.models.finding import Finding, FindingCategory, FindingSeverity
from app.models.review import Review, ReviewStatus
from app.services.review_markdown import review_to_markdown


def _review(findings):
    review = Review(
        id=1,
        project_id=1,
        pr_number=42,
        pr_title="Fix login bug",
        pr_url="https://github.com/x/y/pull/42",
        diff_snapshot="",
        status=ReviewStatus.completed,
        model_used="test-model",
    )
    review.findings = findings
    return review


def test_clean_review_has_no_issues_message():
    md = review_to_markdown(_review([]), "https://app.example.com/reviews/1")
    assert "no issues found" in md.lower()
    assert "https://app.example.com/reviews/1" in md


def test_findings_sorted_most_severe_first():
    low = Finding(category=FindingCategory.style, severity=FindingSeverity.low, file_path="a.py", message="nit")
    critical = Finding(
        category=FindingCategory.security, severity=FindingSeverity.critical, file_path="b.py", message="sqli"
    )
    md = review_to_markdown(_review([low, critical]), "https://app.example.com/reviews/1")
    assert md.index("Critical") < md.index("Low")


def test_includes_suggested_fix_when_present():
    finding = Finding(
        category=FindingCategory.bug,
        severity=FindingSeverity.high,
        file_path="a.py",
        line_number=5,
        message="Off by one",
        suggested_fix="Use <= instead of <",
    )
    md = review_to_markdown(_review([finding]), "https://app.example.com/reviews/1")
    assert "a.py:5" in md
    assert "Use <= instead of <" in md
