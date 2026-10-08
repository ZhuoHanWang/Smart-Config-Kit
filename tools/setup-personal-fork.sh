#!/usr/bin/env bash
# Create a personal GitHub fork and configure origin without publishing local changes.
set -euo pipefail

if [[ ${1:-} == '--help' ]]; then
  echo 'Usage: bash tools/setup-personal-fork.sh'
  echo 'Requires GitHub CLI (gh) and gh auth login. Does not commit, push or merge.'
  exit 0
fi

command -v gh >/dev/null 2>&1 || {
  echo 'GitHub CLI (gh) is required: https://cli.github.com/' >&2
  exit 1
}
gh auth status >/dev/null 2>&1 || {
  echo 'First run: gh auth login' >&2
  exit 1
}

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
author_repo='IvanSolis1989/Smart-Config-Kit'
author_url="https://github.com/$author_repo.git"
login=$(gh api user --jq '.login')
personal_repo="$login/Smart-Config-Kit"
personal_url="https://github.com/$personal_repo.git"

if [[ $login == 'IvanSolis1989' ]]; then
  echo 'Log in with your personal account, rather than the upstream author account.' >&2
  exit 1
fi

upstream_url=$(git remote get-url upstream 2>/dev/null || true)
origin_url=$(git remote get-url origin 2>/dev/null || true)
if [[ -n $upstream_url && $upstream_url != "$author_url" ]]; then
  echo 'upstream points to a different repository; no remotes were changed.' >&2
  exit 1
fi
if [[ -n $origin_url && $origin_url != "$author_url" && $origin_url != "$personal_url" && $origin_url != "git@github.com:$personal_repo.git" ]]; then
  echo 'origin points to a different repository; no remotes were changed.' >&2
  exit 1
fi

# Reuse an existing fork; create it only when the account does not have one.
if ! gh api "repos/$personal_repo" >/dev/null 2>&1; then
  gh repo fork "$author_repo" --clone=false --remote=false
fi
parent=$(gh api "repos/$personal_repo" --jq '.parent.full_name // ""')
if [[ $parent != "$author_repo" ]]; then
  echo 'The target repository is not a fork of the expected upstream; no remotes were changed.' >&2
  exit 1
fi

if [[ -z $upstream_url ]]; then
  if [[ $origin_url == "$author_url" ]]; then
    git remote rename origin upstream
    origin_url=''
  else
    git remote add upstream "$author_url"
  fi
fi
if [[ $origin_url == "$author_url" ]]; then
  git remote set-url origin "$personal_url"
elif [[ -z $origin_url ]]; then
  git remote add origin "$personal_url"
fi

echo "Fork: https://github.com/$personal_repo"
echo "FlClash JS: https://cdn.jsdelivr.net/gh/$personal_repo@main/FlClash/FlClash%28mihomo%29.js"
echo 'Remotes configured. Local changes are still unpublished; validate, commit, then push origin main.'
