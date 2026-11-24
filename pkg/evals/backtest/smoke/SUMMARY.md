# Smoke summary

| Repository | Command | Exit code | Seconds | Problem |
|---|---|---:|---:|---|
| tenet-copilot | onboard --inventory-only --json | 1 | 10.781 | contradictory output |
| tenet-copilot | check --json | 1 | 3.960 | TN-INTERNAL; tenet.yaml required |
| tenet-copilot | board --json | 1 | 3.138 | TN-INTERNAL; tenet.yaml required |
| tenet-copilot | context --query test --budget-tokens 2000 --json | 1 | 2.173 | TN-INTERNAL; tenet.yaml required |
| tenet-copilot | verify --run-checks --json | 2 | 1.988 | ok |
| BotFramework-WebChat | onboard --inventory-only --json | 1 | 22.910 | contradictory output |
| BotFramework-WebChat | check --json | 1 | 2.170 | TN-INTERNAL; tenet.yaml required |
| BotFramework-WebChat | board --json | 1 | 2.138 | TN-INTERNAL; tenet.yaml required |
| BotFramework-WebChat | context --query test --budget-tokens 2000 --json | 1 | 1.854 | TN-INTERNAL; tenet.yaml required |
| BotFramework-WebChat | verify --run-checks --json | 2 | 1.697 | ok |
| torus | onboard --inventory-only --json | 1 | 2.648 | tenet.yaml required |
| torus | check --json | 1 | 1.626 | TN-INTERNAL; tenet.yaml required |
| torus | board --json | 1 | 1.656 | TN-INTERNAL; tenet.yaml required |
| torus | context --query test --budget-tokens 2000 --json | 1 | 3.553 | TN-INTERNAL; tenet.yaml required |
| torus | verify --run-checks --json | 2 | 4.536 | ok |
