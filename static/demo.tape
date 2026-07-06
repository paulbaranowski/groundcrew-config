# VHS tape (https://github.com/charmbracelet/vhs) that produced demo.gif.
#
# Reproduce with: `brew install vhs`, `crew-config` on PATH, and a sample
# config to edit so no real config is touched:
#
#   mkdir -p /tmp/acme
#   cat > /tmp/acme/crew.config.json <<'EOF'
#   {
#     "workspace": {
#       "projectDir": "~/dev/acme",
#       "knownRepositories": ["acme/api", "acme/webapp", "acme/infra"]
#     },
#     "agents": { "default": "claude", "definitions": { "claude": {} } },
#     "sources": [{ "kind": "todo-txt" }]
#   }
#   EOF
#   vhs static/demo.tape
Output static/demo.gif

Set Shell "bash"
Set FontSize 17
Set Width 1280
Set Height 720
Set Theme "Catppuccin Mocha"
Set TypingSpeed 70ms
Set Padding 20

Hide
Type "cd /tmp/acme && alias crew-config='crew-config --local' && clear"
Enter
Sleep 500ms
Show

Type "crew-config"
Sleep 500ms
Enter
# Let the TUI mount and groundcrew validation turn the badges green
Sleep 3.5s

# --- Task Sources: highlight each source ---
Down
Sleep 600ms
Down
Sleep 600ms
Enter
Sleep 2s
Down
Sleep 900ms
Down
Sleep 900ms
Down
Sleep 900ms
Sleep 800ms
Escape
Sleep 1s

# --- Repositories: open one and pause on its options ---
Up
Sleep 500ms
Up
Sleep 500ms
Enter
Sleep 2s
Enter
Sleep 3.5s
Escape
Sleep 800ms
Escape
Sleep 1s

# --- Sandbox ---
Down
Sleep 350ms
Down
Sleep 350ms
Down
Sleep 350ms
Down
Sleep 350ms
Down
Sleep 500ms
Enter
Sleep 3s
Escape
Sleep 1s

# --- Terminal ---
Up
Sleep 500ms
Enter
Sleep 3s
Escape
Sleep 1.2s

# Quit
Type "q"
Sleep 1.5s
