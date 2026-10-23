import httpx

GITHUB_API_BASE = "https://api.github.com"


class GitHubAuthError(Exception):
    """Raised when the PAT is invalid or lacks access to the repo."""


class GitHubNotFoundError(Exception):
    """Raised when the repo or PR doesn't exist."""


def _headers(pat: str, accept: str = "application/vnd.github+json") -> dict[str, str]:
    return {"Authorization": f"Bearer {pat}", "Accept": accept, "X-GitHub-Api-Version": "2022-11-28"}


def list_user_repos(pat: str) -> list[dict]:
    repos: list[dict] = []
    page = 1
    while True:
        response = httpx.get(
            f"{GITHUB_API_BASE}/user/repos",
            headers=_headers(pat),
            params={
                "per_page": 100,
                "page": page,
                "sort": "pushed",
                # Without "organization_member", repos the user can only see
                # via an org membership (not direct ownership or a repo-level
                # collaborator invite) never show up in "Browse repos" at all.
                "affiliation": "owner,collaborator,organization_member",
            },
            timeout=10,
        )
        if response.status_code == 401:
            raise GitHubAuthError("GitHub token is invalid or expired")
        response.raise_for_status()
        batch = response.json()
        if not batch:
            break
        repos.extend({"full_name": r["full_name"], "owner": r["owner"]["login"], "name": r["name"], "private": r["private"]} for r in batch)
        if len(batch) < 100:
            break
        page += 1
    return repos


def validate_repo_access(pat: str, repo_owner: str, repo_name: str) -> None:
    url = f"{GITHUB_API_BASE}/repos/{repo_owner}/{repo_name}"
    response = httpx.get(url, headers=_headers(pat), timeout=10)
    if response.status_code == 401:
        raise GitHubAuthError("GitHub token is invalid or expired")
    if response.status_code == 404:
        raise GitHubNotFoundError(f"Repository {repo_owner}/{repo_name} not found or token lacks access")
    response.raise_for_status()


def list_open_pull_requests(pat: str, repo_owner: str, repo_name: str) -> list[dict]:
    url = f"{GITHUB_API_BASE}/repos/{repo_owner}/{repo_name}/pulls"
    response = httpx.get(url, headers=_headers(pat), params={"state": "open", "per_page": 100}, timeout=10)
    if response.status_code == 401:
        raise GitHubAuthError("GitHub token is invalid or expired")
    response.raise_for_status()
    pulls = response.json()
    return [
        {
            "number": pr["number"],
            "title": pr["title"],
            "url": pr["html_url"],
            "author": pr["user"]["login"],
            "updated_at": pr["updated_at"],
        }
        for pr in pulls
    ]


def get_pull_request(pat: str, repo_owner: str, repo_name: str, pr_number: int) -> dict:
    url = f"{GITHUB_API_BASE}/repos/{repo_owner}/{repo_name}/pulls/{pr_number}"
    response = httpx.get(url, headers=_headers(pat), timeout=10)
    if response.status_code == 401:
        raise GitHubAuthError("GitHub token is invalid or expired")
    if response.status_code == 404:
        raise GitHubNotFoundError(f"PR #{pr_number} not found")
    response.raise_for_status()
    pr = response.json()
    return {
        "number": pr["number"],
        "title": pr["title"],
        "url": pr["html_url"],
        "author": pr["user"]["login"],
        "updated_at": pr["updated_at"],
    }


def get_pull_request_diff(pat: str, repo_owner: str, repo_name: str, pr_number: int) -> str:
    url = f"{GITHUB_API_BASE}/repos/{repo_owner}/{repo_name}/pulls/{pr_number}"
    response = httpx.get(url, headers=_headers(pat, accept="application/vnd.github.v3.diff"), timeout=20)
    if response.status_code == 401:
        raise GitHubAuthError("GitHub token is invalid or expired")
    if response.status_code == 404:
        raise GitHubNotFoundError(f"PR #{pr_number} not found")
    response.raise_for_status()
    return response.text
