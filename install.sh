#!/usr/bin/env bash
set -euo pipefail

MIN_NODE=24
PKG="@clipboard-health/groundcrew-config"

node_major() {
  node --version 2>/dev/null | sed 's/v//' | cut -d. -f1
}

has_node24() {
  command -v node &>/dev/null && [ "$(node_major)" -ge "$MIN_NODE" ] 2>/dev/null
}

# Try to activate nvm if node isn't in PATH or is too old
if ! has_node24; then
  for nvm_sh in \
    "$HOME/.nvm/nvm.sh" \
    "/usr/local/share/nvm/nvm.sh" \
    "/opt/homebrew/opt/nvm/nvm.sh"
  do
    if [ -s "$nvm_sh" ]; then
      # shellcheck source=/dev/null
      . "$nvm_sh"
      break
    fi
  done
fi

if ! has_node24; then
  if command -v nvm &>/dev/null; then
    echo "Installing Node $MIN_NODE via nvm..."
    nvm install "$MIN_NODE"
    nvm use "$MIN_NODE"
  else
    cat >&2 <<EOF
Error: Node $MIN_NODE+ is required (found: $(node --version 2>/dev/null || echo "none")).

Install Node $MIN_NODE via nvm, then re-run this script:
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  # open a new shell, then:
  nvm install $MIN_NODE
  nvm use $MIN_NODE

Or use your system package manager to install Node $MIN_NODE+.
EOF
    exit 1
  fi
fi

echo "Node $(node --version) — installing $PKG..."
npm install -g "$PKG"
echo ""
echo "Done! Run: crew-config"
